import { loadBlogTemplate, renderIndexPage, withSecurityHeaders } from '../_lib/blog.js';
import { PUBLISHED_POSTS } from '../_lib/publications.js';

// Only explicitly reviewed publications belong on the public site.
// Do not reconnect the retired automatic blog feed.
export async function onRequestGet(context) {
  const template = await loadBlogTemplate(context);
  if (!template) return new Response('Blog template unavailable.', {
    status: 500,
    headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  });
  return new Response(renderIndexPage(template, { archive: PUBLISHED_POSTS }), {
    headers: withSecurityHeaders({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' })
  });
}
