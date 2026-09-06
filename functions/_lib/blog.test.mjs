/**
 * node --test functions/_lib/blog.test.mjs
 *
 * Offline: reads JSON fixtures pulled from the blog Worker (BLOG_FIXTURES,
 * default /root/blog-fixtures) plus the real blog.html template, renders the
 * index page, a daily post and a weekly post, and checks the output.
 * Rendered pages are written to BLOG_RENDER (default /root/blog-render).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isRelevant, selectPicks, renderPickCard, renderRecentCard, renderArchive,
  markdownToHtml, markdownToText, renderIndexPage, renderPostPage, renderSitemap,
  escapeHtml, cleanInline, heatBars, sourceKey, sourceLabel, formatLongDate,
  replaceRegion, truncate, safeUrl, safeSlug, SECURITY_HEADERS, withSecurityHeaders
} from './blog.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = process.env.BLOG_FIXTURES || '/root/blog-fixtures';
const RENDER = process.env.BLOG_RENDER || '/root/blog-render';
const TEMPLATE_PATH = join(HERE, '..', '..', 'blog.html');

const fixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
const template = readFileSync(TEMPLATE_PATH, 'utf8');

const picks = fixture('picks.json');
const rosie = fixture('recent-rosie.json');
const weekly = fixture('recent-jay.json');
const posts = fixture('posts.json');
const daily = fixture('post-daily.json');
const weeklyPost = fixture('post-weekly.json');

mkdirSync(RENDER, { recursive: true });

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Simple stack check over non-void tags, skipping script/style contents. */
function unbalancedTags(html) {
  const stack = [];
  const errors = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let match;
  let skipUntil = null;
  while ((match = re.exec(html))) {
    const [, closing, rawName, selfClose] = match;
    const name = rawName.toLowerCase();
    if (skipUntil) {
      if (closing && name === skipUntil) skipUntil = null;
      continue;
    }
    if (!closing && (name === 'script' || name === 'style')) { skipUntil = name; continue; }
    if (VOID.has(name) || selfClose) continue;
    if (!closing) { stack.push(name); continue; }
    const index = stack.lastIndexOf(name);
    if (index < 0) errors.push(`stray </${name}>`);
    else if (index !== stack.length - 1) {
      errors.push(`closing </${name}> with ${stack.slice(index + 1).join(',')} still open`);
      stack.length = index;
    } else stack.pop();
  }
  if (stack.length) errors.push(`unclosed at EOF: ${stack.join(',')}`);
  return errors;
}

function assertClean(html, label) {
  assert.ok(!html.includes('—'), `${label}: em dash`);
  assert.ok(!html.includes('undefined'), `${label}: "undefined"`);
  assert.ok(!html.includes('[object'), `${label}: "[object"`);
  assert.ok(!html.includes('NaN'), `${label}: NaN`);
  assert.ok(!html.includes('<!--BLOG:'), `${label}: unreplaced marker`);
  assert.ok(!/>[^<]*\*\*/.test(html), `${label}: raw markdown asterisks`);
  const h1 = html.match(/<h1[\s>]/g) || [];
  assert.equal(h1.length, 1, `${label}: h1 count ${h1.length}`);
  assert.deepEqual(unbalancedTags(html), [], `${label}: tag balance`);
  assert.ok(!html.includes('cdn-cgi'), `${label}: cdn-cgi`);
}

test('escapeHtml and cleanInline', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(cleanInline('Rizz &amp;#8220;quoted&amp;#8221;'), 'Rizz “quoted”');
  assert.equal(cleanInline('signals — job seekers'), 'signals, job seekers');
  assert.equal(cleanInline('Show HN: OJCP – an open protocol'), 'Show HN: OJCP, an open protocol');
  assert.equal(truncate('one two three four', 12), 'one two…');
});

