import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = readFileSync(new URL('../../assets/inquiry-attribution.js', import.meta.url), 'utf8');
function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
}
function load(path, referrer = '', {local = storage(), session = storage(), host = 'metcalfsearch.com', gpc = false, listeners = {}} = {}) {
  const window = { localStorage: local, sessionStorage: session };
  runInNewContext(script, {
    window, location: new URL('https://' + host + path), document: {referrer, addEventListener(name, fn) { listeners[name] = fn; }},
    navigator: {globalPrivacyControl: gpc}, URL, URLSearchParams
  });
  return window.metcalfInquiryAttribution?.();
}

test('a referral survives navigation to contact; a later visit keeps its own source', () => {
  const local = storage(), session = storage();
  const first = load('/recruiting-partner?utm_source=chatgpt.com', 'https://chatgpt.com/c/private-path', {local, session});
  assert.equal(first.first.referrer, 'chatgpt.com');
  assert.equal(first.first.landing, '/recruiting-partner');
  const contact = load('/contact', 'https://metcalfsearch.com/recruiting-partner', {local, session});
  assert.equal(contact.first.source, 'chatgpt.com');
  assert.equal(contact.submission.landing, '/recruiting-partner');
  const later = load('/contact?utm_source=newsletter&utm_medium=email&utm_campaign=november', '', {local});
  assert.equal(later.first.source, 'chatgpt.com');
  assert.equal(later.submission.source, 'newsletter');
  assert.equal(later.submission.medium, 'email');
});

test('unknown and sensitive or private URL data never become source claims', () => {
  const result = load('/contact?email=person@example.test&utm_source=person@example.test&utm_medium=6145550123');
  assert.equal(result.first.source, '');
  assert.equal(result.first.medium, '');
  assert.equal(result.first.landing, '/contact');
  assert.equal(load('/onboarding/private-id'), undefined);
  assert.equal(load('/contact', '', {host:'preview.pages.dev'}), undefined);
  assert.equal(load('/contact', '', {gpc:true}), undefined);
});

for (const page of ['contact', 'services', 'activate']) {
  test(page + ' form sends a stable private retry reference and only counts fresh receipts', async () => {
    const html = readFileSync(new URL('../../' + page + '.html', import.meta.url), 'utf8');
    const handler = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
      .find(source => source.includes("fetch('https://api.metcalfsearch.com/contact'"));
    const events = [], requests = [], listeners = {};
    const status = {}, submit = {}, fields = {};
    const form = { querySelector: selector => ({'.contact-status': status, '.contact-submit': submit, '.form-fields': fields}[selector]),
      addEventListener: (name, fn) => { listeners[name] = fn; }, reset() {} };
    const touches = {first: {landing: '/source'}, submission: {landing: '/contact'}};
    const values = {name:'Test', email:'test@example.invalid', source:'contact-page'};
    let serial = 0, reply;
    const tick = () => new Promise(resolve => setImmediate(resolve));
    runInNewContext(handler, {
      document: {getElementById: id => id.endsWith('-fallback') ? {} : form},
      window: {crypto: { randomUUID: () => String(++serial) }, metcalfInquiryAttribution: () => touches},
      FormData: class { [Symbol.iterator]() { return Object.entries(values)[Symbol.iterator](); } },
      gtag: (...args) => events.push(args),
      fetch: async (url, opts) => {requests.push(JSON.parse(opts.body)); if (!reply) throw Error(); return {ok:true, json: async () => reply};}
    });
    async function send() { listeners.submit({preventDefault() {}}); await tick(); }
    await send();
    reply = {ok:true, created:false}; await send();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].submission_ref, requests[1].submission_ref);
    assert.deepEqual(requests[0].attribution, touches);
    assert.equal(events.length, 0);
    reply = {ok:true, created:true}; await send();
    assert.notEqual(requests[2].submission_ref, requests[1].submission_ref);
    assert.equal(JSON.stringify(events), JSON.stringify([['event','client_inquiry_submit',{source:'contact-page'}]]));
  });
}

