#!/usr/bin/env python3
"""Read-only curl smoke checks. No submissions, purchases, logins or external forms.

Checks plain AND cache-busted URLs on production and the Pages origin so a
Worker-route problem cannot hide behind a passing cache-busted request.
Exit 0: pass; 1: verified response failures; 2: transport/verification blocked.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import uuid
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

DEFAULT_ORIGINS = ["https://metcalfsearch.com", "https://metcalf-site.pages.dev"]
KNOWN_BLOG_PATHS = [
    "/blog/ep-794-can-automation-make-hiring-more-human",
    "/blog/cloudflare-s-matthew-prince-says-ai-has-made-a-category-of-workers-obsolete",
    "/blog/growing-tribe-of-jobless-techies-is-stuck-in-silicon-valley-s-new-reality",
    "/blog/the-us-is-betting-on-ai-to-catch-insider-trading-in-prediction-markets",
    "/blog/executives-are-blaming-layoffs-on-ai-but-it-is-not-the-main-driver",
]


class Page(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.h1_count = 0
        self.anchors = []
        self.title = False
        self.canonical = ""
        self.json_ld = []
        self.json_ld_errors = []
        self._json_script = None
        self.feed(body.decode("utf-8", errors="replace"))
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.title = True
        if tag == "a" and "href" in attrs:
            self.anchors.append(attrs["href"])
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href", "")
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self._json_script = []

    def handle_data(self, data):
        if self._json_script is not None:
            self._json_script.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._json_script is not None:
            try:
                self.json_ld.append(json.loads("".join(self._json_script)))
            except json.JSONDecodeError as exc:
                self.json_ld_errors.append(str(exc))
            self._json_script = None


def schema_types(value):
    if isinstance(value, dict):
        types = value.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if isinstance(types, list):
            yield from (t for t in types if isinstance(t, str))
        for item in value.values():
            yield from schema_types(item)
    elif isinstance(value, list):
        for item in value:
            yield from schema_types(item)


def inspect_response(path, status, content_type, body):
    problems = []
    negative = path.startswith("/__site-quality-") or path.startswith("/blog/__site-quality-")
    expected = 404 if negative else 200
    if status != expected:
        problems.append(f"HTTP {status}; expected {expected}")
    if negative:
        if "html" not in content_type.lower():
            problems.append("Missing HTML 404 response")
        return problems
    if path.endswith(".xml"):
        try:
            root = ET.fromstring(body)
            if root.tag.split("}")[-1] not in {"urlset", "sitemapindex"}:
                problems.append("Response is not a sitemap")
        except ET.ParseError:
            problems.append("Invalid XML sitemap")
    elif path.endswith("robots.txt"):
        if b"Sitemap:" not in body:
            problems.append("robots.txt has no sitemap directive")
    else:
        if "html" not in content_type.lower():
            problems.append("Expected HTML, not JSON or plain text")
        page = Page(body)
        if not page.title or page.h1_count != 1:
            problems.append(f"Expected title and one h1 (title={page.title}, h1={page.h1_count})")
        if path.startswith("/blog/"):
            if page.json_ld_errors:
                problems.append("Blog article has invalid JSON-LD")
            if not {"Article", "BlogPosting", "NewsArticle"}.intersection(schema_types(page.json_ld)):
                problems.append("Blog article is missing Article, BlogPosting or NewsArticle structured data")
        if not page.canonical.startswith("https://metcalfsearch.com/"):
            problems.append("Canonical missing or not on production origin")
    if b"Blog template unavailable" in body:
        problems.append("Blog template unavailable error")
    return problems


def response_result(item, meta, body):
    result = dict(item, **meta, bytes=len(body), checked_at=datetime.now(timezone.utc).isoformat())
    result["problems"] = [] if "transport_error" in meta else inspect_response(item["path"], meta["status"], meta["content_type"], body)
    if meta.get("status") in (401, 403, 429):
        result["access_error"] = f"HTTP {meta['status']} prevents verification; investigate access/availability, without assuming a page-code defect"
    if "effective_url" in meta and urlsplit(meta["effective_url"]).netloc != urlsplit(item["origin"]).netloc:
        result["problems"].append("Unexpected redirect to a different origin: " + meta["effective_url"])
    return result


def verdict(result):
    if result.get("transport_error") or result.get("access_error"):
        return "BLOCKED"
    return "FAIL" if result["problems"] else "PASS"


def curl_get(url, timeout):
    with tempfile.TemporaryDirectory(prefix="metcalf-site-check-") as temp:
        target = Path(temp) / "body"
        command = ["curl", "--silent", "--show-error", "--location", "--max-redirs", "5",
                   "--connect-timeout", str(min(timeout, 10)), "--max-time", str(timeout),
                   "--output", str(target), "--write-out", "%{http_code}\n%{content_type}\n%{url_effective}\n",
                   "--user-agent", "MetcalfSiteQuality/1.0 (read-only)", url]
        try:
            proc = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 5)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"transport_error": str(exc)}, b""
        if proc.returncode:
            return {"transport_error": proc.stderr.strip() or f"curl exited {proc.returncode}"}, b""
        fields = proc.stdout.splitlines()
        if len(fields) < 3 or not fields[0].isdigit():
            return {"transport_error": "Unrecognized curl response metadata"}, b""
        return {"status": int(fields[0]), "content_type": fields[1], "effective_url": fields[2]}, target.read_bytes()


def make_plan(root, origins, extra_blogs):
    paths = {"/", "/blog", "/sitemap.xml", "/blog/sitemap.xml", "/robots.txt", "/stack", "/onboarding/"}
    for loc in ET.parse(root / "sitemap.xml").getroot().iter():
        if loc.tag.split("}")[-1] == "loc" and loc.text:
            paths.add(urlsplit(loc.text).path)
    paths.update(KNOWN_BLOG_PATHS)
    paths.update(extra_blogs)
    paths.update({"/__site-quality-not-a-real-page__", "/blog/__site-quality-not-a-real-post__"})
    cache_id = uuid.uuid4().hex
    return [{"origin": origin.rstrip("/"), "path": path, "mode": mode,
             "url": origin.rstrip("/") + path + ("?cb=" + cache_id if mode == "cache-busted" else "")}
            for origin in origins for path in sorted(paths) for mode in ("plain", "cache-busted")]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--origin", action="append", help="Override defaults; repeat to compare origins")
    parser.add_argument("--blog-path", action="append", default=[], help="Add another /blog/slug")
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--json", type=Path, help="Save evidence (status, bytes, URL, time, errors)")
    parser.add_argument("--dry-run", action="store_true", help="Print URL plan without network activity")
    args = parser.parse_args()
    for path in args.blog_path:
        if not re.fullmatch(r"/blog/[A-Za-z0-9_-]+", path):
            parser.error("--blog-path must be a path of the form /blog/slug")
    plan = make_plan(args.root, args.origin or DEFAULT_ORIGINS, args.blog_path)
    if args.dry_run:
        for item in plan:
            print(item["url"])
        print(f"{len(plan)} read-only GET requests planned.")
        return 0

    def check(item):
        meta, body = curl_get(item["url"], args.timeout)
        # Bodies are deliberately not saved: evidence should not capture personalized edge content.
        return response_result(item, meta, body)

    # An origin-level DNS/connection failure is blocked verification, not 31 broken pages.
    blocked_origins = {}
    for origin in dict.fromkeys(p["origin"] for p in plan):
        meta, _ = curl_get(origin + "/", args.timeout)
        if "transport_error" in meta:
            blocked_origins[origin] = meta["transport_error"]
    active = [p for p in plan if p["origin"] not in blocked_origins]
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        results = list(pool.map(check, active))
    for item in results:
        status = verdict(item)
        detail = item.get("transport_error") or item.get("access_error") or "; ".join(item["problems"]) or f"HTTP {item['status']}, {item['bytes']} bytes"
        print(f"{status} {item['url']} | {detail}")
    for origin, problem in blocked_origins.items():
        print(f"BLOCKED {origin} | {problem}")
    failed = sum(verdict(x) == "FAIL" for x in results)
    blocked = bool(blocked_origins) or any(verdict(x) == "BLOCKED" for x in results)
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "planned": len(plan), "checked": len(results),
              "response_failures": failed, "blocked_origins": blocked_origins, "results": results}
    print(f"Checked {len(results)}/{len(plan)} URLs; {failed} response failures; verification blocked={blocked}.")
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2) + "\n")
    return 2 if blocked else 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
