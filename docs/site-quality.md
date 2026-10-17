# Site quality checks

Scope: Metcalf Search marketing pages, `/stack`, `/onboarding/`, and the Pages blog. Apply.ms is a separate product and is excluded. These checks never submit a form, make a purchase, send a message, or create an automation.

## Before publishing

From the repository root, run:

```sh
python3 scripts/site_quality.py
python3 -m unittest discover -s scripts -p 'test_quality_checks.py'
node --test functions/_lib/*.test.mjs
```

The source gate checks 22 root/onboarding HTML pages: tag balance, metadata length, canonical, single h1, JSON-LD validity, visible FAQ/schema equality, duplicate IDs, internal links and fragments, local assets, image alt, form/control names, viewport, mobile nav/CTA, footer facts, house style, sitemap/noindex and robots discovery. Classes without explicit selectors and mobile focus heuristics are warnings requiring review, not proof of a rendering defect. Blog function behavior has separate Node tests.

For a text-only GitHub snapshot, `--inventory ../repo-inventory.json` accepts a recursive tree inventory. It confirms binary assets exist in the source tree; it cannot validate those bytes. A full checkout should run without the inventory. `--json path.json` saves machine-readable evidence. The source gate exits 1 on errors and 0 otherwise; `--strict-warnings` also fails on warnings.

Visible FAQs can be extracted with `visible_faq(Document(source), relative_path)` from `site_quality.py`. It supports the homepage/STACK `details` markup, activation `faq-q`/`faq-a`, and FAQ-page h3/p pairs. Regenerate FAQPage data from those visible pairs when editing FAQs.

## After publishing and during monitoring

```sh
python3 scripts/live_site_smoke.py --json live-smoke.json
```

The live checker uses curl GET requests against production and `metcalf-site.pages.dev`, both with and without a cache buster. Default coverage is 124 requests: sitemap pages, two noindex utility routes, robots and both sitemaps, the five articles reported failing on October 17, and unknown page/article routes that must return a real 404. A plain request is essential: a cache-busted response can bypass an intercepted Worker route. The fixed article list is a regression baseline; add newly published articles with repeatable `--blog-path /blog/slug` options, and review intentionally retired articles before changing the baseline.

The checker verifies HTTP status, content type, title/h1/canonical, parsed blog JSON-LD (`Article`, `BlogPosting` or `NewsArticle`) and sitemap XML. The Python regression suite tests real daily and weekly HTML produced by the blog renderer from checked-in synthetic fixtures; Node must be available for that test (`METCALF_QA_NODE` can specify its executable). It records UTC timestamps, final URLs, response sizes and problems. It does not save response bodies. Exit codes: 0 passed; 1 response defects; 2 verification blocked by transport or access problems. HTTP 401, 403 and 429 are reported as blocked verification and warrant access/availability investigation on the marketing site. They do not establish a page-code defect or prove that careers pages or unrelated products are broken. `--dry-run` lists the URL plan without network calls; `--origin` can override the two default origins.

## Manual checks that remain necessary

- At narrow mobile and desktop widths, verify horizontal overflow, readable text, image/layout loading, sticky navigation, every CTA, and keyboard focus when opening/closing the mobile menu.
- Review real tier inclusions, arithmetic assumptions, timing, retention wording, privacy promises and contact information against the current business facts. Automated consistency cannot decide a commercial promise.
- Inspect form validation/error handling without submitting real leads or candidate details. Check external service health read-only.
- Confirm production uses the intended source commit, and record a changed marker plus response bytes for each edited page. Review both plain and cache-busted blog URLs.
- Review third-party requests and consent behavior in a browser. Source inspection cannot verify the behavior of an external endpoint or service.

## Initial baseline, October 17, 2026

Source snapshot: `95325587` on `main`. Source gate: 22 pages, zero errors, 23 warnings. The warnings were missing focus-management evidence in all 22 mobile modal menus and the pillar's `comp-row-label`, which is styled through its table ancestors. Footer contacts, visible/schema FAQ text, metadata, links and sitemaps passed. The two prior categories remain in `source-audit-initial.json` as historical evidence, not the latest gate result.

Shell-based live verification was blocked: curl could not resolve either origin. `live-smoke-initial.json` records zero checked requests, not a passing live audit. Fresh connector/browser evidence and the final post-deploy gate belong in the task's final ledger; do not call this initial result a successful deployment verification.
