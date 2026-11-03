import { withSecurityHeaders } from './_lib/blog.js';

// /legacy-explainer is retired for good: 410 Gone so search engines drop it.
export async function onRequest(context) {
  const { request, env } = context;
  const headers = withSecurityHeaders({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex'
  });
  try {
    const response = await env.ASSETS.fetch(new URL('/404.html', request.url));
    if (response.ok) return new Response(await response.text(), { status: 410, headers });
  } catch (err) { /* fall through to the plain-text body */ }
  return new Response('Gone.', {
    status: 410,
    headers: Object.assign({}, headers, { 'content-type': 'text/plain; charset=utf-8' })
  });
}