test('heat, source and pick card markup', () => {
  assert.equal(heatBars('Viral'), 4);
  assert.equal(heatBars('Hot'), 3);
  assert.equal(heatBars('Trending'), 2);
  assert.equal(heatBars('Warming Up'), 1);
  assert.equal(heatBars('nonsense'), 1);
  assert.equal(sourceKey('https://news.ycombinator.com/item?id=1'), 'hn');
  assert.equal(sourceKey('https://www.reddit.com/r/recruiting/'), 'reddit');
  assert.equal(sourceKey('https://youtu.be/abc'), 'youtube');
  assert.equal(sourceKey('https://www.hrdive.com/news/x/'), 'news');
  assert.equal(sourceLabel('https://www.hrdive.com/news/x/'), 'hrdive.com');

  const card = renderPickCard(picks.picks[0]);
  assert.ok(card.startsWith('<a class="pick-card" href="'));
  assert.ok(card.includes('class="heat-indicator"'));
  assert.ok(card.includes('class="pick-title-small"'));
  assert.ok(card.includes('class="source-badge"'));
  assert.equal((card.match(/<rect /g) || []).length, 4);
  assert.equal((card.match(/fill="#6f9b7c"/g) || []).length, 4);
  assert.equal(renderPickCard({ permalink: 'javascript:alert(1)', display_title: 'x' }), '');
});

test('isRelevant filters off-topic picks and keeps hiring ones', () => {
  assert.equal(isRelevant({ display_title: 'Show HN: Hire offshore in minutes via API', permalink: 'https://x.dev/' }), true);
  assert.equal(isRelevant({ display_title: 'How to find a job that makes you come alive', permalink: 'https://www.fastcompany.com/1' }), true);
  assert.equal(isRelevant({ display_title: 'A Lost Civilization Is Baffling Experts', permalink: 'https://www.wsj.com/a' }), false);
  assert.equal(isRelevant({ display_title: 'Open-source pixel art editor with auto-tiling', permalink: 'https://x.com/' }), false);
  // allowlisted publisher passes on host alone
  assert.equal(isRelevant({ display_title: 'Anything at all', permalink: 'https://www.hrdive.com/news/x/' }), true);

  const kept = picks.picks.filter(isRelevant);
  assert.ok(kept.length >= 3, `only ${kept.length} relevant picks survived`);
  assert.ok(kept.length < picks.picks.length, 'filter removed nothing');
  assert.equal(selectPicks(picks.picks).length, kept.length);
  // fallback: nothing relevant means top five unfiltered
  const junk = picks.picks.map((p) => ({ ...p, display_title: 'pixel art editor', permalink: 'https://example.dev/' }));
  assert.equal(selectPicks(junk).length, 5);
});

test('recent card and archive markup', () => {
  const card = renderRecentCard(rosie.posts[0]);
  assert.ok(card.includes('href="/blog/' + rosie.posts[0].slug + '"'));
  assert.ok(card.includes('class="recent-card"'));
  assert.ok(card.includes('Rosie'));
  assert.ok(renderRecentCard(weekly.posts[0]).includes('Metcalf Search'));

  const archive = renderArchive(posts.posts);
  assert.ok(archive.includes('<summary>September 2026 '));
  assert.ok(archive.includes('<ul class="archive-list">'));
  assert.ok(archive.includes('href="/blog/' + posts.posts[0].slug + '"'));
  assert.deepEqual(unbalancedTags(archive), []);
  assert.ok(renderArchive([]).includes('archive-empty'));
});

test('markdown renderer escapes and converts', () => {
  const html = markdownToHtml(daily.body);
  assert.ok(html.includes('<strong>What:</strong>'));
  assert.ok(html.includes('<strong>So What:</strong>'));
  assert.ok(!html.includes('**'));
  assert.deepEqual(unbalancedTags(html), []);

  const tricky = markdownToHtml('# Head\n\n<script>bad()</script> and *soft* and [a link](https://x.com/a) and [bad](javascript:1)\n\n- one\n- two');
  assert.ok(tricky.includes('<h2>Head</h2>'));
  assert.ok(tricky.includes('&lt;script&gt;'));
  assert.ok(tricky.includes('<em>soft</em>'));
  assert.ok(tricky.includes('<a href="https://x.com/a">a link</a>'));
  assert.ok(!tricky.includes('javascript:'));
  assert.ok(tricky.includes('<ul><li>one</li><li>two</li></ul>'));
  assert.equal(markdownToText(daily.body).slice(0, 5), 'What:');
});

test('replaceRegion swaps markers and their fallbacks', () => {
  const html = '<div><!--BLOG:PICKS--><div class="archive-empty">Picks loading.</div><!--/BLOG:PICKS--></div>';
  assert.equal(replaceRegion(html, 'PICKS', '<b>x</b>'), '<div><b>x</b></div>');
  assert.equal(replaceRegion('<div><!--BLOG:PICKS--></div>', 'PICKS', 'y'), '<div>y</div>');
  assert.equal(replaceRegion('<div></div>', 'PICKS', 'y'), '<div></div>');
});

