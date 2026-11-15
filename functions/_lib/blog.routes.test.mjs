/** Handler regression tests. Run with: node --test functions/_lib/*.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet as getPost } from '../blog/[slug].js';
import { onRequestGet as getIndex } from '../blog/index.js';
import { API_BASE, RETIRED_SLUGS, SECURITY_HEADERS } from './blog.js';
import { onRequestGet as getSitemap } from '../blog/sitemap.xml.js';

function assertSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value, name);
  }
  assert.equal(response.headers.get('content-security-policy-report-only'), null);
}

const template = readFileSync(new URL('../../blog.html', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../../404.html', import.meta.url), 'utf8');
const retiredSlugs = [
  'ep-794-can-automation-make-hiring-more-human',
  'cloudflare-s-matthew-prince-says-ai-has-made-a-category-of-workers-obsolete',
  'growing-tribe-of-jobless-techies-is-stuck-in-silicon-valley-s-new-reality'
];
const publishedSlugs = [
  'the-us-is-betting-on-ai-to-catch-insider-trading-in-prediction-markets',
  'executives-are-blaming-layoffs-on-ai-but-it-is-not-the-main-driver'
];

// Synthetic payloads deliberately isolate the route/template contract from
// the external Worker's content. The real source template is never mocked.
const postFor = (slug) => ({
  slug, title: 'Hiring news for small businesses', author: 'jay',
  published_at: '2026-06-05', body: 'A hiring update with practical next steps.'
});

function context(slug, assetFetch = async (url) => new Response(
  new URL(url).pathname === '/404.html' ? notFound : template
)) {
  return {
    params: { slug },
    request: new Request(`https://metcalf-site.pages.dev/blog/${slug || ''}`),
    env: { ASSETS: { fetch: assetFetch } }
  };
}

test('the published article routes accept the current archive-only template', async (t) => {
  assert.ok(template.includes('<!--BLOG:ARCHIVE-->'));
  assert.ok(!template.includes('<!--BLOG:PICKS-->'), 'retired picks must not be required');
  const upstream = t.mock.method(globalThis, 'fetch', async (request) => {
    const slug = new URL(request.url).pathname.split('/').pop();
    assert.equal(new URL(request.url).origin, API_BASE);
    return Response.json(postFor(slug));
  });
  for (const slug of publishedSlugs) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 200, slug);
    assertSecurityHeaders(response);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.ok(html.includes(`href="https://metcalfsearch.com/blog/${slug}"`));
    assert.ok(html.includes('"@type":"BlogPosting"'));
    assert.ok(html.includes(template.match(/<nav class="topnav"[\s\S]*?<\/nav>/)[0]));
    assert.ok(html.includes(template.match(/<footer class="foot"[\s\S]*?<\/footer>/)[0]));
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(!html.includes('<!--BLOG:'));
  }
  assert.equal(upstream.mock.callCount(), publishedSlugs.length);
});

test('index and article use the same template, including the asset fallback', async (t) => {
  const slug = publishedSlugs[0];
  t.mock.method(globalThis, 'fetch', async (request) => Response.json(
    new URL(request.url).pathname === '/posts'
      ? { posts: [postFor(slug)] } : postFor(slug)
  ));
  for (const handler of [getIndex, getPost]) {
    const paths = [];
    const response = await handler(context(slug, async (url) => {
      const path = new URL(url).pathname;
      paths.push(path);
      return path === '/blog' ? new Response('Unavailable', { status: 404 }) : new Response(template);
    }));
    assert.equal(response.status, 200);
    assertSecurityHeaders(response);
    assert.deepEqual(paths, ['/blog', '/blog.html']);
  }
});

test('a non-template asset fails explicitly instead of rendering the wrong page', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(postFor(publishedSlugs[0])));
  for (const handler of [getIndex, getPost]) {
    const response = await handler(context(publishedSlugs[0], async () => new Response(notFound)));
    assert.equal(response.status, 500);
    assertSecurityHeaders(response);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'Blog template unavailable.');
  }
});

test('retired, missing and invalid posts return 410 Gone with the 404 page body', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 404 }));
  for (const slug of ['waymo-halts-robotaxi-service-over-flood-detection', '..%2fadmin', '%']) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 410, slug);
    assertSecurityHeaders(response);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    const html = await response.text();
    assert.equal(html, notFound);
    assert.match(html, /<meta name="robots" content="noindex/);
  }
  assert.equal(upstream.mock.callCount(), 1, 'invalid slugs must not reach the API');
});

test('an upstream outage stays a 404, never 410', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('down', { status: 503 }));
  const response = await getPost(context('some-live-post'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
});

test('/legacy-explainer returns 410 Gone with the 404 page body', async () => {
  const { onRequest } = await import('../legacy-explainer.js');
  const response = await onRequest({
    request: new Request('https://metcalf-site.pages.dev/legacy-explainer'),
    env: { ASSETS: { fetch: async () => new Response(notFound) } }
  });
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.equal(await response.text(), notFound);
});

test('hand-retired posts return 410 without calling the API', async (t) => {
  assert.deepEqual([...RETIRED_SLUGS].sort(), [...retiredSlugs].sort());
  const upstream = t.mock.method(globalThis, 'fetch', async (request) =>
    Response.json(postFor(new URL(request.url).pathname.split('/').pop())));
  for (const slug of retiredSlugs) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 410, slug);
    assertSecurityHeaders(response);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(await response.text(), notFound);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('hand-retired posts are left out of the /blog index and the blog sitemap', async (t) => {
  const all = [...retiredSlugs, ...publishedSlugs].map(postFor);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ posts: all, total: all.length }));
  const indexHtml = await (await getIndex(context(''))).text();
  const sitemapResponse = await getSitemap();
  assertSecurityHeaders(sitemapResponse);
  assert.match(sitemapResponse.headers.get('content-type'), /application\/xml/);
  const sitemap = await sitemapResponse.text();
  for (const slug of retiredSlugs) {
    assert.ok(!indexHtml.includes(`/blog/${slug}`), `index lists ${slug}`);
    assert.ok(!sitemap.includes(`/blog/${slug}`), `sitemap lists ${slug}`);
  }
  for (const slug of publishedSlugs) {
    assert.ok(indexHtml.includes(`/blog/${slug}`), `index drops ${slug}`);
    assert.ok(sitemap.includes(`/blog/${slug}<`), `sitemap drops ${slug}`);
  }
});
