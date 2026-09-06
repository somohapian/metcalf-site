import { API_BASE, fetchJson, renderIndexPage, selectPicks } from '../_lib/blog.js';

const TTL = 300;

async function loadTemplate(context) {
  const { request, env } = context;
  // Pages resolves the extensionless asset; fall back to the file itself.
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

async function safeJson(url) {
  try {
    return await fetchJson(url, TTL);
  } catch (err) {
    return null;
  }
}

export async function onRequestGet(context) {
  const template = await loadTemplate(context);
  if (!template) {
    return new Response('Blog template unavailable.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const [picksData, rosieData, weeklyData, postsData] = await Promise.all([
    safeJson(`${API_BASE}/picks`),
    safeJson(`${API_BASE}/posts/recent?author=rosie&days=7`),
    safeJson(`${API_BASE}/posts/recent?author=jay&days=30`),
    safeJson(`${API_BASE}/posts?limit=100&offset=0`)
  ]);

  const html = renderIndexPage(template, {
    weekStart: picksData && picksData.week_start ? picksData.week_start : '',
    picks: selectPicks(picksData && picksData.picks ? picksData.picks : []),
    rosie: rosieData && Array.isArray(rosieData.posts) ? rosieData.posts : [],
    weekly: weeklyData && Array.isArray(weeklyData.posts) ? weeklyData.posts : [],
    archive: postsData && Array.isArray(postsData.posts) ? postsData.posts : []
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300'
    }
  });
}
