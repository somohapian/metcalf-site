# metcalf-site

Source of truth for **metcalfsearch.com**, the Metcalf Search marketing site.

- Static HTML, no build step. Repo root is the deploy root.
- Connected to Cloudflare Pages: every push to `main` deploys to production.
- Edits flow through the `metcalf-site-deploy` skill (mirror, edit, QA gate, commit).
- Blog posts are dynamic (fetched client-side) and are not files in this repo.

House rules for copy live in the skill: no em dashes, burden framing not fear framing, "a few hires per year," FAQ edits happen in both visible HTML and FAQPage JSON-LD.

## Security headers

Notesfor whoever edits this next.

Cloudflare Pages applies this file to STATIC ASSETS ONLY. Pages Functions
responses (/blog, /blog/<slug>, /blog/sitemap.xml) set the same headers in
code: see SECURITY_HEADERS in functions/_lib/blog.js. Change both together.
The /blogadmin* Worker route is a separate deployment and is not covered here.

The CSP is Report-Only on purpose. Every page carries inline <script> and
inline <style>, so enforcing it needs 'unsafe-inline', which buys almost
nothing. Path to enforcement, in order:
  1. Add a report-uri or report-to endpoint and watch real traffic for a week.
  2. Move the per-page inline scripts (gtag bootstrap, form handlers, the
     Calendly and Stripe boot code) into hashed or nonce'd blocks, and the
     inline style="" attributes into the existing page <style> blocks.
  3. Drop 'unsafe-inline' from script-src, then from style-src.
  4. Only then rename the header to Content-Security-Policy.

Strict-Transport-Security deliberately omits includeSubDomains and preload.
Add includeSubDomains only after confirming every metcalfsearch.com subdomain
(api, careers, ms-rosie, www, and anything added later) is HTTPS only, since
the directive is not reversible inside the max-age window.

X-Frame-Options DENY is safe here: the site embeds Stripe and Calendly, but
nothing embeds the site. Loosen to SAMEORIGIN only if that changes.
