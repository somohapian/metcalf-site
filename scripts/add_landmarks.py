#!/usr/bin/env python3
"""Add/check static main landmarks and first-focusable skip links on firm pages.

Run with --write after page edits; default is a read-only check. Uses the stdlib,
preserves original HTML bytes except required tags, and refuses ambiguous markup.
Dynamic blog post and tier generators must also retain these semantics.
"""
from __future__ import annotations

import argparse
from collections import Counter
from html import escape
from html.parser import HTMLParser
from pathlib import Path

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.lines = [0]
        for line in source.splitlines(keepends=True):
            self.lines.append(self.lines[-1] + len(line))
        self.nodes = []
        self.stack = []
        self.feed(source)
        self.close()
        if self.stack:
            raise ValueError('Unclosed tags: ' + ', '.join(n['tag'] for n in self.stack))

    def source_offset(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def handle_starttag(self, tag, attrs):
        start = self.source_offset()
        node = dict(tag=tag, attrs=dict(attrs), start=start,
                    open_end=start + len(self.get_starttag_text()),
                    parent=self.stack[-1] if self.stack else None)
        self.nodes.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            node = self.stack.pop()
            node['end'] = node['open_end']

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1]['tag'] != tag:
            raise ValueError('Unbalanced closing tag: ' + tag)
        self.stack.pop()['end'] = self.source.index('>', self.source_offset()) + 1

    def find(self, tag):
        return [n for n in self.nodes if n['tag'] == tag]


def has_class(node, name):
    return name in node['attrs'].get('class', '').split()


def skip_links(doc):
    return [n for n in doc.find('a') if has_class(n, 'skip-link') or has_class(n, 'home-skip')]


def focusable(node):
    attrs = node['attrs']
    if 'hidden' in attrs or 'disabled' in attrs:
        return False
    if 'tabindex' in attrs:
        return int(attrs['tabindex']) >= 0
    return ((node['tag'] == 'a' and 'href' in attrs)
            or node['tag'] in {'button', 'select', 'textarea', 'summary', 'iframe'}
            or (node['tag'] == 'input' and attrs.get('type') != 'hidden'))


def validate(source):
    doc = Document(source)
    ids = Counter(n['attrs']['id'] for n in doc.nodes if 'id' in n['attrs'])
    if any(count > 1 for count in ids.values()):
        raise ValueError('Duplicate IDs: ' + ', '.join(key for key, count in ids.items() if count > 1))
    mains = doc.find('main')
    if len(mains) != 1:
        raise ValueError('Expected exactly one main landmark')
    main = mains[0]
    if not main['attrs'].get('id') or main['attrs'].get('tabindex') != '-1':
        raise ValueError('Main needs an ID and tabindex="-1"')
    skips = skip_links(doc)
    if len(skips) != 1 or skips[0]['attrs'].get('href') != '#' + main['attrs']['id']:
        raise ValueError('Expected one skip link targeting main')
    first = next((n for n in doc.nodes if focusable(n)), None)
    if first is not skips[0]:
        raise ValueError('Skip link must be first focusable element')
    for node in doc.nodes:
        inside = main['open_end'] <= node['start'] < main['end']
        if node['tag'] == 'h1' and not inside:
            raise ValueError('Main must contain the page heading')
        if inside and (has_class(node, 'topnav') or has_class(node, 'foot')):
            raise ValueError('Repeated site navigation/footer must be outside main')
    return doc


def with_landmarks(source):
    doc = Document(source)
    mains = doc.find('main')
    bodies = doc.find('body')
    if len(bodies) != 1 or len(mains) > 1:
        raise ValueError('Expected one body and at most one existing main')
    body = bodies[0]
    edits = []
    ids = {n['attrs'].get('id') for n in doc.nodes}
    if mains:
        main = mains[0]
        target = main['attrs'].get('id')
        additions = ''
        if not target:
            target = 'main-content'
            if target in ids:
                raise ValueError('main-content ID is already in use')
            additions += ' id="main-content"'
        if 'tabindex' not in main['attrs']:
            additions += ' tabindex="-1"'
        if additions:
            edits.append((main['open_end'] - 1, additions))
    else:
        target = 'main-content'
        if target in ids:
            raise ValueError('main-content ID is already in use')
        navs = [n for n in doc.find('nav') if has_class(n, 'topnav') and n['parent'] is body]
        footers = [n for n in doc.find('footer') if has_class(n, 'foot') and n['parent'] is body]
        if len(navs) != 1 or len(footers) != 1 or navs[0]['end'] >= footers[0]['start']:
            raise ValueError('Expected one top-level site nav followed by one footer')
        edits.extend([(navs[0]['end'], '\n<main id="main-content" tabindex="-1">'),
                      (footers[0]['start'], '</main>\n')])
    skips = skip_links(doc)
    if not skips:
        edits.append((body['open_end'], '\n<a class="skip-link" href="#' + escape(target, quote=True) + '">Skip to main content</a>'))
    for offset, content in sorted(edits, reverse=True):
        source = source[:offset] + content + source[offset:]
    validate(source)
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--write', action='store_true', help='Apply missing landmarks after validating every page')
    args = parser.parse_args()
    pages = sorted(args.root.glob('*.html')) + sorted((args.root / 'onboarding').glob('*.html'))
    if not pages:
        parser.error('No firm pages found')
    changes = []
    for page in pages:
        source = page.read_text(encoding='utf-8')
        try:
            updated = with_landmarks(source)
        except ValueError as error:
            raise SystemExit(f'{page}: {error}')
        if updated != source:
            changes.append((page, updated))
    if args.write:
        for page, updated in changes:
            page.write_text(updated, encoding='utf-8')
    print(f'{len(pages)} pages validated; {len(changes)} ' + ('updated.' if args.write else 'need updates.'))
    if changes and not args.write:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
