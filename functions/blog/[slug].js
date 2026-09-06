import { API_BASE, fetchJson, renderPostPage } from '../_lib/blog.js';
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
    const html = await response.text();
    return new Response(html, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch (err) {
    return new Response('Not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
}

export async function onRequestGet(context) {
  const { params, request } = context;
  const raw = params && params.slug;
  const slug = decodeURIComponent(String(Array.isArray(raw) ? raw.join('/') : (raw || ''))).trim();

  if (!slug || slug === 'index' || slug === 'index.html') {
    return Response.redirect(new URL('/blog', request.url).toString(), 301);
  }
  // Static routes normally win, but keep the sitemap working either way.
  if (slug === 'sitemap.xml') return sitemapGet(context);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) return notFound(context);

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
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const html = renderPostPage(template, Object.assign({ slug }, post));
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=600'
    }
  });
}
