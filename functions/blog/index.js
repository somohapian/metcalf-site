import { API_BASE, fetchJson, loadBlogTemplate, renderIndexPage, withSecurityHeaders } from '../_lib/blog.js';

const TTL = 300;

async function safeJson(url) {
  try {
    return await fetchJson(url, TTL);
  } catch (err) {
    return null;
  }
}

export async function onRequestGet(context) {
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

  // 2026-09-30: picks strip and recent-post rows retired with the auto blog; the page lists published posts only.
  const postsData = await safeJson(`${API_BASE}/posts?limit=100&offset=0`);

  const html = renderIndexPage(template, {
    archive: postsData && Array.isArray(postsData.posts) ? postsData.posts : []
  });

  return new Response(html, {
    headers: withSecurityHeaders({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300'
    })
  });
}
