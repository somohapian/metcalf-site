# Public metadata edge service

Initially prepared as an unattached local candidate. The parent subsequently activated Worker `apply-public-metadata`, version `d8287a86`, on the two metadata routes below. This subtask performed no deployment or configuration writes. Independent anonymous HTTP verification is recorded in `live-verification.json` with raw public captures under `live/`.

Live verification passed: sitemap 91 to 97 entries, all original bytes before the insertion and the closing suffix preserved, all original entries in order, exactly six intended additions returning 200, llms exact candidate bytes, query and HEAD metadata checks, expected root-query/help headers, unchanged lookalike 404 and unchanged public client page compared with the direct Pages origin. No product hostname, application endpoint, private record or database was queried. The parent separately deployed the public header Transform Rule; its observed CSP also includes `upgrade-insecure-requests`.

## Separation and scope

`worker.mjs` handles only HTTPS GET/HEAD requests whose origin is exactly `https://apply.ms` and whose pathname is exactly `/sitemap.xml` or `/llms.txt`. Everything else passes through using the original Request and Response. No secret, account binding, storage binding, alternate origin, fixed copy of the tenant sitemap, application route, or product service is used.

The active route patterns are `https://apply.ms/sitemap.xml*` and `https://apply.ms/llms.txt*` only. These cover query strings; their extra suffix matches are rejected by the exact pathname guard. Never attach `apply.ms/*`, `rosie.apply.ms/*`, or a Worker Custom Domain. `wrangler.json` deliberately has empty routes and disabled public previews. Deployment verification confirmed in the Cloudflare dashboard that apply.ms currently points to proxied `careers-eiq.pages.dev`, with existing Worker routes only for `apply.ms/apply/*` and `rosie.apply.ms/*`. Recheck route ownership immediately before activation.

Public HTML security headers belong in a separate response-header Transform Rule with exact hostname and bounded owned marketing path conditions. This avoids sending the HTML site through a Worker and handles root query strings. This package's Worker also adds the same minimum headers to its metadata responses. Do not append a duplicate CSP in the Transform Rule; setting the intended minimum policy there is appropriate only after verifying no stronger existing policy would be replaced.

## Behavior

- Fetch the current origin sitemap on every request with cache `no-store`, remove conditional/range validators, and require a 200 XML response. Preserve every original byte and append only missing root, help, experience and the three named sample URLs. No new `lastmod` is fabricated. Existing entries, duplicates and timestamps are retained.
- Recognize only the origin's ordinary UTF-8 XML sitemap dialect: default sitemap namespace, `url` entries and plain-text `loc`, `lastmod`, `changefreq`, `priority` fields. Reject malformed XML and leave valid-but-unsupported XML unchanged (extension namespaces, DTDs, comments, alternate XML declarations). This is intentional fail-safe behavior, not a general XML processor. Responses over 5 MiB, invalid UTF-8, wrong content types, errors, redirects and partial responses are also unchanged apart from scoped security headers.
- Replace a successful plain-text `/llms.txt` response with the exact approved candidate from `work/audit-holes/metadata/candidate/v4/app/assets/careers/llms.txt`. The source and generated JS text are checked for equality.
- Preserve status, status text, Location, Set-Cookie, unrelated headers and request credentials. Do not follow redirects. HEAD performs the same origin GET and validation but returns no body. Metadata transformation removes old representation validators, encoding and length and uses `no-store` at browser and CDN layers. There is no Cache API, KV, or persistent state that could retain a stale tenant inventory.
- Minimum CSP: `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. It adds no `script-src`, `default-src`, `frame-src`, or `connect-src`, so it does not restrict Stripe or script loading. An existing CSP is retained and the minimum policy appended. Other headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=86400`.

HSTS is intrinsically hostname-wide after any response is observed, even if the header is only emitted on these paths. The one-day value intentionally omits `includeSubDomains` and `preload`; it does not affect rosie.apply.ms. Removing the route cannot erase a browser's already-cached HSTS until expiry. This is the only persistent browser effect.

## Verification and activation

Run `node --test test/worker.test.mjs` from this directory. Tests use the existing captured public sitemap as a fixture; they do not contact production. They cover exact scope, all original entries, idempotence, XML entities, malformed XML, unsupported XML, size/encoding fallback, cookies, redirects, validators, no-store requests, origin changes between calls, HEAD, errors and inactive configuration. These tests run on Node Fetch APIs; they do not establish Cloudflare runtime or Pages routing behavior.

For a future deployment, capture the current live metadata and owned-page response headers plus current route/rule definitions. Upload this Worker without routes; confirm its module bindings and syntax using Cloudflare's deployment tooling. Attach only the two metadata routes after confirming there is still no competing route. Immediately compare the live sitemap against the fresh preactivation origin capture: every original loc and entry must remain, six public URLs must exist exactly as intended, and client-role URLs must remain byte-identical. Verify both GET and HEAD, query strings, no-store, llms exact bytes, redirects, and representative tenant/application responses unchanged. Test the scoped header Transform Rule separately, including root with a query, a help/sample, blog, roadmap, client page, application path and rosie hostname. Do not mark resolved if the platform bypasses Pages or returns an error.

Rollback: remove only the two new route records (or restore their exact prior assignments if any existed), then disable only the new response-header rule. The Pages site and protected publisher remain untouched. Delete the unused new Worker after confirming normal origin metadata is restored. A Worker-only version rollback does not remove routes; use the recorded route state. Existing browser/CDN caches may need exact-URL purge during activation or rollback; do not purge or modify the product host or client assets broadly.

## Primary platform references

- [Workers routes and same-zone fetch](https://developers.cloudflare.com/workers/configuration/routing/routes/): routes run before an origin; another route Worker is not a same-zone fetch target. Route matching includes query strings and requires a suffix wildcard to cover them.
- [Workers Request API](https://developers.cloudflare.com/workers/runtime-apis/request/): `no-store` is supported; manual redirect handling avoids forwarding credentials to redirect destinations.
- [Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/): adding a Pages custom domain with an existing Worker route is restricted. This candidate does not add or replace a Pages domain, but the actual existing Pages-origin behavior still needs live verification.

No alternative origin hostname, service binding to Rosie, broad route or protected-metadata publisher bypass is an acceptable fallback if this layer fails.

## Live acceptance on 2026-11-15

Live sitemap increased from 91 to 97 URLs with every existing entry preserved. The AI summary exactly matches llms.txt. Public marketing headers are active as a separate Transform Rule. The obsolete metcalf-search.pages.dev origin permanently redirects to metcalfsearch.com, preserving path suffix and query string, without modifying the frozen Pages project. See live-config.json for configuration and rollback identifiers.
