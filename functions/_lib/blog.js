/**
 * Rendering helpers for the Metcalf Search blog.
 *
 * Pure functions only (no Node built-ins, no globals beyond fetch/caches which
 * are guarded), so the same module runs in the Workers runtime and under
 * `node --test`.
 */

export const API_BASE = 'https://metcalf-blog-scraper.jay-9e2.workers.dev';
export const SITE = 'https://metcalfsearch.com';

/* -------------------------------------------------------------- headers */

/**
 * Cloudflare Pages applies `_headers` to static assets only, not to Functions
 * responses, so the blog routes have to set the same headers themselves.
 * Keep this list in sync with `_headers` at the repo root.
 *
 * The CSP is Report-Only on purpose: the pages use inline scripts and inline
 * styles throughout, so it can only be tightened after those are moved out.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://js.stripe.com https://assets.calendly.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://*.stripe.com https://*.calendly.com",
  "connect-src 'self' https://api.metcalfsearch.com https://formsubmit.co https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://stats.g.doubleclick.net https://api.stripe.com https://calendly.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://calendly.com",
  'upgrade-insecure-requests'
].join('; ');

export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://js.stripe.com")',
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy-report-only': CSP_REPORT_ONLY
};

/** Merge the standard headers into a response header bag. */
export function withSecurityHeaders(headers) {
  return Object.assign({}, SECURITY_HEADERS, headers || {});
}

/* ------------------------------------------------------------------ text */

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  middot: '·', eacute: 'é', trade: '™', reg: '®', copy: '©'
};

function decodeOnce(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 9 || code > 0x10ffff) return match;
      try { return String.fromCodePoint(code); } catch (e) { return match; }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/** Decode HTML entities that arrived pre-encoded (and double-encoded) from the API. */
export function decodeEntities(value) {
  let text = String(value == null ? '' : value);
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(text);
    if (next === text) break;
    text = next;
  }
  return text;
}

/** House style: no em dashes anywhere, ever. */
export function stripDashes(value) {
  return String(value == null ? '' : value)
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s+,/g, ',');
}

/** Decode once, drop dashes, collapse whitespace. For titles and one-liners. */
export function cleanInline(value) {
  return stripDashes(decodeEntities(value)).replace(/\s+/g, ' ').trim();
}

