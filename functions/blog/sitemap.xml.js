import { API_BASE, fetchJson, renderSitemap, withSecurityHeaders } from '../_lib/blog.js';

const TTL = 3600;
const PAGE = 500;
const MAX_PAGES = 10;

async function loadAllPosts() {
  const posts = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let data = null;
    try {
      data = await fetchJson(`${API_BASE}/posts?limit=${PAGE}&offset=${offset}`, TTL);
    } catch (err) {
      break;
    }
    const batch = data && Array.isArray(data.posts) ? data.posts : [];
    if (!batch.length) break;
    posts.push(...batch);
    const total = data && Number.isFinite(Number(data.total)) ? Number(data.total) : posts.length;
    offset += batch.length;
    if (posts.length >= total) break;
  }
  return posts;
}

export async function onRequestGet() {
  const posts = await loadAllPosts();
  return new Response(renderSitemap(posts), {
    headers: withSecurityHeaders({
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600'
    })
  });
}
