# metcalf-site

Source of truth for **metcalfsearch.com**, the Metcalf Search marketing site.

- Static HTML, no build step. Repo root is the deploy root.
- Connected to Cloudflare Pages: every push to `main` deploys to production.
- Edits flow through the `metcalf-site-deploy` skill (mirror, edit, QA gate, commit).
- Blog posts are dynamic (fetched client-side) and are not files in this repo.

House rules for copy live in the skill: no em dashes, burden framing not fear framing, "a few hires per year," FAQ edits happen in both visible HTML and FAQPage JSON-LD.