test('index page renders', () => {
  const html = renderIndexPage(template, {
    weekStart: picks.week_start,
    picks: selectPicks(picks.picks),
    rosie: rosie.posts,
    weekly: weekly.posts,
    archive: posts.posts
  });
  writeFileSync(join(RENDER, 'index.html'), html);
  assertClean(html, 'index');
  assert.ok(html.includes('Week of ' + formatLongDate(picks.week_start)));
  assert.ok(html.includes('<title>Small Business Hiring News and Notes | Metcalf Search</title>'));
  assert.ok(html.includes('class="pick-card"'));
  assert.ok(html.includes('<summary>September 2026 '));
  assert.ok(html.includes('href="/contact"'));
  assert.ok(html.includes('Grove City, Ohio'));
  assert.ok(html.includes('https://apply.ms/'));
  const cards = html.match(/class="pick-card"/g) || [];
  assert.ok(cards.length >= 3, `only ${cards.length} pick cards`);
  const links = html.match(/href="\/blog\/[a-z0-9-]+"/g) || [];
  assert.ok(links.length > 20, `only ${links.length} post links`);
  assert.ok(!html.includes('metcalf-blog-scraper'), 'client-side fetch left behind');
});

test('index page survives a dead API', () => {
  const html = renderIndexPage(template, {});
  assertClean(html, 'index-empty');
  assert.ok(html.includes('archive-empty'));
});

test('daily post page renders', () => {
  const html = renderPostPage(template, daily);
  writeFileSync(join(RENDER, 'daily.html'), html);
  assertClean(html, 'daily');
  assert.ok(html.includes('<title>Technical Debt Shows Up in Hiring Speed | Metcalf Search</title>'));
  assert.ok(html.includes('<link rel="canonical" href="https://metcalfsearch.com/blog/technical-debt-shows-up-in-hiring-speed">'));
  assert.ok(html.includes('"@type":"BlogPosting"'));
  assert.ok(html.includes('"datePublished":"2026-09-04"'));
  assert.ok(html.includes('"@type":"BreadcrumbList"'));
  assert.ok(!html.includes('"CollectionPage"'));
  assert.ok(html.includes('"@type":"LocalBusiness"'));
  assert.ok(html.includes('<div class="eyebrow">ROSIE &middot; SEP 4, 2026</div>'));
  assert.ok(html.includes('<strong>So What:</strong>'));
  assert.ok(html.includes('href="/blog"'));
  assert.ok(html.includes('href="/fractional-recruiting"'));
  assert.ok(html.includes('class="topnav"') && html.includes('class="foot"'));
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.length <= 62, `title ${title.length} chars`);
});

test('weekly post page renders with picks', () => {
  const html = renderPostPage(template, weeklyPost);
  writeFileSync(join(RENDER, 'weekly.html'), html);
  assertClean(html, 'weekly');
  assert.ok(html.includes('<div class="eyebrow">METCALF SEARCH &middot; AUG 31, 2026</div>'));
  assert.ok(html.includes("<h2>This week's picks</h2>"));
  const cards = html.match(/class="pick-card"/g) || [];
  assert.ok(cards.length >= 3, `only ${cards.length} pick cards on the weekly post`);
  assert.ok(html.includes('The labor market is sending mixed signals, job seekers'));
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.length <= 62, `title ${title.length} chars: ${title}`);
  const desc = html.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(desc.length > 0 && desc.length <= 160, `desc ${desc.length} chars`);
});

test('long titles are trimmed to 62 characters', () => {
  const html = renderPostPage(template, {
    slug: 'x', title: 'A Very Long Post Title About Hiring That Simply Keeps Going And Going And Going',
    body: 'Body text.', published_at: '2026-09-01T11:00:00.000Z', author: 'rosie', picks: []
  });
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.length <= 62, `title ${title.length}`);
  assert.ok(title.endsWith(' | Metcalf Search'));
});

test('sitemap lists the index and every post', () => {
  const xml = renderSitemap(posts.posts);
  writeFileSync(join(RENDER, 'blog-sitemap.xml'), xml);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<loc>https://metcalfsearch.com/blog</loc>'));
  assert.ok(xml.includes('<loc>https://metcalfsearch.com/blog/' + posts.posts[0].slug + '</loc>'));
  assert.ok(xml.includes('<lastmod>2026-09-04</lastmod>'));
  assert.equal((xml.match(/<url>/g) || []).length, posts.posts.length + 1);
  assert.ok(!xml.includes('undefined'));
});


