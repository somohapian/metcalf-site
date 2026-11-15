import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handle, isOwnedRequest, augmentSitemap, PUBLIC_URLS, MAX_SITEMAP_BYTES } from '../worker.mjs';
import { LLMS_TEXT } from '../llms-content.mjs';

const fixture = await readFile(new URL('./fixtures/sitemap.xml', import.meta.url), 'utf8');
const req = (path, init = {}) => new Request(`https://apply.ms${path}`, init);
const wrap = contents => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${contents}</urlset>`;
const entry = url => `<url><loc>${url}</loc></url>`;
const xmlResponse = (body = fixture, extra = {}) => new Response(body, { headers: { 'Content-Type': 'application/xml', ...extra } });

test('only explicitly owned host, methods and path families', () => {
  for (const path of ['/sitemap.xml', '/sitemap.xml?x=1', '/llms.txt', '/llms.txt?version=2']) {
    for (const method of ['GET', 'HEAD']) assert.equal(isOwnedRequest(req(path, { method })), true, path);
  }
  for (const path of ['/', '/?utm_source=test', '/help/', '/help/experience/', '/blog/x/', '/roadmap/', '/help', '/helpful/', '/helpx/', '/blogger/', '/roadmapper/', '/ericson/', '/ericson/role/apply/', '/api/', '/signin/', '/sitemap.xml.bak', '/llms.txt/extra', '/HELP/', '/help/%2fapi', '/help//x']) assert.equal(isOwnedRequest(req(path)), false, path);
  for (const url of ['https://rosie.apply.ms/', 'https://apply.ms.evil.test/', 'http://apply.ms/', 'https://apply.ms:8443/', 'https://metcalfsearch.com/']) assert.equal(isOwnedRequest(new Request(url)), false, url);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal(isOwnedRequest(req('/help/', { method })), false, method);
});

test('six additions preserve every existing byte, entry, timestamp and order; idempotent', () => {
  const result = augmentSitemap(fixture);
  const suffix = fixture.slice(fixture.lastIndexOf('</urlset>'));
  assert.ok(result.startsWith(fixture.slice(0, fixture.lastIndexOf('</urlset>'))));
  assert.ok(result.endsWith(suffix));
  assert.equal((result.match(/<url>/g) || []).length, (fixture.match(/<url>/g) || []).length + 6);
  for (const url of PUBLIC_URLS) assert.ok(result.includes(`<loc>${url}</loc>`));
  assert.equal(augmentSitemap(result), result);
  assert.equal((result.match(/<lastmod>/g) || []).length, (fixture.match(/<lastmod>/g) || []).length);
});

test('exact URL dedupe includes entities but does not confuse host/path prefixes', () => {
  const source = wrap(entry('https://apply.ms/help/') + entry('https://apply.ms/helpx/') + entry('https://apply.ms/help/?a=1&amp;b=2') + entry('https://other.test/') + entry('https://apply.ms/&#104;elp/experience/'));
  const result = augmentSitemap(source);
  assert.ok(result.startsWith(source.slice(0, -9)));
  assert.equal((result.match(/<url>/g) || []).length, 9);
  assert.equal((result.match(/<loc>https:\/\/apply\.ms\/help\/<\/loc>/g) || []).length, 1);
});

test('invalid or unsupported XML never produces a replacement', () => {
  const invalid = [
    '', '<html>oops</html>', '<urlset/>', wrap('<url><loc>https://apply.ms/x/</url>'),
    wrap(entry('https://apply.ms/?a=1&b=2')), wrap(entry('https://apply.ms/&#0;')),
    wrap(entry('https://apply.ms/&#xD800;')), wrap(entry('https://apply.ms/&unknown;')),
    wrap(entry('https://apply.ms/\u0001')), wrap(entry('https://apply.ms/\ud800')),
    wrap('\u00a0'), wrap('<url>\u00a0<loc>https://apply.ms/</loc></url>'),
    wrap(entry('https://apply.ms/]]>')), wrap(entry('relative/path')),
    wrap('<url><loc>https://apply.ms/</loc><loc>https://apply.ms/x</loc></url>'),
    wrap('<url><loc>https://apply.ms/</loc></url><junk/>'),
    wrap('not xml'), wrap('<!-- supported by XML, deliberately not this dialect -->'),
    '<!DOCTYPE urlset SYSTEM "https://evil.test/x">' + wrap(''),
    wrap('').replace('xmlns="http', "xmlns='http"),
    '<?xml version="1.0\'?>' + wrap(''),
    wrap(entry('https://apply.ms/')) + '<extra/>',
    wrap('<url><loc>https://apply.ms/</loc><image:image>x</image:image></url>'),
    wrap(' '.repeat(MAX_SITEMAP_BYTES)),
  ];
  for (const source of invalid) assert.equal(augmentSitemap(source), null, source.slice(0, 150));
});

test('out-of-scope is exact passthrough with original request and response identity', async () => {
  for (const request of [req('/ericson/'), req('/help/', { method: 'POST', body: 'payload' }), new Request('https://rosie.apply.ms/')]) {
    const original = new Response('unchanged', { status: 202, headers: { 'Set-Cookie': 'sid=abc; HttpOnly', 'Cache-Control': 'private' } });
    const result = await handle(request, async received => { assert.equal(received, request); return original; });
    assert.equal(result, original);
  }
});

test('marketing keeps body, status, cookies, cache, redirects and existing policy', async () => {
  const cookies = ['a=1; HttpOnly; Secure', 'b=2; Expires=Wed, 21 Oct 2027 07:28:00 GMT'];
  const headers = new Headers({ 'Content-Type': 'text/html', 'Cache-Control': 'private, max-age=30', 'Content-Security-Policy': "script-src 'self' https://js.stripe.com", 'Location': '/help/' });
  cookies.forEach(c => headers.append('Set-Cookie', c));
  const result = await handle(req('/sitemap.xml'), async received => {
    assert.equal(received.redirect, 'manual');
    return new Response('redirect body', { status: 308, statusText: 'Permanent Redirect', headers });
  });
  assert.equal(result.status, 308);
  assert.equal(result.statusText, 'Permanent Redirect');
  assert.equal(await result.text(), 'redirect body');
  assert.equal(result.headers.get('Location'), '/help/');
  assert.deepEqual(result.headers.getSetCookie(), cookies);
  assert.equal(result.headers.get('Cache-Control'), 'private, max-age=30');
  assert.equal(result.headers.get('Strict-Transport-Security'), 'max-age=86400');
  assert.equal(result.headers.get('X-Frame-Options'), 'DENY');
  assert.ok(result.headers.get('Content-Security-Policy').includes("script-src 'self' https://js.stripe.com"));
  assert.ok(result.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'; base-uri 'self'; object-src 'none'"));
});

test('sitemap fetch disables stale cache, removes conditional/range headers, preserves auth/cookies', async () => {
  let calls = 0;
  const result = await handle(req('/sitemap.xml?x=1', { headers: { 'If-None-Match': 'old', 'If-Modified-Since': 'yesterday', Range: 'bytes=0-1', 'If-Range': 'old', Cookie: 'a=1', Authorization: 'Bearer example' } }), async request => {
    calls++;
    assert.equal(request.url, 'https://apply.ms/sitemap.xml?x=1');
    assert.equal(request.cache, 'no-store');
    assert.equal(request.redirect, 'manual');
    assert.equal(request.headers.get('Cookie'), 'a=1');
    assert.equal(request.headers.get('Authorization'), 'Bearer example');
    for (const h of ['If-None-Match', 'If-Modified-Since', 'Range', 'If-Range']) assert.equal(request.headers.has(h), false);
    return xmlResponse(fixture, { ETag: 'old', 'Last-Modified': 'yesterday', 'Content-Length': '3', 'Content-Encoding': 'gzip', 'Accept-Ranges': 'bytes', 'Content-Digest': 'old', 'Cache-Control': 'max-age=99999', 'Set-Cookie': 'a=2; Secure' });
  });
  assert.equal(calls, 1);
  assert.equal(await result.text(), augmentSitemap(fixture));
  for (const h of ['ETag', 'Last-Modified', 'Content-Length', 'Content-Encoding', 'Accept-Ranges', 'Content-Digest']) assert.equal(result.headers.has(h), false, h);
  for (const h of ['Cache-Control', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) assert.equal(result.headers.get(h), 'no-store');
  assert.equal(result.headers.get('Set-Cookie'), 'a=2; Secure');
});

test('metadata origin errors, redirects, invalid XML and unexpected types are preserved', async () => {
  for (const [status, body, type] of [[503, 'unavailable', 'application/xml'], [302, 'redirect', 'application/xml'], [206, 'partial', 'application/xml'], [200, '<urlset>invalid', 'application/xml'], [200, '<html>login</html>', 'text/html']]) {
    const result = await handle(req('/sitemap.xml'), async () => new Response(body, { status, headers: { 'Content-Type': type, ETag: 'original', Location: '/other', 'Set-Cookie': 'a=b' } }));
    assert.equal(result.status, status);
    assert.equal(await result.text(), body);
    assert.equal(result.headers.get('ETag'), 'original');
    assert.equal(result.headers.get('Location'), '/other');
    assert.equal(result.headers.get('Set-Cookie'), 'a=b');
  }
  const invalidEncoding = new Uint8Array([0xff, 0xfe, 0xff]);
  const result = await handle(req('/sitemap.xml'), async () => xmlResponse(invalidEncoding));
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), invalidEncoding);
});

test('HEAD validates same metadata representation and emits no body', async () => {
  for (const path of ['/sitemap.xml', '/llms.txt']) {
    const response = await handle(req(path, { method: 'HEAD' }), async request => {
      assert.equal(request.method, 'GET');
      return path === '/sitemap.xml' ? xmlResponse() : new Response('old', { headers: { 'Content-Type': 'text/plain', ETag: 'old' } });
    });
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.has('ETag'), false);
  }
});

test('llms exact approved text; future origin changes visible on every sitemap fetch', async () => {
  assert.equal(LLMS_TEXT, await readFile(new URL('../llms.txt', import.meta.url), 'utf8'));
  const result = await handle(req('/llms.txt'), async () => new Response('old', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  assert.equal(await result.text(), LLMS_TEXT);
  let call = 0;
  const origin = async () => xmlResponse(wrap(entry(`https://apply.ms/client-${++call}/`)));
  assert.ok((await (await handle(req('/sitemap.xml'), origin)).text()).includes('client-1'));
  const second = await (await handle(req('/sitemap.xml'), origin)).text();
  assert.ok(second.includes('client-2'));
  assert.ok(!second.includes('client-1'));
});

test('candidate config cannot attach public routes or previews by accident', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.routes, []);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  for (const binding of ['kv_namespaces', 'r2_buckets', 'services', 'durable_objects', 'd1_databases']) assert.equal(config[binding], undefined);
});

test('oversized origin is preserved and UTF-8 BOM is retained', async () => {
  const large = wrap(' '.repeat(MAX_SITEMAP_BYTES));
  const failed = await handle(req('/sitemap.xml'), async () => xmlResponse(large, { ETag: 'large' }));
  assert.equal(await failed.text(), large);
  assert.equal(failed.headers.get('ETag'), 'large');
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(wrap(''))]);
  const result = await handle(req('/sitemap.xml'), async () => xmlResponse(bom));
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()).slice(0, 3), bom.slice(0, 3));
});

test('null-body statuses and llms errors remain status-correct', async () => {
  for (const status of [204, 304]) {
    const result = await handle(req('/llms.txt'), async () => new Response(null, { status }));
    assert.equal(result.status, status);
    assert.equal(await result.text(), '');
  }
  const result = await handle(req('/llms.txt'), async () => new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } }));
  assert.equal(result.status, 404);
  assert.equal(await result.text(), 'not found');
});
