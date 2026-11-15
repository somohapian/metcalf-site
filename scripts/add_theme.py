#!/usr/bin/env python3
"""Idempotently add the shared theme to firm pages (exclude Apply.ms and snippets)."""
import re
import sys
from pathlib import Path

INIT = '<script src="/assets/theme-init.js"></script>'
STYLE = '<link rel="stylesheet" href="/assets/theme.css?v=20261115-public3">'
CONTROL = '<script src="/assets/theme.js?v=20261114-footer1" defer></script>'

def with_theme(source):
    # Remove prior tags first so their position remains correct after page edits.
    source = re.sub(r'<link rel="stylesheet" href="/assets/theme\.css(?:\?v=[^"]*)?">\n?', "", source)
    for tag in (INIT, STYLE, CONTROL, '<link rel="stylesheet" href="/assets/theme.css?v=20261115-public3">', '<link rel="stylesheet" href="/assets/theme.css">', '<script src="/assets/theme.js" defer></script>'):
        source = source.replace(tag + '\n', '').replace(tag, '')
    source, count = re.subn(r'(<meta name="viewport"[^>]*>)', lambda m: m[1] + '\n' + INIT, source, count=1)
    if count != 1:
        raise ValueError('Expected a viewport meta tag')
    if source.count('</head>') != 1 or source.count('</body>') != 1:
        raise ValueError('Expected one head and one body')
    return source.replace('</head>', STYLE + '\n</head>').replace('</body>', CONTROL + '\n</body>')

if __name__ == '__main__':
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    pages = sorted(root.glob('*.html')) + [root / 'onboarding/index.html']
    for page in pages:
        previous = page.read_text(encoding='utf-8')
        updated = with_theme(previous)
        if previous != updated:
            page.write_text(updated, encoding='utf-8')
    print(f'Theme tags checked on {len(pages)} firm pages.')
