"""Regression tests for the quality gates, not for static marketing wording."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from live_site_smoke import inspect_response, make_plan, response_result, verdict
from site_quality import Document, audit, visible_faq


VALID = '''<!doctype html><html lang="en"><head><title>Metcalf Search</title>
<meta name="description" content="A useful description of Metcalf Search recruiting services, clearly explained for business owners.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://metcalfsearch.com/">
<style>@media(max-width:700px){.nav-cta{display:block}}.hamburger-btn{display:block}</style>
</head><body><nav><a class="nav-cta" href="/contact">Start a Conversation</a></nav>
<h1>Metcalf Search</h1><div id="example">An example</div></body></html>'''


class QualityGateTests(unittest.TestCase):
    def run_gate(self, source):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.html").write_text(source)
            (root / "sitemap.xml").write_text('<urlset><url><loc>https://metcalfsearch.com/</loc></url></urlset>')
            (root / "robots.txt").write_text('Sitemap: https://metcalfsearch.com/sitemap.xml\nSitemap: https://metcalfsearch.com/blog/sitemap.xml\n')
            inventory = root / "tree.json"
            inventory.write_text(json.dumps([{"type": "blob", "path": "contact.html"}, {"type": "blob", "path": "logo.png"}]))
            return audit(root, inventory)[0]

    def test_valid_page_and_inventory(self):
        issues = self.run_gate(VALID.replace("</body>", '<img src="/logo.png" alt=""><a href="#example">Example</a></body>'))
        self.assertEqual([i for i in issues if i.severity == "ERR"], [])

    def test_detects_broken_targets_labels_and_style(self):
        source = VALID.replace("</body>", '<a href="/missing">Broken</a><a href="#absent">Hash</a><input name="unlabelled"><p>Bad engagement — TODO</p><div id="example"></div></body>')
        checks = {i.check for i in self.run_gate(source)}
        self.assertTrue({"internal-target", "hash-target", "form-label", "house-style", "duplicate-id"} <= checks)

    def test_detects_bad_html_and_schema(self):
        source = VALID.replace("</body>", '<p><strong>Unbalanced</p><script type="application/ld+json">{invalid}</script></body>')
        checks = {i.check for i in self.run_gate(source)}
        self.assertTrue({"tag-balance", "json-ld"} <= checks)

    def test_offer_description_is_not_a_price(self):
        schema = {"@type": "Offer", "priceSpecification": {"@type": "PriceSpecification", "description": "See services for current pricing."}}
        with_schema = lambda value: VALID.replace("</head>", '<script type="application/ld+json">' + json.dumps(value) + '</script></head>')
        self.assertNotIn("schema-offer", {i.check for i in self.run_gate(with_schema(schema))})
        schema["priceSpecification"]["price"] = 2875
        self.assertIn("schema-offer", {i.check for i in self.run_gate(with_schema(schema))})

    def test_all_visible_faq_shapes_and_drift(self):
        html = '<details><summary>First?<span aria-hidden="true">+</span></summary><div class="faq-answer">An <strong>answer</strong>.</div></details><div class="faq-item"><div class="faq-q">Second?</div><p class="faq-a">Next.</p></div><h3>Third?</h3><p>Third answer.</p>'
        pairs = visible_faq(Document(html), "faq.html")
        self.assertEqual([(q, a) for q, a, _ in pairs], [("First?", "An answer."), ("Second?", "Next."), ("Third?", "Third answer.")])
        schema = {"@type": "FAQPage", "mainEntity": [{"name": "First?", "acceptedAnswer": {"text": "Old answer"}}]}
        source = VALID.replace("</body>", html + '<script type="application/ld+json">' + json.dumps(schema) + '</script></body>')
        self.assertIn("faq-schema", {i.check for i in self.run_gate(source)})


class LiveSmokeTests(unittest.TestCase):
    def test_actual_blog_renderer_output(self):
        node = os.environ.get("METCALF_QA_NODE") or shutil.which("node")
        if not node:
            self.skipTest("Node is required to verify the actual renderer; set METCALF_QA_NODE")
        root = Path(__file__).resolve().parents[1]
        source = '''import { readFileSync } from 'node:fs';
import { renderPostPage } from './functions/_lib/blog.js';
import { fixtures } from './functions/_lib/blog.fixtures.mjs';
const template = readFileSync('blog.html', 'utf8');
const posts = ['post-daily.json', 'post-weekly.json'].map(key => fixtures[key]);
console.log(JSON.stringify(posts.map(post => ({path: '/blog/' + post.slug, html: renderPostPage(template, post)}))));'''
        rendered = subprocess.run([node, "--input-type=module", "-e", source], cwd=root, check=True, capture_output=True, text=True)
        for page in json.loads(rendered.stdout):
            with self.subTest(path=page["path"]):
                self.assertIn('"@type":"BlogPosting"', page["html"])
                self.assertEqual(inspect_response(page["path"], 200, "text/html", page["html"].encode()), [])

    def test_article_schema_types_are_parsed_not_matched_in_text(self):
        template = '<title>Post</title><link rel="canonical" href="https://metcalfsearch.com/blog/a"><h1>Post</h1>{}'
        for kind in ("Article", "BlogPosting", "NewsArticle"):
            with self.subTest(kind=kind):
                schema = {"@graph": [{"@type": ["CreativeWork", kind]}]}
                body = template.format('<script type="application/ld+json">' + json.dumps(schema) + '</script>').encode()
                self.assertEqual(inspect_response("/blog/a", 200, "text/html", body), [])
        fake = template.format('<p>"@type":"Article"</p>').encode()
        invalid = template.format('<script type="application/ld+json">{"@type":"Article", BROKEN}</script>').encode()
        self.assertTrue(inspect_response("/blog/a", 200, "text/html", fake))
        self.assertTrue(inspect_response("/blog/a", 200, "text/html", invalid))

    def test_access_denial_is_blocked_verification(self):
        item = {"path": "/", "origin": "https://metcalfsearch.com"}
        for status in (401, 403, 429):
            with self.subTest(status=status):
                result = response_result(item, {"status": status, "content_type": "text/html", "effective_url": "https://metcalfsearch.com/"}, b"Access denied")
                self.assertEqual(verdict(result), "BLOCKED")
                self.assertIn("availability", result["access_error"])

    def test_article_and_404_failures(self):
        body = b'<html><head><title>Post</title><link rel="canonical" href="https://metcalfsearch.com/blog/a"></head><body><h1>Post</h1><script type="application/ld+json">{"@type":"Article"}</script></body></html>'
        self.assertEqual(inspect_response("/blog/a", 200, "text/html", body), [])
        self.assertTrue(inspect_response("/blog/a", 500, "text/plain", b"Blog template unavailable"))
        self.assertTrue(inspect_response("/blog/a", 200, "application/json", b"{}"))
        self.assertEqual(inspect_response("/blog/__site-quality-404__", 404, "text/html", b"Not found"), [])
        self.assertTrue(inspect_response("/__site-quality-404__", 200, "text/html", body))

    def test_both_route_modes_and_origins(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "sitemap.xml").write_text('<urlset><url><loc>https://metcalfsearch.com/services</loc></url></urlset>')
            plan = make_plan(root, ["https://metcalfsearch.com", "https://metcalf-site.pages.dev"], [])
            self.assertEqual(len([p for p in plan if p["path"] == "/services"]), 4)
            self.assertEqual({p["mode"] for p in plan}, {"plain", "cache-busted"})
            self.assertTrue(all("?cb=" in p["url"] for p in plan if p["mode"] == "cache-busted"))


if __name__ == "__main__":
    unittest.main()
