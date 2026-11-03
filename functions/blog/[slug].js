import { API_BASE, fetchJson, loadBlogTemplate, renderPostPage, safeSlug, withSecurityHeaders } from '../_lib/blog.js';
import { onRequestGet as sitemapGet } from './sitemap.xml.js';

const TTL = 600;

// Retired and unknown posts answer 410 Gone so search engines drop them fast.
// A transient upstream failure keeps the softer 404 so a live post is never
// marked gone by an outage.
async function errorPage(context, status) {
  const { request, env } = context;
  const headers = withSecurityHeaders({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex'
  });
  try {
    const response = await env.ASSETS.fetch(new URL('/404.html', request.url));
    if (response.ok) {
      const html = await response.text();
      return new Response(html, { status, headers });
    }
  } catch (err) { /* fall through to the plain-text body */ }
  // Deliberately fixed text: nothing from the request is echoed back.
  return new Response(status === 410 ? 'Gone.' : 'Not found.', {
    status,
    headers: Object.assign({}, headers, { 'content-type': 'text/plain; charset=utf-8' })
  });
}

const gone = (context) => errorPage(context, 410);
const notFound = (context) => errorPage(context, 404);

export async function onRequestGet(context) {
  const { params, request } = context;
  const raw = params && params.slug;
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(Array.isArray(raw) ? raw.join('/') : (raw || '')));
  } catch (err) {
    // A malformed percent escape is not a post.
    return gone(context);
  }
  const slug = decoded.trim();

  if (!slug || slug === 'index' || slug === 'index.html') {
    return Response.redirect(new URL('/blog', request.url).toString(), 301);
  }
  // Static routes normally win, but keep the sitemap working either way.
  if (slug === 'sitemap.xml') return sitemapGet(context);
  if (slug.length > 160 || safeSlug(slug) !== slug) return gone(context);

  let post = null;
  try {
    post = await fetchJson(`${API_BASE}/posts/${encodeURIComponent(slug)}`, TTL);
  } catch (err) {
    // The API answering 404 or 410 means the post is not published: gone.
    // Anything else (5xx, timeout, network) is transient: plain 404.
    const message = String(err && err.message || '');
    return /^upstream 4(04|10)$/.test(message) ? gone(context) : notFound(context);
  }
  if (!post || !post.title) return gone(context);

  const template = await loadBlogTemplate(context);
  if (!template) {
    return new Response('Blog template unavailable.', {
      status: 500,
      headers: withSecurityHeaders({
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      })
    });
  }

  const html = renderPostPage(template, Object.assign({}, post, { slug }));
  return new Response(html, {
    headers: withSecurityHeaders({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600'
    })
  });
}
