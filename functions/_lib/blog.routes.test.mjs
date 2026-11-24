/** Offline route regressions: node --test functions/_lib/*.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet as getPost } from '../blog/[slug].js';
import { onRequestGet as getIndex } from '../blog/index.js';
import { onRequestGet as getSitemap } from '../blog/sitemap.xml.js';
import { RETIRED_SLUGS, SECURITY_HEADERS } from './blog.js';
import { PUBLISHED_POSTS } from './publications.js';

const template = readFileSync(new URL('../../blog.html', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../../404.html', import.meta.url), 'utf8');
const futurePost = {
  slug: 'reviewed-hiring-guide', title: 'A reviewed hiring guide', author: 'jay',
  published_at: '2026-11-16', meta_description: 'A reviewed guide for hiring managers.',
  body: 'A practical guide with [the source](https://example.com/source).'
};
function context(slug, assetFetch = async (url) => new Response(
  new URL(url).pathname === '/404.html' ? notFound : template
)) {
  return { params: { slug },
    request: new Request(`https://metcalf-site.pages.dev/blog/${slug || ''}`),
    env: { ASSETS: { fetch: assetFetch } } };
}
function assertSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(name), value, name);
  assert.equal(response.headers.get('content-security-policy-report-only'), null);
}
function forbidUpstream(t) {
  const upstream = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Retired feed requested'); });
  t.after(() => assert.equal(upstream.mock.callCount(), 0, 'external fetch attempted'));
}
async function withApprovedPost(callback) {
  assert.deepEqual(PUBLISHED_POSTS, []);
  PUBLISHED_POSTS.push(futurePost);
  try { await callback(); } finally { PUBLISHED_POSTS.length = 0; }
}

test('empty approved list keeps all five guides and removes all article listings without upstream fetches', async (t) => {
  forbidUpstream(t);
  assert.deepEqual(PUBLISHED_POSTS, []);
  const response = await getIndex(context(''));
  assert.equal(response.status, 200);
  assertSecurityHeaders(response);
  const html = await response.text();
  assert.equal((html.match(/class="blog-guide-label">Guide/g) || []).length, 5);
  for (const guide of ['source', 'talk', 'assess', 'close', 'keep']) assert.ok(html.includes(`href="/${guide}"`));
  assert.ok(!html.includes('<!--BLOG:'));
  assert.ok(!/href="\/blog\/[^"#]+"/.test(html));
  assert.ok(!html.includes('Published articles'));
  assert.ok(!html.includes('<ul class="blog-post-list">'));
  const sitemap = await getSitemap();
  assertSecurityHeaders(sitemap);
  assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  const xml = await sitemap.text();
  assert.equal((xml.match(/<url>/g) || []).length, 1);
  assert.ok(xml.includes('<loc>https://metcalfsearch.com/blog</loc>'));
});

test('every retired, unapproved and invalid post returns 410 without external fetches', async (t) => {
  forbidUpstream(t);
  assert.ok(RETIRED_SLUGS.has('the-us-is-betting-on-ai-to-catch-insider-trading-in-prediction-markets'));
  assert.ok(RETIRED_SLUGS.has('executives-are-blaming-layoffs-on-ai-but-it-is-not-the-main-driver'));
  for (const slug of [...RETIRED_SLUGS, 'some-old-feed-post', futurePost.slug, '..%2fadmin', '%']) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 410, slug);
    assertSecurityHeaders(response);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(await response.text(), notFound);
  }
});

test('approved future publication renders, is indexed and appears in sitemap without external fetches', async (t) => {
  forbidUpstream(t);
  await withApprovedPost(async () => {
    const response = await getPost(context(futurePost.slug));
    assert.equal(response.status, 200);
    assertSecurityHeaders(response);
    const html = await response.text();
    assert.ok(html.includes(`<h1>${futurePost.title}</h1>`));
    assert.ok(html.includes(`href="https://metcalfsearch.com/blog/${futurePost.slug}"`));
    assert.ok(html.includes('"@type":"BlogPosting"'));
    assert.ok(html.includes('href="https://example.com/source"'));
    assert.ok(html.includes(template.match(/<nav class="topnav"[\s\S]*?<\/nav>/)[0]));
    assert.ok(html.includes(template.match(/<footer class="foot"[\s\S]*?<\/footer>/)[0]));
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(!html.includes('<!--BLOG:'));
    const index = await (await getIndex(context(''))).text();
    const sitemap = await (await getSitemap()).text();
    assert.ok(index.includes(`href="/blog/${futurePost.slug}"`));
    assert.ok(sitemap.includes(`/blog/${futurePost.slug}</loc>`));
    for (const slug of RETIRED_SLUGS) {
      assert.ok(!index.includes(`/blog/${slug}`));
      assert.ok(!sitemap.includes(`/blog/${slug}`));
    }
  });
});

test('index and approved article use the real template asset fallback', async (t) => {
  forbidUpstream(t);
  await withApprovedPost(async () => {
    for (const handler of [getIndex, getPost]) {
      const paths = [];
      const response = await handler(context(futurePost.slug, async (url) => {
        const path = new URL(url).pathname; paths.push(path);
        return path === '/blog' ? new Response('Unavailable', { status: 404 }) : new Response(template);
      }));
      assert.equal(response.status, 200);
      assertSecurityHeaders(response);
      assert.deepEqual(paths, ['/blog', '/blog.html']);
    }
  });
});

test('non-template assets fail explicitly for index and approved article', async (t) => {
  forbidUpstream(t);
  await withApprovedPost(async () => {
    for (const handler of [getIndex, getPost]) {
      const response = await handler(context(futurePost.slug, async () => new Response(notFound)));
      assert.equal(response.status, 500);
      assertSecurityHeaders(response);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(await response.text(), 'Blog template unavailable.');
    }
  });
});

test('retired post still returns Gone when the error-page asset is unavailable', async (t) => {
  forbidUpstream(t);
  const response = await getPost(context('old-post', async () => { throw new Error('asset outage'); }));
  assert.equal(response.status, 410);
  assertSecurityHeaders(response);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.equal(await response.text(), 'Gone.');
});

test('index aliases redirect and the slug sitemap route stays local', async (t) => {
  forbidUpstream(t);
  for (const slug of ['', 'index', 'index.html']) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://metcalf-site.pages.dev/blog');
  }
  const sitemap = await getPost(context('sitemap.xml'));
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<loc>https:\/\/metcalfsearch.com\/blog<\/loc>/);
});

test('/legacy-explainer returns 410 with the 404 page body', async (t) => {
  forbidUpstream(t);
  const { onRequest } = await import('../legacy-explainer.js');
  const response = await onRequest(context('legacy-explainer'));
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.equal(await response.text(), notFound);
});
