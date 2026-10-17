#!/usr/bin/env python3
"""Read-only source gate for Metcalf Search marketing pages (Python stdlib only).

Run from any directory. Apply.ms product/test pages are deliberately excluded.
An optional GitHub tree inventory supports audits of text-only source snapshots;
it proves a referenced asset is in the tree, not that its bytes are valid.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict, dataclass, field
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import posixpath
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET

ORIGIN = "https://metcalfsearch.com"
VOID = set("area base br col embed hr img input link meta param source track wbr".split())
INVISIBLE = {"head", "script", "style", "template", "svg"}
CLASS_EXCEPTIONS = {"q-text", "recent-card"}  # ancestor selectors / inline styles


def normalize(text):
    return re.sub(r"\s+", " ", unescape(text)).strip()


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    line: int = 0
    parent: "Node | None" = None
    children: list = field(default_factory=list)

    def all(self, tag=None):
        for child in self.children:
            if isinstance(child, Node):
                if tag is None or child.tag == tag:
                    yield child
                yield from child.all(tag)

    def text(self, visible=False):
        if visible and (self.tag in INVISIBLE or self.attrs.get("aria-hidden") == "true" or "hidden" in self.attrs):
            return ""
        return "".join(c.text(visible) if isinstance(c, Node) else c for c in self.children)

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def ancestors(self):
        current = self.parent
        while current:
            yield current
            current = current.parent


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]
        self.balance = []
        self.feed(source)
        self.close()
        self.balance.extend((n.line, "Unclosed <" + n.tag + ">") for n in self.stack[1:])
        self.nodes = list(self.root.all())

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.getpos()[0], self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in VOID:
            self.balance.append((self.getpos()[0], "Void element has closing tag: " + tag))
            return
        if self.stack[-1].tag == tag:
            self.stack.pop()
            return
        self.balance.append((self.getpos()[0], "Unexpected </" + tag + ">; open element is <" + self.stack[-1].tag + ">"))
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


@dataclass
class Issue:
    severity: str
    file: str
    line: int
    check: str
    message: str


def schema_objects(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from schema_objects(item)
    elif isinstance(value, list):
        for item in value:
            yield from schema_objects(item)


def visible_faq(doc, path):
    """Return visible FAQ question/answer pairs, usable to regenerate FAQ schema."""
    pairs = []
    for node in doc.nodes:
        if node.has_class("faq-q"):
            answer = next((n for n in node.parent.all() if n.has_class("faq-a")), None)
            if answer:
                pairs.append((normalize(node.text(True)), normalize(answer.text(True)), node.line))
        if node.tag != "details":
            continue
        summary = next(node.all("summary"), None)
        answer = next((n for n in node.all() if n.has_class("faq-answer")), None)
        if summary and answer:
            pairs.append((normalize(summary.text(True)), normalize(answer.text(True)), summary.line))
    if path == "faq.html":
        for node in doc.nodes:
            if node.tag != "h3":
                continue
            siblings = node.parent.children
            following = [n for n in siblings[siblings.index(node) + 1:] if isinstance(n, Node)]
            if following and following[0].tag == "p":
                pairs.append((normalize(node.text(True)), normalize(following[0].text(True)), node.line))
    return pairs


def route_for(path):
    if path == "index.html":
        return "/"
    if path.endswith("/index.html"):
        return "/" + path[:-10]
    return "/" + path.removesuffix(".html")


def audit(root, inventory=None):
    issues = []
    pages = {p.relative_to(root).as_posix(): p for p in sorted(root.glob("*.html"))}
    onboarding = root / "onboarding/index.html"
    if onboarding.exists():
        pages["onboarding/index.html"] = onboarding
    known = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and ".git" not in p.parts}
    if inventory:
        tree = json.loads(inventory.read_text())
        if isinstance(tree, dict):
            tree = tree.get("tree", [])
        known.update(n["path"] for n in tree if n.get("type") == "blob")
    docs = {name: Document(path.read_text()) for name, path in pages.items()}
    noindex = set()

    def add(name, check, message, line=0, severity="ERR"):
        issues.append(Issue(severity, name, line, check, message))

    def resolve(url, name):
        absolute = urlsplit(urljoin(ORIGIN + route_for(name), url))
        if absolute.scheme not in ("http", "https") or absolute.netloc not in ("metcalfsearch.com", "www.metcalfsearch.com"):
            return None, None
        target = posixpath.normpath(unquote(absolute.path)).lstrip("/")
        choices = ["index.html"] if target in ("", ".") else [target, target + ".html", target.rstrip("/") + "/index.html"]
        match = next((p for p in choices if p in known), None)
        if not match and re.fullmatch(r"blog/(?:[^/]+|sitemap\.xml)", target):
            return "@dynamic-blog", absolute.fragment
        return match or "@missing:" + absolute.path, absolute.fragment

    for name, doc in docs.items():
        source = pages[name].read_text()
        for line, problem in doc.balance:
            add(name, "tag-balance", problem, line)
        if "cdn-cgi" in source:
            add(name, "edge-artifact", "Source contains cdn-cgi; do not edit edge-modified HTML.")
        titles = [n for n in doc.nodes if n.tag == "title" and not any(p.tag == "svg" for p in n.ancestors())]
        if len(titles) != 1 or not 1 <= len(normalize(titles[0].text())) <= 62:
            add(name, "title", "Require one nonempty title <=62 characters; lengths=" + str([len(normalize(n.text())) for n in titles]))
        metas = {n.attrs.get("name", "").lower(): n.attrs.get("content", "") for n in doc.nodes if n.tag == "meta"}
        description = metas.get("description", "")
        if not 70 <= len(description) <= 165:
            add(name, "description", f"Meta description is {len(description)} characters; expected 70..165.")
        if "noindex" in metas.get("robots", "").lower():
            noindex.add(name)
        canonical = [n.attrs.get("href", "") for n in doc.nodes if n.tag == "link" and "canonical" in n.attrs.get("rel", "").split()]
        expected = ORIGIN + route_for(name)
        if name != "404.html" and canonical != [expected]:
            add(name, "canonical", f"Expected canonical {expected}; got {canonical}.")
        h1s = [n for n in doc.nodes if n.tag == "h1"]
        if len(h1s) != 1:
            add(name, "h1", f"Expected exactly one h1, found {len(h1s)}.")
        ids = Counter(n.attrs["id"] for n in doc.nodes if "id" in n.attrs)
        for value, count in ids.items():
            if count > 1:
                add(name, "duplicate-id", f"id={value!r} appears {count} times.")
        for n in doc.nodes:
            attrs = ["href"] if n.tag in {"a", "link"} else ["src"] if n.tag in {"img", "script", "iframe", "source"} else []
            for attr in attrs:
                url = n.attrs.get(attr, "")
                if not url:
                    continue
                target, fragment = resolve(url, name)
                if target and target.startswith("@missing:"):
                    add(name, "internal-target", f"Missing {attr} target: {url}", n.line)
                elif target in docs and fragment and unquote(fragment) not in {x.attrs.get("id") for x in docs[target].nodes}:
                    add(name, "hash-target", f"Missing fragment target: {url}", n.line)
            if n.tag == "img" and "alt" not in n.attrs:
                add(name, "image-alt", "Image needs alt (empty alt is valid for decorative images).", n.line)
            if n.tag == "iframe" and not n.attrs.get("title"):
                add(name, "iframe-title", "Iframe lacks a title.", n.line)
            if n.tag in {"input", "select", "textarea"} and n.attrs.get("type", "").lower() not in {"hidden", "submit", "button", "reset"}:
                wrap = any(p.tag == "label" for p in n.ancestors())
                linked = n.attrs.get("id") and any(x.tag == "label" and x.attrs.get("for") == n.attrs["id"] for x in doc.nodes)
                if not (wrap or linked or n.attrs.get("aria-label") or n.attrs.get("aria-labelledby")):
                    add(name, "form-label", f"Form control lacks a label: {n.attrs.get('name', n.tag)}", n.line)
            if n.tag == "button" and not (normalize(n.text(True)) or n.attrs.get("aria-label") or n.attrs.get("aria-labelledby")):
                add(name, "button-name", "Button lacks an accessible name.", n.line)
            if n.attrs.get("aria-labelledby"):
                for label_id in n.attrs["aria-labelledby"].split():
                    if label_id not in ids:
                        add(name, "aria-target", f"aria-labelledby references missing id {label_id}.", n.line)
        text = normalize(doc.root.text(True))
        if "—" in text:
            add(name, "house-style", "Visible copy contains an em dash.")
        jargon = re.findall(r"\b(?:engagements?|pods?|leaf|THE ICP|THE PILLAR|TODO|lorem ipsum|dispartnership|re-partnership)\b", text, re.I)
        if jargon:
            add(name, "house-style", "Review banned copy / placeholder: " + ", ".join(sorted(set(jargon))))
        if "width=device-width" not in metas.get("viewport", ""):
            add(name, "viewport", "Responsive viewport is missing.")
        if "@media" not in source:
            add(name, "responsive-css", "No responsive media query found; visually review mobile layout.", severity="WARN")
        nav = [n for n in doc.nodes if n.has_class("nav-cta")]
        if not nav or any(n.attrs.get("href") != "/contact" or normalize(n.text()) != "Start a Conversation" for n in nav):
            add(name, "nav-cta", "Nav CTA must say Start a Conversation and link to /contact.")
        footers = [n for n in doc.nodes if n.tag == "footer"]
        if footers:
            footer = footers[-1]
            footer_text = normalize(footer.text(True))
            footer_links = {n.attrs.get("href") for n in footer.all("a")}
            if "© 2026 Metcalf Search. Grove City, Ohio." not in footer_text:
                add(name, "footer-facts", "Footer needs the canonical 2026 company/location line.", footer.line)
            for link in ("mailto:info@metcalfsearch.com", "tel:+16144346646", "/contact", "/stack-method", "https://apply.ms/"):
                if link not in footer_links:
                    add(name, "footer-links", "Footer is missing canonical link: " + link, footer.line)
        if "hamburger-btn" not in source:
            add(name, "mobile-nav", "No mobile menu found.")
        elif "aria-modal" in source and not (".focus(" in source and ("Tab" in source or "inert" in source)):
            add(name, "mobile-focus", "Modal mobile menu needs focus entry, containment and return; verify in browser.", severity="WARN")
        css = "\n".join(n.text() for n in doc.nodes if n.tag == "style")
        styled = set(re.findall(r"\.([A-Za-z_][\w-]*)", css))
        missing_classes = {c for n in doc.nodes if not n.attrs.get("style") for c in n.attrs.get("class", "").split() if c not in styled and c not in CLASS_EXCEPTIONS}
        if missing_classes:
            add(name, "class-style", "No explicit class selector found (may inherit styling): " + ", ".join(sorted(missing_classes)), severity="WARN")
        if "capsule" in missing_classes:
            add(name, "capsule-style", "The capsule class requires its CSS rule.")
        faq_schema = []
        for n in doc.nodes:
            if n.tag != "script" or n.attrs.get("type") != "application/ld+json":
                continue
            try:
                data = json.loads(n.text())
            except (ValueError, TypeError) as exc:
                add(name, "json-ld", str(exc), n.line)
                continue
            for value in schema_objects(data):
                typ = value.get("@type", "")
                if typ == "FAQPage" or isinstance(typ, list) and "FAQPage" in typ:
                    faq_schema.extend(value.get("mainEntity", []))
                if typ == "Offer" and any("price" in obj for obj in schema_objects(value)):
                    add(name, "schema-offer", "Do not publish tier prices as JSON-LD Offers.", n.line)
        visible = visible_faq(doc, name)
        if faq_schema:
            observed = {normalize(n.get("name", "")): normalize(n.get("acceptedAnswer", {}).get("text", "")) for n in faq_schema}
            actual = {q: a for q, a, _ in visible}
            for question in observed.keys() - actual.keys():
                add(name, "faq-schema", "Schema question missing from visible FAQ: " + question)
            for question, answer, line in visible:
                if question not in observed:
                    add(name, "faq-schema", "Visible FAQ missing in schema: " + question, line)
                elif observed[question] != answer:
                    add(name, "faq-schema", "FAQ answer differs from schema: " + question, line)
        elif visible:
            add(name, "faq-schema", "Visible FAQ has no FAQPage schema.", severity="WARN")

    sitemap_routes = set()
    try:
        sitemap = ET.parse(root / "sitemap.xml")
        for url in sitemap.getroot():
            loc = next((n.text for n in url if n.tag.endswith("}loc") or n.tag == "loc"), "")
            if loc in sitemap_routes:
                add("sitemap.xml", "duplicate-url", "Duplicate URL: " + loc)
            sitemap_routes.add(loc)
            target, _ = resolve(loc, "index.html")
            if target not in docs:
                add("sitemap.xml", "sitemap-target", "Unresolved marketing page: " + loc)
            elif target in noindex:
                add("sitemap.xml", "sitemap-noindex", "Noindex page is listed: " + loc)
    except (ET.ParseError, OSError) as exc:
        add("sitemap.xml", "sitemap-xml", str(exc))
    for name in docs:
        if name not in noindex and ORIGIN + route_for(name) not in sitemap_routes:
            add(name, "sitemap-coverage", "Indexable page is absent from sitemap.xml.")
    for name in ("404.html", "stack.html", "onboarding/index.html"):
        if name in docs and name not in noindex:
            add(name, "noindex", "This utility page must be noindex.")
    robots = (root / "robots.txt").read_text() if (root / "robots.txt").exists() else ""
    for url in (ORIGIN + "/sitemap.xml", ORIGIN + "/blog/sitemap.xml"):
        if url not in robots:
            add("robots.txt", "sitemap-discovery", "Missing Sitemap directive: " + url)
    return issues, len(docs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--inventory", type=Path, help="Optional GitHub recursive tree JSON for an incomplete local snapshot")
    parser.add_argument("--json", type=Path, help="Write machine-readable results")
    parser.add_argument("--strict-warnings", action="store_true")
    args = parser.parse_args()
    issues, count = audit(args.root.resolve(), args.inventory)
    totals = Counter(i.severity for i in issues)
    for issue in issues:
        print(f"{issue.severity} {issue.file}:{issue.line} [{issue.check}] {issue.message}")
    print(f"Checked {count} marketing/utility pages: {totals['ERR']} ERR, {totals['WARN']} WARN. Apply.ms excluded.")
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({"pages": count, "errors": totals["ERR"], "warnings": totals["WARN"], "issues": [asdict(i) for i in issues]}, indent=2) + "\n")
    return 1 if totals["ERR"] or args.strict_warnings and totals["WARN"] else 0


if __name__ == "__main__":
    sys.exit(main())
