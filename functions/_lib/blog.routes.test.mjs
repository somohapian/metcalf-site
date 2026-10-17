/** Handler regression tests. Run with: node --test functions/_lib/*.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet as getPost } from '../blog/[slug].js';
import { onRequestGet as getIndex } from '../blog/index.js';
import { API_BASE } from './blog.js';

const template = readFileSync(new URL('../../blog.html', import.meta.url), 'utf8');
const notFound = readFileSync(new URL('../../404.html', import.meta.url), 'utf8');
const publishedSlugs = [
  'ep-794-can-automation-make-hiring-more-human',
  'cloudflare-s-matthew-prince-says-ai-has-made-a-category-of-workers-obsolete',
  'growing-tribe-of-jobless-techies-is-stuck-in-silicon-valley-s-new-reality',
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

test('all five published article routes accept the current archive-only template', async (t) => {
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
    assert.deepEqual(paths, ['/blog', '/blog.html']);
  }
});

test('a non-template asset fails explicitly instead of rendering the wrong page', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(postFor(publishedSlugs[0])));
  for (const handler of [getIndex, getPost]) {
    const response = await handler(context(publishedSlugs[0], async () => new Response(notFound)));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'Blog template unavailable.');
  }
});

test('missing and invalid posts still return 404 with security headers', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 404 }));
  for (const slug of ['missing-post', '..%2fadmin', '%']) {
    const response = await getPost(context(slug));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  assert.equal(upstream.mock.callCount(), 1, 'invalid slugs must not reach the API');
});
