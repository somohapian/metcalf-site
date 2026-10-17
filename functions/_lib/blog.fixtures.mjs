/** Synthetic test data. No network or local production snapshots required. */
const samplePicks = [
  { display_title: 'Hiring teams are responding faster', permalink: 'https://example.org/hiring', heat_level: 'viral' },
  { display_title: 'Small business recruiting gets simpler', permalink: 'https://example.org/recruiting', heat_level: 'hot' },
  { display_title: 'Better interview questions', permalink: 'https://example.org/interviews', heat_level: 'trending' },
  { display_title: 'A new telescope', permalink: 'https://example.org/telescope', heat_level: 'mild' },
  { display_title: 'A mountain expedition', permalink: 'https://example.org/mountain', heat_level: 'quiet' },
  { display_title: 'An ancient painting', permalink: 'https://example.org/painting', heat_level: 'quiet' }
];

const daily = {
  slug: 'technical-debt-shows-up-in-hiring-speed',
  title: 'Technical Debt Shows Up in Hiring Speed',
  author: 'rosie', published_at: '2026-09-04T11:00:00.000Z',
  body: '**What:** Hiring handoffs can slow down a small team.\n\n**So What:** Assign one owner to each step.'
};

const weekly = {
  slug: 'weekly-small-business-hiring-notes',
  title: 'Weekly Small Business Hiring Notes',
  author: 'jay', published_at: '2026-08-31T08:00:00.000Z',
  intro_paragraph: 'The labor market is sending mixed signals, job seekers are comparing options.',
  picks: samplePicks
};

export const fixtures = {
  'picks.json': { picks: samplePicks, week_start: '2026-08-31' },
  'recent-rosie.json': { posts: [daily] },
  'recent-jay.json': { posts: [weekly] },
  'posts.json': { posts: [daily, weekly], total: 2 },
  'post-daily.json': daily,
  'post-weekly.json': weekly
};
