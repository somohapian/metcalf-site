# November 14 review changes

Status: review version 8, with the final Behavioral Bridge addition prepared in source. Production publication is pending. Baseline main commit: `fbad4f7cdbc67b83f7557fde9d550ed281f8b7de`. This document records the proposed source changes; it does not establish that either production domain has been updated.

## Homepage and marketing copy

The homepage now gives visitors three useful starting points: practical STACK guides, MS Rosie for running their own hiring, and a recruiter to handle the search. Conversation and plan-selection links remain prominent. Jay’s approved portrait supports the recruiting-team section.

Body copy across the firm site is shorter and more specific. Service explanations describe the work, help text gives a clear next step, and checkout prompts use plain language. Existing prices, plan scope, checkout destinations, forms, and original anchor IDs remain intact. Recruiting timing is presented as a planning estimate where appropriate rather than an unconditional result.

## Search questions and hiring guides

The homepage, FAQ, fractional recruiting guide, and five STACK guides retain their question counts: 67 questions across eight pages. The answers have been revised, so the earlier claim that all FAQ copy and guide bodies were untouched is no longer correct. FAQPage data is generated from the visible answers and checked for exact agreement.

The fractional recruiting guide names Metcalf’s current $2,950, $5,950, and $10,950 monthly plans, distinguishes service scope from terminology, and uses explicit assumptions for cost comparisons. Unsupported general market prices and categorical comparisons have been removed. Tempo includes time-to-hire and time-to-fill definitions, calculations, and practical follow-up guidance. Keep has been rewritten around keeping new and established employees productive, satisfied, and engaged. It teaches Stay connected, Make work better, and Follow through; separates work performance from whether the person wants to stay; and covers recognition, growth, both people’s responsibilities, and checking whether actions helped. The Rosie implementation is explicitly in development. Summaries in the homepage, services, STACK overview, fractional guide, tier pages, generator and llms.txt agree without expanding contracted service scope. Source, Assess, and Close explain practical decisions without presenting hypothetical examples as client outcomes. Selected descriptions now tell search visitors what help the page offers; the existing fractional guide title and primary keyword remain.

Assess now includes Jay’s Behavioral Bridge under Can: ask about a specific prior experience, identify the transferable skill, apply it to a concrete task in the proposed job, and ask what must change. The dispatcher example is explicitly illustrative. Jay’s statement that this is harder to fake is attributed to his professional experience, not presented as a scientific finding. Will, Fit, and Locus remain distinct. The existing nine Assess questions, page structure, IDs, and links are preserved.

## Biography and proof

The biography preserves the approved portrait, upright name treatment, Columbus positioning, and approved career history. IntelliCap is dated 2004–2009, Barracuda December 2012–January 2016, and the current Metcalf Search role from December 2024. Role dates are not an incorporation claim. Barracuda is named alongside the approved $10M+ figure without adding an annual-period qualifier.

The baker anecdote sits in the story before Jay’s signed note. The book section is compact and links to updates. The page separates recruiting help from the option to use Rosie yourself.

Recommendations no longer rotate while someone reads them. The page contains twelve approved quote-and-attribution pairs. JavaScript chooses two once per page load and leaves them static; without JavaScript, two fallback cards remain visible. Exact quote text stays with its attribution. The LinkedIn source link remains available. An inert video template makes no requests and creates no public placeholder or teaser.

Client logos remain a separate component with a persistent desktop Pause/Play control and the existing reduced-motion and mobile behavior. Client-story collection remains future work. `docs/client-story-draft.md` is an empty editorial worksheet, not a testimonial or proof claim.

## Source maintenance and unchanged behavior

The tier generator extracts shared markup using stable boundaries. Its copy now reproduces all three current tier pages and the client-strip snippet byte for byte, including the revised timing and cancellation language. Generation was tested in a temporary directory; the check did not overwrite source HTML.

The checkout handlers, blog rendering and route handlers, legacy 410 handler, and `_redirects` match the baseline byte for byte. Existing form markup is unchanged. The 404 page has shared presentation updates; its role as the response body for missing and retired routes is covered by route tests. Prices, Stripe identifiers, and checkout destinations remain unchanged.

The new portrait is available as WebP, with the original PNG retained. Small footer text has stronger contrast. Unsupported provisional Book publication metadata was removed. Article dates and relevant sitemap dates reflect the content edits. The source gate accepts the approved Columbus location on Jay’s profile while retaining other location checks.

## Verification before production

- Source gate: 26 marketing/utility pages, zero errors, one existing `comp-row-label` styling warning. Evidence: `docs/revision-source-audit.json`.
- Python regression suite: 10 tests passed using the cached Python runtime and explicit Node executable.
- Node suite: 44 tests passed, covering blog rendering, missing and retired article routes, the legacy 410 route, checkout request handling, and client-logo selection/pause behavior.
- Recommendation check: 100 deterministic page-load selections preserved complete quote/author pairs, selected two unique static cards, varied the selection, and retained the two-card no-JavaScript fallback. No carousel controls remain.
- Tier regeneration: all three pages and the client-strip snippet reproduced byte for byte in an isolated temporary directory.
- Baseline comparison: no existing form markup changed; checkout, redirect, blog, and 410 handlers are unchanged. Earlier integration checks preserved existing page URLs and anchor IDs.
- Source review found no credential-pattern matches or private research/transcript files in the proposed site source. Public Stripe publishable identifiers are not secret keys. Local `__pycache__` files are test byproducts and must be excluded from the publication package.

The assembled review has 31 HTML pages. The recorded static review check found 1,438 local references with no missing target or fragment, exact FAQ agreement, two visible fallback quotes, and no public video placeholder. That check applies to its recorded snapshot; refresh the review and repeat it after the final Behavioral Bridge addition or any later assembly changes.

No real lead form, candidate form, or checkout was submitted in these checks. Production still requires reconciliation against current main, publication, and live verification. The review site is separate from both production domains.
