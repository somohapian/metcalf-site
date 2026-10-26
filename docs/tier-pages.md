# Tier pages, logo strip and embedded checkout (added 2026-10-25)

## The three sales pages
`recruiting-partner.html`, `recruiting-partner-plus.html`, `recruiting-partner-pro.html` are
generated, never hand-edited: `python3 scripts/build_tiers.py .` regenerates all three plus
`docs/snippets/client-strip.html`. Nav, footer, base CSS and scripts are cut byte for byte from
`services.html`, so a line-count change there needs the cut() ranges in the generator checked.
Prices live in one place in the generator (MONTHLY). Order of the page: hero with Activate
button, green capsule, checkout card (#checkout), logo strip, who it is for, what a month buys,
after you click, result and math, repeat CTA, three questions, billing terms.

## Checkout
Embedded Stripe Checkout (buyer never leaves). `functions/api/checkout.js` creates the session
from the PRICES map (one Stripe price id per tier); `functions/api/checkout-status.js` confirms a
session for the return page `/onboarding/?session_id=...` (GA4 purchase). The secret key is the
Cloudflare Pages variable `STRIPE_SECRET_KEY` (a restricted Stripe key: checkout sessions write,
customers write, prices and products read). The publishable key lives in the generator.

Price change procedure: create a NEW monthly price on the product in Stripe (never edit an old
one, existing subscribers are grandfathered), put the id in PRICES, change MONTHLY in the
generator, regenerate, then sweep the rest of the site for the old figures (index, services,
activate, fractional-recruiting, faq, source, llms.txt). The quality gate forbids a price key in
any JSON-LD Offer.

## Logo strip
`assets/clients/clients.js` is the list (name, file, display height, optional group);
`assets/clients/ticker.js` shuffles it, shows `data-show` logos (7), never two from the same
group (Keller Williams with Dream Home Team, Howard Hanna with Julie & Company), pauses on hover,
becomes a swipe row under 640px. To add a client: drop a single-color ink PNG (#1f2421 on
transparent, twice the display height) in `assets/clients/` and add one line to clients.js.