/* ------------------------------------------------------------------------ */
/* Adversarial: every field below arrives from the blog API, which is a       */
/* scraper. Treat all of it as attacker controlled.                          */
/* ------------------------------------------------------------------------ */

/**
 * Scan only the real tags in the output: text that was correctly escaped shows
 * up as &lt;img ...&gt; and must not count as an injection. Anything that did
 * get through arrives as a genuine tag, which is what this walks.
 */
function tagsOf(html) {
  return html.match(/<[a-zA-Z][^>]*>/g) || [];
}

const URL_ATTR = /\b(?:href|src|action|formaction|xlink:href|srcset|poster)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

function assertNoInjection(html, label, options) {
  const banned = (options && options.bannedTags) || [];
  for (const tag of tagsOf(html)) {
    // Blank out quoted attribute values: an event handler that is still inside
    // a pair of quotes is inert text, and that is exactly what escaping does.
    const skeleton = tag.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    assert.ok(!/\son[a-z]+\s*=/i.test(skeleton), `${label}: event handler in ${tag.slice(0, 90)}`);
    // Schemes only matter where a browser would navigate or load.
    URL_ATTR.lastIndex = 0;
    let attr;
    while ((attr = URL_ATTR.exec(tag))) {
      const value = attr[1].replace(/^["']|["']$/g, '').trim();
      assert.ok(!/^javascript:/i.test(value), `${label}: javascript: URL in ${tag.slice(0, 90)}`);
      assert.ok(!/^data:text\/html/i.test(value), `${label}: data: HTML URL in ${tag.slice(0, 90)}`);
      assert.ok(!/^\/[/\\]/.test(value), `${label}: protocol-relative URL in ${tag.slice(0, 90)}`);
    }
    const name = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(tag)[1].toLowerCase();
    assert.ok(!banned.includes(name), `${label}: injected <${name}>`);
  }
  assert.deepEqual(unbalancedTags(html), [], `${label}: tag balance`);
}

/** Fragments (cards, markdown) may never contain these at all. */
const FRAGMENT_BANNED = ['script', 'iframe', 'object', 'embed', 'img', 'style', 'form', 'base', 'link', 'meta'];

const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>';

test('safeUrl rejects every scheme that is not http(s)', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), '');
  assert.equal(safeUrl('  javascript:alert(1)  '), '');
  assert.equal(safeUrl('java\tscript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeUrl('vbscript:msgbox(1)'), '');
  assert.equal(safeUrl('//evil.example.com/x'), '');
  assert.equal(safeUrl('/relative'), '');
  assert.equal(safeUrl('&#106;avascript:alert(1)'), '');
  assert.equal(safeUrl('&amp;#106;avascript:alert(1)'), '');
  // whitespace inside a URL is the only way to grow a second attribute
  assert.equal(safeUrl('https://x.com/a" onmouseover="alert(1)'), '');
  assert.equal(safeUrl('https://x.com/a\nonload=1'), '');
  assert.equal(safeUrl('https://x.com/ok-path?a=1&b=2#f'), 'https://x.com/ok-path?a=1&b=2#f');
});

test('safeSlug refuses traversal, slashes and markup', () => {
  assert.equal(safeSlug('a-good-slug'), 'a-good-slug');
  assert.equal(safeSlug('post.2026-09-06'), 'post.2026-09-06');
  assert.equal(safeSlug('../../etc/passwd'), '');
  assert.equal(safeSlug('..%2f..%2fadmin'), '');
  assert.equal(safeSlug('a/../b'), '');
  assert.equal(safeSlug('a..b'), '');
  assert.equal(safeSlug('<script>alert(1)</script>'), '');
  assert.equal(safeSlug('slug"onmouseover="alert(1)'), '');
  assert.equal(safeSlug('slug with spaces'), '');
  assert.equal(safeSlug('.hidden'), '');
  assert.equal(safeSlug(''), '');
  assert.equal(safeSlug(null), '');
});

test('pick cards drop hostile permalinks and escape hostile titles', () => {
  assert.equal(renderPickCard({ permalink: 'javascript:alert(1)', display_title: 'x' }), '');
  assert.equal(renderPickCard({ permalink: 'data:text/html,<script>x</script>', display_title: 'x' }), '');
  assert.equal(renderPickCard({ permalink: '//evil.example.com', display_title: 'x' }), '');
  assert.equal(renderPickCard({ permalink: 'https://x.com/a" onmouseover="alert(1)', display_title: 'x' }), '');

  const card = renderPickCard({
    permalink: 'https://www.hrdive.com/news/x/',
    display_title: XSS + ' "quoted" \'single\'',
    heat_level: 'hot'
  });
  assertNoInjection(card, 'pick card', { bannedTags: FRAGMENT_BANNED });
  assert.ok(card.includes('&lt;script&gt;'), 'pick title not escaped');
  assert.ok(card.includes('&quot;quoted&quot;'), 'pick title quotes not escaped');
  // the whole card lives inside one href="..." attribute, so a quote escaping
  // the title would also escape the anchor
  assert.equal((card.match(/<a /g) || []).length, 1);

  // an object in place of a string must not stringify into the page
  assert.equal(renderPickCard({ permalink: { toString: () => 'javascript:1' }, display_title: 'x' }), '');
});

test('recent cards escape titles, excerpts and authors, and drop bad slugs', () => {
  const card = renderRecentCard({
    slug: 'safe-slug',
    title: XSS,
    excerpt: '"><img src=x onerror=alert(3)>',
    author: XSS,
    published_at: '2026-09-04T11:00:00.000Z'
  });
  assertNoInjection(card, 'recent card', { bannedTags: FRAGMENT_BANNED });
  assert.ok(card.includes('href="/blog/safe-slug"'));

  assert.equal(renderRecentCard({ slug: '../../admin', title: 'x' }), '');
  assert.equal(renderRecentCard({ slug: 'a"onmouseover="alert(1)', title: 'x' }), '');
  assert.equal(renderRecentCard({ slug: '<script>', title: 'x' }), '');
});

test('archive drops bad slugs and escapes titles', () => {
  const html = renderArchive([
    { slug: '../../admin', title: 'traversal', published_at: '2026-09-01' },
    { slug: 'ok-post', title: XSS, published_at: '2026-09-01' }
  ], new Date('2026-09-06T00:00:00Z'));
  assertNoInjection(html, 'archive', { bannedTags: FRAGMENT_BANNED });
  assert.ok(!html.includes('/blog/../'), 'archive linked a traversal slug');
  assert.ok(html.includes('href="/blog/ok-post"'));
});

test('markdown escapes before it adds any markup', () => {
  const html = markdownToHtml([
    '# ' + XSS,
    '',
    XSS,
    '',
    '- ' + XSS,
    '',
    '[click](javascript:alert(1))',
    '',
    '[click](&#106;avascript:alert(1))',
    '',
    '[click](&amp;#106;avascript:alert(1))',
    '',
    '[click](vbscript:alert(1))',
    '',
    '[click](data:text/html,<script>alert(1)</script>)',
    '',
    '**' + XSS + '**',
    '',
    '*' + XSS + '*'
  ].join('\n'));
  assertNoInjection(html, 'markdown', { bannedTags: FRAGMENT_BANNED });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'markdown did not escape');
});