/** Same, but newlines survive (markdown bodies). */
export function cleanBlock(value) {
  return stripDashes(decodeEntities(value))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Absolute http(s) URLs only; anything else is dropped. */
export function safeUrl(value) {
  const raw = decodeEntities(value).trim();
  // No whitespace or control characters: those are the only way an attribute
  // value could grow a second attribute once it is written into the page.
  if (/[\u0000-\u0020\u007f]/.test(raw)) return '';
  if (!/^https?:\/\//i.test(raw)) return '';
  return raw;
}

/**
 * The only slug shape the /blog/[slug] route will serve. Anything else
 * (traversal, slashes, angle brackets, percent escapes) is dropped rather
 * than linked, so the API can never mint a link we would not honour.
 */
export function safeSlug(value) {
  const raw = String(value == null ? '' : value).trim();
  return /^[a-z0-9][a-z0-9._-]*$/i.test(raw) && !raw.includes('..') ? raw : '';
}

export function hostOf(url) {
  const clean = safeUrl(url);
  if (!clean) return '';
  const match = clean.match(/^https?:\/\/([^/?#]+)/i);
  if (!match) return '';
  return match[1].replace(/^www\./i, '').toLowerCase();
}

export function truncate(value, max) {
  const text = String(value == null ? '' : value).trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[.,;:!?-]+$/, '') + '…';
}

/* ------------------------------------------------------------------ dates */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The API mixes "2026-09-04T11:01:11.062Z" and "2026-08-31 08:00:19".
 * Read the calendar date off the front of the string so no timezone can shift it.
 */
export function dateParts(value) {
  const match = String(value == null ? '' : value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function isoDate(value) {
  const parts = dateParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatDate(value) {
  const parts = dateParts(value);
  if (!parts) return '';
  return `${MONTHS_SHORT[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export function formatLongDate(value) {
  const parts = dateParts(value);
  if (!parts) return '';
  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export function formatDayMonth(value) {
  const parts = dateParts(value);
  if (!parts) return '';
  return `${MONTHS_SHORT[parts.month - 1]} ${parts.day}`;
}

export function monthKey(value) {
  const parts = dateParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!match) return 'Undated';
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/* ------------------------------------------------------------------ fetch */

/**
 * JSON GET with the Cache API in front of it where the runtime has one.
 * Throws on a non-2xx response so callers can fall back to an empty state.
 */
export async function fetchJson(url, ttlSeconds = 300, timeoutMs = 4000) {
  const request = new Request(url, { headers: { accept: 'application/json' } });
  let store = null;
  try {
    if (typeof caches !== 'undefined' && caches && caches.default) store = caches.default;
  } catch (err) {
    store = null;
  }
  if (store) {
    try {
      const hit = await store.match(request);
      if (hit) return await hit.json();
    } catch (err) { /* cache miss behaves like no cache */ }
  }
  // A hung upstream must not hold the page open. AbortSignal.timeout exists in
  // the Workers runtime and in Node 18+; where it does not, we simply skip it.
  const options = { cf: { cacheTtl: ttlSeconds, cacheEverything: true } };
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      options.signal = AbortSignal.timeout(timeoutMs);
    }
  } catch (err) { /* no abort support: fall through without one */ }
  const response = await fetch(request, options);
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  const text = await response.text();
  const data = JSON.parse(text);
  if (store) {
    try {
      await store.put(request, new Response(text, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${ttlSeconds}`
        }
      }));
    } catch (err) { /* caching is best effort */ }
  }
  return data;
}

/* ----------------------------------------------------------------- picks */

const PUBLISHER_ALLOWLIST = [
  'hrdive.com', 'shrm.org', 'askamanager.org', 'recruitingheadlines.com',
  'ere.net', 'hbr.org', 'workforce.com', 'hrexecutive.com', 'hrmorning.com',
  'staffingindustry.com', 'benefitspro.com', 'shrm.com', 'tlnt.com',
  'recruitingdaily.com', 'hiringlab.org', 'bls.gov', 'dol.gov',
  'greenhouse.io', 'lever.co', 'indeed.com', 'linkedin.com', 'glassdoor.com',
  'ziprecruiter.com', 'monster.com', 'gallup.com', 'shrm.co'
];

const KEYWORDS = [
  'hiring', 'hire', 'hires', 'hired', 'rehire', 'recruit', 'recruits', 'recruiter',
  'recruiters', 'recruiting', 'recruitment', 'job', 'jobs', 'jobseeker', 'jobseekers',
  'career', 'careers', 'employer', 'employers', 'employee', 'employees', 'employment',
  'unemployment', 'workforce', 'workplace', 'worker', 'workers', 'labor', 'labour',
  'staffing', 'staff', 'headcount', 'talent', 'candidate', 'candidates', 'applicant',
  'applicants', 'application', 'applications', 'resume', 'resumes', 'cv', 'interview',
  'interviews', 'interviewing', 'onboarding', 'onboard', 'offer', 'offers', 'salary',
  'salaries', 'wage', 'wages', 'pay', 'paycheck', 'payroll', 'compensation', 'benefits',
  'bonus', 'raise', 'raises', 'severance', 'layoff', 'layoffs', 'laid off', 'firing',
  'fired', 'quit', 'quitting', 'resignation', 'turnover', 'retention', 'attrition',
  'burnout', 'manager', 'managers', 'management', 'leadership', 'boss', 'bosses',
  'supervisor', 'hr', 'human resources', 'people ops', 'culture', 'morale',
  'productivity', 'performance review', 'promotion', 'promotions', 'apprentice',
  'apprenticeship', 'intern', 'interns', 'internship', 'union', 'unions', 'unionize',
  'overtime', 'minimum wage', 'pto', 'paid leave', 'parental leave', 'sick leave',
  'remote work', 'return to office', 'rto', 'hybrid work', 'four-day week',
  'gig', 'freelance', 'freelancer', 'contractor', 'contractors', 'offshore',
  'outsourcing', 'small business', 'smb', 'small businesses', 'entrepreneur',
  'entrepreneurs', 'owner', 'owners', 'team', 'teams', 'hiring manager',
  'job market', 'labor market', 'ats', 'sourcing', 'skills gap', 'upskilling',
  'reskilling', 'training', 'mental health', 'benefits package', 'gen z',
  'millennials', 'employee experience', 'engagement survey', 'work'
];

const KEYWORD_RE = new RegExp(
  '\\b(' + KEYWORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

/** Keep picks that read like hiring, work, or small-business news. */
export function isRelevant(pick) {
  if (!pick) return false;
  const host = hostOf(pick.permalink);
  if (host && PUBLISHER_ALLOWLIST.some((domain) => host === domain || host.endsWith('.' + domain))) {
    return true;
  }
  const title = cleanInline(pick.display_title || '');
  if (!title) return false;
  return KEYWORD_RE.test(title);
}

/**
 * Filter picks, but never leave the page looking broken: if fewer than three
 * survive the filter, fall back to the top five unfiltered.
 */
export function selectPicks(picks, minimum = 3, fallback = 5) {
  const list = Array.isArray(picks) ? picks.filter((pick) => pick && safeUrl(pick.permalink)) : [];
  const kept = list.filter(isRelevant);
  if (kept.length >= minimum) return kept;
  return list.slice(0, fallback);
}

const HEAT_BARS = {
  viral: 4, breaking: 4, 'on fire': 4,
  hot: 3, rising: 3,
  trending: 2, warm: 2,
  'warming up': 1, cooling: 1, mild: 1, quiet: 1
};

export function heatBars(level) {
  const key = String(level == null ? '' : level).trim().toLowerCase();
  return HEAT_BARS[key] || 1;
}

export function sourceKey(url) {
  const host = hostOf(url);
  if (!host) return 'news';
  if (host.includes('ycombinator.com')) return 'hn';
  if (host.includes('reddit.com') || host.includes('redd.it')) return 'reddit';
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  return 'news';
}

const SOURCE_ICONS = {
  hn: '<rect x="1" y="1" width="18" height="18" rx="2"/>',
  reddit: '<path d="M10 3a7 7 0 100 14 7 7 0 000-14zm-3 8a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0zm-4.2 2.6h6.4a3.6 3.6 0 01-6.4 0z"/>',
  youtube: '<path d="M2 5h16v10H2z M8 7.5l5 2.5-5 2.5z"/>',
  news: '<path d="M3 3h14v14H3z M5 6h10v1H5z M5 9h10v1H5z M5 12h6v1H5z"/>'
};

export function sourceLabel(url) {
  const key = sourceKey(url);
  if (key === 'hn') return 'Hacker News';
  if (key === 'reddit') return 'Reddit';
  if (key === 'youtube') return 'YouTube';
  return hostOf(url) || 'the web';
}

/** The exact .pick-card markup the page already ships. */
export function renderPickCard(pick) {
  if (!pick) return '';
  const url = safeUrl(pick.permalink);
  if (!url) return '';
  const title = cleanInline(pick.display_title || sourceLabel(url));
  if (!title) return '';
  const key = sourceKey(url);
  const lit = heatBars(pick.heat_level);
  const bars = [
    { x: 0, y: 14, h: 4 },
    { x: 6, y: 10, h: 8 },
    { x: 12, y: 6, h: 12 },
    { x: 18, y: 2, h: 16 }
  ].map((bar, index) => {
    const fill = index < lit ? '#6f9b7c' : '#d8dcd6';
    return `<rect x="${bar.x}" y="${bar.y}" width="4" height="${bar.h}" rx="0.5" fill="${fill}"/>`;
  }).join('');
  return `<a class="pick-card" href="${escapeHtml(url)}" target="_blank" rel="noopener" data-source="${key}">` +
    '<div class="pick-head">' +
    `<svg class="heat-indicator" viewBox="0 0 22 18" width="22" height="18" aria-hidden="true">${bars}</svg>` +
    '<div class="pick-body"><div class="pick-title-row">' +
    `<span class="pick-title-small">${escapeHtml(title)}</span>` +
    `<span class="source-badge" data-source="${key}">` +
    `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">${SOURCE_ICONS[key]}</svg>` +
    `<span>${escapeHtml(sourceLabel(url))}</span></span>` +
    '</div></div></div></a>';
}

export function renderPicks(picks) {
  const cards = (Array.isArray(picks) ? picks : []).map(renderPickCard).filter(Boolean).join('');
  if (!cards) return '<div class="archive-empty">Picks are between refreshes. Check back shortly.</div>';
  return cards;
}

/* --------------------------------------------------------- recent posts */

export function authorLabel(author) {
  const key = String(author == null ? '' : author).toLowerCase();
  if (key === 'rosie' || key === 'hugh') return 'Rosie';
  if (key === 'metcalf' || key === 'jay' || key === '') return 'Metcalf Search';
  return cleanInline(author);
}

function authorColor(author) {
  const key = String(author == null ? '' : author).toLowerCase();
  return (key === 'rosie' || key === 'hugh') ? 'var(--celadon-deep)' : 'var(--brick)';
}

/** Same card markup (and inline styles) the old client script produced. */
export function renderRecentCard(post) {
  if (!post || !post.slug) return '';
  const slug = safeSlug(post.slug);
  if (!slug) return '';
  const title = escapeHtml(cleanInline(post.title || 'Untitled'));
  const date = escapeHtml(formatDate(post.published_at || post.week_of_date));
  const raw = cleanInline(post.excerpt || post.intro_paragraph || '');
  const excerpt = escapeHtml(raw);
  const label = escapeHtml(authorLabel(post.author));
  const color = authorColor(post.author);
  return `<a class="recent-card" href="/blog/${escapeHtml(slug)}" style="display:block;padding:18px;background:var(--paper);border:1px solid var(--rule);border-radius:2px;text-decoration:none;color:var(--ink);transition:border-color 0.15s;">` +
    `<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${color};margin-bottom:6px;">${label}${date ? ' &middot; ' + date : ''}</div>` +
    `<div style="font-family:var(--display);font-size:19px;line-height:1.25;font-weight:500;margin-bottom:8px;">${title}</div>` +
    (excerpt ? `<div style="font-size:13px;color:var(--ink-soft);line-height:1.45;">${excerpt}${raw.length >= 178 ? '&hellip;' : ''}</div>` : '') +
    '</a>';
}

export function renderRecent(posts, emptyMessage) {
  const cards = (Array.isArray(posts) ? posts : []).map(renderRecentCard).filter(Boolean).join('');
  if (!cards) return `<div class="archive-empty">${escapeHtml(emptyMessage || 'Nothing here yet.')}</div>`;
  return cards;
}

/* --------------------------------------------------------------- archive */

export function renderArchive(posts, now) {
  const list = (Array.isArray(posts) ? posts : []).filter((post) => post && safeSlug(post.slug));
  if (!list.length) return '<div class="archive-empty">The archive is loading. Check back shortly.</div>';
  const groups = new Map();
  for (const post of list) {
    const key = monthKey(post.published_at || post.week_of_date) || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(post);
  }
  const keys = Array.from(groups.keys()).filter(Boolean).sort().reverse();
  const today = now instanceof Date ? now : new Date();
  const nowIndex = today.getUTCFullYear() * 12 + today.getUTCMonth();
  const monthIndex = (key) => {
    const [y, m] = key.split('-').map(Number);
    return y * 12 + (m - 1);
  };
  const postLines = (key) => {
    const entries = groups.get(key).slice().sort((a, b) => {
      const left = isoDate(a.published_at || a.week_of_date);
      const right = isoDate(b.published_at || b.week_of_date);
      return right.localeCompare(left);
    });
    let out = '<ul class="archive-list">';
    for (const post of entries) {
      const slug = safeSlug(post.slug);
      if (!slug) continue;
      const title = escapeHtml(cleanInline(post.title || post.slug));
      const day = formatDayMonth(post.published_at || post.week_of_date);
      out += `<li><a href="/blog/${escapeHtml(slug)}">${title}</a>` +
        (day ? ` <span class="pick-source">${escapeHtml(day)}</span>` : '') + '</li>';
    }
    return out + '</ul>';
  };
  const count = (n) => `${n} ${n === 1 ? 'post' : 'posts'}`;
  const fold = (label, n, inner, open) =>
    `<details class="archive-fold"${open ? ' open' : ''}><summary>${escapeHtml(label)}` +
    ` <span class="pick-source">${escapeHtml(count(n))}</span></summary>${inner}</details>`;

  // The last three months stand on their own, one line each, newest open.
  // Everything older folds into one line per year, with the months inside,
  // so the archive never runs past a handful of lines.
  let html = '';
  const years = new Map();
  let first = true;
  for (const key of keys) {
    const age = nowIndex - monthIndex(key);
    const n = groups.get(key).length;
    if (age < 3) {
      html += fold(monthLabel(key), n, postLines(key), first);
      first = false;
    } else {
      const year = key.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(key);
    }
  }
  for (const [year, monthKeys] of years) {
    let inner = '';
    let total = 0;
    for (const key of monthKeys) {
      const n = groups.get(key).length;
      total += n;
      inner += fold(monthLabel(key), n, postLines(key), false);
    }
    const label = Number(year) === today.getUTCFullYear() ? `Earlier in ${year}` : year;
    html += fold(label, total, inner, false);
  }
  return html;
}

/* -------------------------------------------------------------- markdown */

function inlineMarkdown(escaped) {
  let html = escaped;
  html = html.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, text, href) => {
    const url = decodeEntities(href);
    // Asterisks and control characters would let the bold and italic passes
    // below rewrite the inside of the href we are about to emit.
    if (/[*\u0000-\u0020\u007f]/.test(url)) return text;
    // A root-relative link may not be protocol relative: "//evil.com" and
    // "/\evil.com" both leave the site while looking internal.
    const isRelative = url.startsWith('/') && !/^\/[/\\]/.test(url);
    const isSafe = /^https?:\/\//i.test(url) || isRelative;
    return isSafe ? `<a href="${escapeHtml(url)}">${text}</a>` : text;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Nothing raw survives to the page.
  return html.replace(/\*/g, '');
}

/**
 * Small markdown subset: paragraphs, headings, lists, bold, italic, links.
 * Everything is escaped before any markup is added.
 */
export function markdownToHtml(markdown) {
  const text = cleanBlock(markdown);
  if (!text) return '';
  const blocks = text.split(/\n{2,}/);
  const out = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(block);
    if (heading && block.split('\n').length === 1) {
      const level = heading[1].length === 1 ? 2 : 3;
      out.push(`<h${level}>${inlineMarkdown(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length && lines.every((line) => /^[-*+]\s+/.test(line))) {
      const items = lines
        .map((line) => `<li>${inlineMarkdown(escapeHtml(line.replace(/^[-*+]\s+/, '')))}</li>`)
        .join('');
      out.push(`<ul>${items}</ul>`);
      continue;
    }
    out.push(`<p>${inlineMarkdown(escapeHtml(lines.join(' ')))}</p>`);
  }
  return out.join('\n');
}

/** Plain text of a markdown body, for meta descriptions. */
export function markdownToText(markdown) {
  return cleanBlock(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/^[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------- template pieces */

export function replaceRegion(html, name, content) {
  const open = `<!--BLOG:${name}-->`;
  const close = `<!--/BLOG:${name}-->`;
  const start = html.indexOf(open);
  if (start < 0) return html;
  const end = html.indexOf(close, start);
  if (end < 0) return html.slice(0, start) + content + html.slice(start + open.length);
  return html.slice(0, start) + content + html.slice(end + close.length);
}

function headOf(template) {
  const end = template.indexOf('</head>');
  return end < 0 ? '' : template.slice(0, end + '</head>'.length);
}

function navOf(template) {
  const match = template.match(/<nav class="topnav"[\s\S]*?<\/nav>/);
  return match ? match[0] : '';
}

function footerOf(template) {
  const match = template.match(/<footer class="foot"[\s\S]*?<\/footer>/);
  return match ? match[0] : '';
}

function tailOf(template) {
  const footer = footerOf(template);
  if (!footer) return '';
  const start = template.indexOf(footer) + footer.length;
  const end = template.lastIndexOf('</body>');
  return end > start ? template.slice(start, end) : '';
}

function setTag(head, pattern, value) {
  return head.replace(pattern, (match, before, after) => before + value + after);
}

function setMetaContent(head, attribute, name, value) {
  const pattern = new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(">)`, 'i');
  return setTag(head, pattern, escapeHtml(value));
}

function jsonLd(data) {
  return '<script type="application/ld+json">' +
    JSON.stringify(data).replace(/</g, '\\u003c') +
    '</script>';
}

/* ---------------------------------------------------------- index render */

export function renderIndexPage(templateHtml, data) {
  const info = data || {};
  let html = String(templateHtml || '');
  const weekLine = info.weekStart ? `Week of ${formatLongDate(info.weekStart)}` : '';
  html = replaceRegion(html, 'WEEK_OF', weekLine ? escapeHtml(weekLine) : '');
  html = replaceRegion(html, 'PICKS', renderPicks(info.picks || []));
  html = replaceRegion(html, 'RECENT_ROSIE',
    renderRecent(info.rosie || [], 'No daily notes in the last seven days.'));
  html = replaceRegion(html, 'RECENT_WEEKLY',
    renderRecent(info.weekly || [], 'No weekly roundups in the last thirty days.'));
  html = replaceRegion(html, 'ARCHIVE', renderArchive(info.archive || []));
  return html;
}

/* ----------------------------------------------------------- post render */

export function postDescription(post) {
  const source = post.intro_paragraph
    ? cleanInline(post.intro_paragraph)
    : markdownToText(post.body || '');
  const text = source || 'Small business hiring news and notes from Metcalf Search.';
  return truncate(text, 155);
}

export function renderPostPage(templateHtml, post) {
  const template = String(templateHtml || '');
  const data = post || {};
  const slug = safeSlug(data.slug);
  const title = cleanInline(data.title || 'Post');
  const url = `${SITE}/blog/${slug}`;
  const published = isoDate(data.published_at || data.week_of_date);
  const description = postDescription(data);
  const label = authorLabel(data.author).toUpperCase();
  const eyebrowDate = formatDate(data.published_at || data.week_of_date).toUpperCase();

  let pageTitle = `${title} | Metcalf Search`;
  if (pageTitle.length > 62) pageTitle = `${truncate(title, 62 - ' | Metcalf Search'.length)} | Metcalf Search`;

  let head = headOf(template);
  head = setTag(head, /(<title>)[\s\S]*?(<\/title>)/i, escapeHtml(pageTitle));
  head = setMetaContent(head, 'name', 'description', description);
  head = setMetaContent(head, 'property', 'og:title', pageTitle);
  head = setMetaContent(head, 'property', 'og:description', description);
  head = setMetaContent(head, 'property', 'og:url', url);
  head = setMetaContent(head, 'name', 'twitter:title', pageTitle);
  head = setMetaContent(head, 'name', 'twitter:description', description);
  head = setTag(head, /(<meta property="og:type" content=")[^"]*(">)/i, 'article');
  head = setTag(head, /(<link rel="canonical" href=")[^"]*(">)/i, escapeHtml(url));

  // Drop the index-level Blog and BreadcrumbList blocks, keep Organization,
  // LocalBusiness and WebSite, then add the post's own schema.
  head = head.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>\n?/g, (match, body) => {
    if (body.includes('"Blog"') || body.includes('CollectionPage') || body.includes('BreadcrumbList')) return '';
    return match;
  });

  const article = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    inLanguage: 'en-US',
    datePublished: published || undefined,
    dateModified: published || undefined,
    author: { '@type': 'Organization', name: 'Metcalf Search' },
    publisher: {
      '@type': 'Organization',
      name: 'Metcalf Search',
      logo: { '@type': 'ImageObject', url: `${SITE}/logo.png` }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  });
  const crumbs = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: url }
    ]
  });
  head = head.replace('</head>', `${article}\n${crumbs}\n</head>`);

  let body = '';
  const picks = Array.isArray(data.picks) ? selectPicks(data.picks) : [];
  if (data.body) {
    body += markdownToHtml(data.body);
  }
  if (data.intro_paragraph) {
    const intro = cleanInline(data.intro_paragraph);
    if (intro) body += `${body ? '\n' : ''}<p>${escapeHtml(intro)}</p>`;
  }
  if (picks.length) {
    body += `\n<h2>This week's picks</h2>\n<div class="picks-grid">${renderPicks(picks)}</div>`;
  }
  if (!body) {
    body = '<p>This post is being written up. Check back shortly.</p>';
  }

  const eyebrow = [label, eyebrowDate].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const hero = '<section class="page-hero">\n' +
    (eyebrow ? `<div class="eyebrow">${eyebrow}</div>\n` : '') +
    `<h1>${escapeHtml(title)}</h1>\n</section>`;
  const prose = `<div class="prose">\n${body}\n` +
    '<p><a href="/blog">Back to all posts</a></p>\n' +
    '<p>Hiring in Central Ohio? Read how <a href="/fractional-recruiting">fractional recruiting</a> works, or <a href="/contact">start a conversation</a>.</p>\n' +
    '</div>';

  return `${head}\n<body>\n${navOf(template)}\n\n${hero}\n${prose}\n\n` +
    `${footerOf(template)}\n${tailOf(template).trim()}\n</body>\n</html>\n`;
}

/* ---------------------------------------------------------------- sitemap */

export function renderSitemap(posts) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${SITE}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`];
  const seen = new Set();
  for (const post of (Array.isArray(posts) ? posts : [])) {
    if (!post || !post.slug || seen.has(post.slug)) continue;
    seen.add(post.slug);
    const slug = safeSlug(post.slug);
    if (!slug) continue;
    const lastmod = isoDate(post.published_at || post.week_of_date);
    lines.push(`  <url><loc>${SITE}/blog/${escapeHtml(slug)}</loc>` +
      (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
      '<changefreq>monthly</changefreq><priority>0.6</priority></url>');
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}
