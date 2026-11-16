import { renderSitemap, withSecurityHeaders } from '../_lib/blog.js';
import { PUBLISHED_POSTS } from '../_lib/publications.js';

export async function onRequestGet() {
  return new Response(renderSitemap(PUBLISHED_POSTS), {
    headers: withSecurityHeaders({
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300'
    })
  });
}