test('only approved upstream labels travel to an employer link', () => {
  const local=storage(), session=storage(), listeners={};
  load('/source?utm_campaign=diy-hiring', 'https://www.google.com/search?secret=private', {local,session});
  load('/hire-without-a-placement-fee','https://metcalfsearch.com/source',{local,session,listeners});
  function follow(href) {
    const link={href};
    listeners.click({target:{closest:()=>link}});
    return new URL(link.href);
  }
  const dest=follow('https://apply.ms/#preview');
  assert.equal(dest.hash,'#preview');
  assert.deepEqual(Object.fromEntries(dest.searchParams),{
    ms_from:'metcalf',ms_source:'google',ms_medium:'organic',ms_campaign:'diy-hiring',ms_landing:'/source'
  });
  assert.equal(follow('https://apply.ms/client-company').search,'');
  assert.equal(follow('https://elsewhere.example/').search,'');
  const other={};
  load('/source?utm_source=person.name', '', {listeners:other});
  const link={href:'https://apply.ms/'};
  other.click({target:{closest:()=>link}});
  assert.equal(link.href,'https://apply.ms/');
});

test('public analytics uses the canonical path, strips private data, and loads only on production', () => {
  const analytics=readFileSync(new URL('../../assets/site-analytics.js',import.meta.url),'utf8');
  function measure(host) {
    const window={}, loads=[];
    const document={referrer:'https://elsewhere.example/resume/secret?id=private',
      querySelector:()=>({href:'https://metcalfsearch.com/onboarding/'}),
      createElement:()=>({}), head:{appendChild:script=>loads.push(script.src)}};
    runInNewContext(analytics,{window,document,location:new URL('https://'+host+'/onboarding/?session_id=cs_live_secret&utm_source=newsletter&utm_medium=owner%40email.example'),URL,URLSearchParams});
    return {commands:(window.dataLayer||[]).map(args=>Array.from(args)),loads};
  }
  const live=measure('metcalfsearch.com');
  assert.equal(live.loads.length,1);
  const cfg=live.commands.find(x=>x[0]==='config')[2];
  assert.equal(cfg.page_location,'https://metcalfsearch.com/onboarding/?utm_source=newsletter');
  assert.equal(cfg.page_referrer,'https://elsewhere.example/');
  assert.equal(live.commands.filter(x=>x[0]==='config').length,1);
  assert.equal(measure('metcalf-site.pages.dev').loads.length,0);
});

test('fractional purchase uses a paid live receipt, the paid amount, and an opaque deduplication key', async () => {
  const {webcrypto}=await import('node:crypto');
  const html=readFileSync(new URL('../../onboarding/index.html',import.meta.url),'utf8');
  const handler=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("gtag('event','purchase'"));
  async function visit(id, receipt, session) {
    let requests=0, events=[];
    let done;
    const called=new Promise(resolve=>{done=resolve;});
    runInNewContext(handler,{location:new URL('https://metcalfsearch.com/onboarding/?session_id='+id),
      URLSearchParams,TextEncoder,window:{crypto:webcrypto},sessionStorage:session,
      fetch:async()=>{requests++;return {ok:true,json:async()=>receipt};},gtag:(...args)=>{events.push(args);done();}});
    if(id.startsWith('cs_live_') && receipt.paymentStatus==='paid' && receipt.amountUsd>0 && !session.getItem('ms_purchase_'+id))await called;
    await new Promise(resolve=>setImmediate(resolve));
    return {requests,events};
  }
  const session=storage();
  const receipt={status:'complete',paymentStatus:'paid',amountUsd:2400,tier:'partner',email:'test@example.invalid'};
  const first=await visit('cs_live_synthetic',receipt,session);
  const data=first.events[0][2];
  assert.match(data.transaction_id,/^[a-f0-9]{64}$/);
  assert.equal(data.value,2400);
  assert.equal(data.items[0].price,2400);
  assert.doesNotMatch(JSON.stringify(data),/example.invalid|cs_live/);
  assert.equal((await visit('cs_live_synthetic',receipt,session)).events.length,0);
  assert.equal((await visit('cs_live_pending',{...receipt,paymentStatus:'unpaid'},session)).events.length,0);
  assert.equal((await visit('cs_test_synthetic',receipt,session)).requests,0);
});
