import { API_BASE, fetchJson, renderPostPage, safeSlug, withSecurityHeaders } from '../_lib/blog.js';
import { onRequestGet as sitemapGet } from './sitemap.xml.js';

const TTL = 600;

async function loadTemplate(context) {
  const { request, env } = context;
  for (const path of ['/blog', '/blog.html']) {
    try {
      const response = await env.ASSETS.fetch(new URL(path, request.url));
      if (response.ok) {
        const html = await response.text();
        if (html.includes('<!--BLOG:PICKS-->')) return html;
      }
    } catch (err) { /* try the next path */ }
  }
  return null;
}

async function notFound(context) {
  const { request, env } = context;
  try {
    const response = await env.ASSETS.fetch(new URL('/404.html', request.url));
    if (response.ok) {
      const html = await response.text();
      return new Response(html, {
        status: 404,
        headers: withSecurityHeaders({
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        })
      });
    }
  } catch (err) { /* fall through to the plain-text 404 */ }
  // Deliberately fixed text: nothing from the request is echoed back.
  return new Response('Not found.', {
    status: 404,
    headers: withSecurityHeaders({
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    })
  });
}

export async function onRequestGet(context) {
  const { params, request } = context;
  const raw = params && params.slug;
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(Array.isArray(raw) ? raw.join('/') : (raw || '')));
  } catch (err) {
    // A malformed percent escape is not a post.
    return notFound(context);
  }
  const slug = decoded.trim();

  if (!slug || slug === 'index' || slug === 'index.html') {
    return Response.redirect(new URL('/blog', request.url).toString(), 301);
  }
  // Static routes normally win, but keep the sitemap working either way.
  if (slug === 'sitemap.xml') return sitemapGet(context);
  if (slug.length > 160 || safeSlug(slug) !== slug) return notFound(context);

  let post = null;
  try {
    post = await fetchJson(`${API_BASE}/posts/${encodeURIComponent(slug)}`, TTL);
  } catch (err) {
    post = null;
  }
  if (!post || !post.title) return notFound(context);

  const template = await loadTemplate(context);
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
