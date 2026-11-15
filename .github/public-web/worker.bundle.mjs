// Generated from llms.txt; verified byte-for-byte by tests.
export const LLMS_TEXT = "# MS Rosie by Metcalf Search\n\n## What is this site?\n\napply.ms is the public home of MS Rosie, hiring software for small businesses from Metcalf Search. It also hosts companies' careers pages and public job listings.\n\nMS Rosie keeps applicants, resumes, notes and next steps together. MS Rosie Starter is free with one user and one active role. The paid MS Rosie plan adds up to five users, unlimited active roles, a careers page designed for the company, interview scorecards and candidate write-ups. The plans page has current pricing and details.\n\nThe root introduces the software and its plans. Help explains how it works, and the public samples show an interview scorecard, a candidate write-up and an offer letter. Samples are illustrative documents, not real applicants or open jobs.\n\n## Product, help and samples\n\n- MS Rosie: https://apply.ms/\n- Plans: https://apply.ms/#plan\n- Help: https://apply.ms/help/\n- Recruiting experience behind MS Rosie: https://apply.ms/help/experience/\n- Sample interview scorecard: https://apply.ms/help/samples/scorecard/\n- Sample candidate write-up: https://apply.ms/help/samples/candidate-writeup/\n- Sample offer letter: https://apply.ms/help/samples/offer-letter/\n- Release notes: https://apply.ms/blog/\n- Public roadmap: https://apply.ms/roadmap/\n\n## About Metcalf Search\n\nMetcalf Search is Jay Metcalf's fractional recruiting firm, based in Columbus, Ohio. It provides recruiting support for small and mid-sized businesses on a flat monthly fee instead of per-hire commissions. MS Rosie software and fractional recruiting are separate offers.\n\n- Metcalf Search: https://metcalfsearch.com/\n- Fractional recruiting: https://metcalfsearch.com/fractional-recruiting\n- For job seekers: https://metcalfsearch.com/candidates\n- About the firm: https://metcalfsearch.com/about\n\n## Careers pages and job listings\n\nEach published company careers page describes that company's opportunities. The root is the MS Rosie product page, not a combined job board. Account pages and applicant records are private and are not public recruiting content.\n\n- Public page and job listing sitemap: https://apply.ms/sitemap.xml\n";


export const PUBLIC_URLS = Object.freeze([
  'https://apply.ms/',
  'https://apply.ms/help/',
  'https://apply.ms/help/experience/',
  'https://apply.ms/help/samples/scorecard/',
  'https://apply.ms/help/samples/candidate-writeup/',
  'https://apply.ms/help/samples/offer-letter/',
]);
export const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
const CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

export function isOwnedRequest(request) {
  const u = new URL(request.url);
  if (u.origin !== 'https://apply.ms' || !['GET', 'HEAD'].includes(request.method)) return false;
  // Deliberately do not decode aliases or accept lookalike names.
  if (u.pathname.includes('%') || u.pathname.includes('//')) return false;
  return ['/sitemap.xml', '/llms.txt'].includes(u.pathname);
}

function xmlText(text) {
  if (/[<\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(text) || text.includes(']]>')) throw Error('Invalid XML text');
  return text.replace(/&([^;]*);|&/g, (whole, entity) => {
    const predefined = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(predefined, entity)) return predefined[entity];
    if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity || '')) throw Error('Invalid entity');
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    if (!(n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff))) throw Error('Invalid character');
    return String.fromCodePoint(n);
  });
}