test('markdown links stay on http(s) or a genuinely internal path', () => {
  const ok = markdownToHtml('[a](https://x.com/p) and [b](/contact)');
  assert.ok(ok.includes('<a href="https://x.com/p">a</a>'));
  assert.ok(ok.includes('<a href="/contact">b</a>'));

  // protocol-relative and backslash tricks look internal but leave the site
  const offsite = markdownToHtml('[a](//evil.example.com) and [b](/\\evil.example.com)');
  assert.ok(!offsite.includes('<a '), `protocol-relative link survived: ${offsite}`);

  // an href must never be rewritten by the bold or italic pass that follows it
  const starred = markdownToHtml('[a](https://x.com/**bold**/p)');
  assert.ok(!starred.includes('<strong>'), `bold pass reached inside an href: ${starred}`);
  assertNoInjection(starred, 'starred link', { bannedTags: FRAGMENT_BANNED });

  // a quote in the link text cannot break the anchor it sits in
  const quoted = markdownToHtml('[say "hi" now](https://x.com/p)');
  assert.ok(quoted.includes('&quot;hi&quot;'));
  assertNoInjection(quoted, 'quoted link text', { bannedTags: FRAGMENT_BANNED });
});

test('post page escapes title, author, intro, body and picks', () => {
  const html = renderPostPage(template, {
    slug: 'hostile-post',
    title: XSS + ' "quoted"',
    author: XSS,
    intro_paragraph: XSS,
    body: '# ' + XSS + '\n\n' + XSS,
    published_at: '2026-09-04T11:00:00.000Z',
    picks: [{ permalink: 'javascript:alert(1)', display_title: XSS }]
  });
  writeFileSync(join(RENDER, 'hostile.html'), html);
  assertNoInjection(html, 'hostile post');
  assert.ok(!html.includes('<!--BLOG:'), 'unreplaced marker');
  // the eyebrow is where an unescaped author used to land
  assert.ok(!/<div class="eyebrow">[^<]*</.test(html) || !/eyebrow">[^<]*<(script|img)/i.test(html));
  // head tags must not be broken out of by a quote in the title
  const title = html.match(/<title>([^<]*)<\/title>/);
  assert.ok(title, 'no <title> survived');
  assert.ok(!title[1].includes('"'), 'raw quote inside <title>');
  const desc = html.match(/<meta name="description" content="([^"]*)">/);
  assert.ok(desc, 'no description meta survived');
  // JSON-LD must not be escapable
  assert.ok(!/<script type="application\/ld\+json">[^<]*<\/script>\s*alert/.test(html));
  assert.ok(html.includes('\\u003c'), 'JSON-LD did not escape angle brackets');
});

