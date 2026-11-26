import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = readFileSync(new URL('../../assets/inquiry-attribution.js', import.meta.url), 'utf8');
function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
}
function load(path, referrer = '', {local = storage(), session = storage(), host = 'metcalfsearch.com', gpc = false} = {}) {
  const window = { localStorage: local, sessionStorage: session };
  runInNewContext(script, {
    window, location: new URL('https://' + host + path), document: {referrer},
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