// A deliberately strict recognizer for the origin's simple sitemap dialect.
// Any unsupported XML (including extension namespaces, comments and DTDs) is
// returned untouched. Accepted documents are never reserialized.
export function augmentSitemap(xml) {
  try {
    if (new TextEncoder().encode(xml).length > MAX_SITEMAP_BYTES) return null;
    const root = /^(?:\ufeff)?(?:<\?xml version=(?:"1\.0"|'1\.0')(?: encoding=(?:"UTF-8"|'UTF-8'))?\?>[ \t\r\n]*)?<urlset[ \t\r\n]+xmlns=(?:"http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"|'http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9')[ \t\r\n]*>([\s\S]*)<\/urlset>[ \t\r\n]*$/.exec(xml);
    if (!root) return null;
    const inner = root[1];
    const urls = new Set();
    const item = /[ \t\r\n]*<url>([\s\S]*?)<\/url>/y;
    let cursor = 0;
    let count = 0;
    while (cursor < inner.length && !(/^[ \t\r\n]*$/).test(inner.slice(cursor))) {
      item.lastIndex = cursor;
      const match = item.exec(inner);
      if (!match || ++count > 50000) return null;
      cursor = item.lastIndex;
      const fields = new Map();
      const field = /[ \t\r\n]*<(loc|lastmod|changefreq|priority)>([^<]*)<\/\1>/y;
      let offset = 0;
      while (offset < match[1].length && !(/^[ \t\r\n]*$/).test(match[1].slice(offset))) {
        field.lastIndex = offset;
        const part = field.exec(match[1]);
        if (!part || fields.has(part[1])) return null;
        fields.set(part[1], xmlText(part[2]).trim());
        offset = field.lastIndex;
      }
      const loc = fields.get('loc');
      if (!loc || /\s/.test(loc) || !/^https?:\/\//.test(loc)) return null;
      new URL(loc); // Reject malformed absolute locations; preserve all valid hosts.
      urls.add(loc);
    }
    const missing = PUBLIC_URLS.filter(url => !urls.has(url));
    if (count + missing.length > 50000) return null;
    if (!missing.length) return xml;
    // No invented lastmod dates. Original entries and timestamps stay byte-for-byte.
    const addition = missing.map(url => `  <url>\n    <loc>${url}</loc>\n  </url>\n`).join('');
    return xml.slice(0, xml.lastIndexOf('</urlset>')) + addition + xml.slice(xml.lastIndexOf('</urlset>'));
  } catch {
    return null;
  }
}

function marketingHeaders(headers) {
  const out = new Headers(headers);
  out.set('Strict-Transport-Security', 'max-age=86400');
  out.set('X-Content-Type-Options', 'nosniff');
  out.set('X-Frame-Options', 'DENY');
  out.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // A second CSP policy intersects with any original policy; it never removes it.
  out.append('Content-Security-Policy', CSP);
  return out;
}

function changedMetadataHeaders(headers, type) {
  const out = marketingHeaders(headers);
  for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified', 'Content-MD5', 'Digest', 'Content-Digest', 'Repr-Digest', 'Accept-Ranges', 'Content-Range', 'Age', 'CF-Cache-Status']) out.delete(name);
  out.set('Content-Type', type);
  out.set('Cache-Control', 'no-store');
  out.set('CDN-Cache-Control', 'no-store');
  out.set('Cloudflare-CDN-Cache-Control', 'no-store');
  return out;
}

async function boundedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > MAX_SITEMAP_BYTES) { void reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(all);
}

export async function handle(request, originFetch = fetch) {
  if (!isOwnedRequest(request)) return originFetch(request);
  const path = new URL(request.url).pathname;
  const metadata = path === '/sitemap.xml' || path === '/llms.txt';
  let upstream = request;
  if (metadata) {
    const headers = new Headers(request.headers);
    for (const name of ['If-None-Match', 'If-Modified-Since', 'Range', 'If-Range']) headers.delete(name);
    headers.set('Cache-Control', 'no-cache');
    upstream = new Request(request, { method: 'GET', headers, redirect: 'manual', cache: 'no-store' });
  } else if (request.redirect !== 'manual') {
    upstream = new Request(request, { redirect: 'manual' });
  }
  const original = await originFetch(upstream);
  let body = original.body;
  let headers = marketingHeaders(original.headers);
  // Do not turn redirects, errors or partial content into synthetic success.
  if (metadata && original.status === 200) {
    const type = (original.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    let replacement = null;
    if (path === '/llms.txt' && type === 'text/plain') replacement = LLMS_TEXT;
    if (path === '/sitemap.xml' && ['application/xml', 'text/xml'].includes(type)) {
      try {
        const probe = original.clone();
        body = original.body; // clone() tees/replaces the original stream.
        const xml = await boundedText(probe);
        if (xml !== null) replacement = augmentSitemap(xml);
      } catch { /* Invalid encoding, unreadable or unsupported XML: retain origin. */ }
    }
    if (replacement !== null) {
      void original.body?.cancel();
      body = replacement;
      headers = changedMetadataHeaders(original.headers, path === '/llms.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8');
    }
  }
  return new Response(request.method === 'HEAD' ? null : body, {
    status: original.status, statusText: original.statusText, headers,
  });
}

export default { fetch: request => handle(request) };