test('post page canonical and JSON-LD cannot be steered by the slug', () => {
  const html = renderPostPage(template, {
    slug: '../../evil" onload="alert(1)',
    title: 'Title',
    body: 'Body.',
    published_at: '2026-09-04T11:00:00.000Z'
  });
  assertNoInjection(html, 'hostile slug');
  assert.ok(!html.includes('/blog/../'), 'traversal reached the canonical');
  assert.ok(html.includes('<link rel="canonical" href="https://metcalfsearch.com/blog/">'));
});

test('sitemap drops hostile slugs and escapes what it keeps', () => {
  const xml = renderSitemap([
    { slug: '../../admin', published_at: '2026-09-01' },
    { slug: 'a"><script>alert(1)</script>', published_at: '2026-09-01' },
    { slug: 'good-post', published_at: '2026-09-01' }
  ]);
  assert.ok(!xml.includes('<script'), 'script tag in sitemap');
  assert.ok(!xml.includes('/blog/../'), 'traversal in sitemap');
  assert.ok(xml.includes('<loc>https://metcalfsearch.com/blog/good-post</loc>'));
  assert.equal((xml.match(/<url>/g) || []).length, 2);
});

test('index page survives a wholly hostile API payload', () => {
  const html = renderIndexPage(template, {
    weekStart: XSS,
    picks: [{ permalink: 'javascript:alert(1)', display_title: XSS }],
    rosie: [{ slug: '../../admin', title: XSS, excerpt: XSS, author: XSS }],
    weekly: [{ slug: 'ok', title: XSS, excerpt: XSS, author: XSS }],
    archive: [{ slug: '<script>', title: XSS, published_at: '2026-09-01' }]
  });
  writeFileSync(join(RENDER, 'hostile-index.html'), html);
  assertNoInjection(html, 'hostile index');
});

test('security headers are present and the CSP is report-only', () => {
  assert.equal(SECURITY_HEADERS['x-content-type-options'], 'nosniff');
  assert.equal(SECURITY_HEADERS['x-frame-options'], 'DENY');
  assert.ok(SECURITY_HEADERS['strict-transport-security'].startsWith('max-age='));
  assert.ok(!('content-security-policy' in SECURITY_HEADERS), 'CSP must not be enforcing yet');
  const csp = SECURITY_HEADERS['content-security-policy-report-only'];
  for (const needed of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'",
    'https://www.googletagmanager.com', 'https://js.stripe.com', 'https://assets.calendly.com',
    'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://api.metcalfsearch.com']) {
    assert.ok(csp.includes(needed), `CSP missing ${needed}`);
  }
  const merged = withSecurityHeaders({ 'content-type': 'text/html; charset=utf-8' });
  assert.equal(merged['content-type'], 'text/html; charset=utf-8');
  assert.equal(merged['x-frame-options'], 'DENY');
});
