/** Checkout function tests. Run with: node --test functions/_lib/*.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICES, STRIPE_VERSION, onRequestPost, onRequestOptions, onRequest } from '../api/checkout.js';
import { onRequestGet as getStatus, onRequest as statusOther } from '../api/checkout-status.js';

const SITE = 'https://metcalf-site.pages.dev';
const ENV = { STRIPE_SECRET_KEY: 'sk_test_example' };
const TEST_PRICES = { partner: 'price_test_partner', plus: 'price_test_plus', pro: 'price_test_pro' };

function post(body, headers = {}) {
  return new Request(`${SITE}/api/checkout`, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json', origin: SITE }, headers),
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

// Swaps real-looking ids into PRICES for one test, whatever the file holds.
function withPrices(t, prices) {
  const saved = Object.assign({}, PRICES);
  Object.assign(PRICES, prices);
  t.after(() => Object.assign(PRICES, saved));
}

test('every tier key is mapped and the placeholders are easy to spot', () => {
  assert.deepEqual(Object.keys(PRICES).sort(), ['partner', 'plus', 'pro']);
  for (const value of Object.values(PRICES)) {
    assert.ok(/^PRICE_ID_[A-Z]+$/.test(value) || /^price_\w+$/.test(value), value);
  }
});

test('each tier creates a custom checkout (ui_mode elements) subscription session and returns only the client secret', async (t) => {
  withPrices(t, TEST_PRICES);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({ id: 'cs_test_1', client_secret: 'cs_test_1_secret_abc', customer: 'cus_x' });
  });
  for (const tier of ['partner', 'plus', 'pro']) {
    const response = await onRequestPost({ request: post({ tier }), env: ENV });
    assert.equal(response.status, 200, tier);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { clientSecret: 'cs_test_1_secret_abc' });

    const { url, init } = calls.at(-1);
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer sk_test_example');
    assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(init.headers['Stripe-Version'], '2026-09-30.endive');
    assert.equal(STRIPE_VERSION, '2026-09-30.endive');
    const form = new URLSearchParams(String(init.body));
    assert.equal(form.get('mode'), 'subscription');
    assert.equal(form.get('ui_mode'), 'elements');
    assert.equal(form.get('success_url'), null);
    assert.equal(form.get('line_items[0][price]'), TEST_PRICES[tier]);
    assert.equal(form.get('line_items[0][quantity]'), '1');
    assert.equal(form.get('return_url'), 'https://metcalfsearch.com/onboarding/?session_id={CHECKOUT_SESSION_ID}');
    assert.equal(form.get('metadata[tier]'), tier);
    assert.equal(form.get('subscription_data[metadata][tier]'), tier);
    assert.equal(form.get('billing_address_collection'), 'auto');
  }
  assert.equal(calls.length, 3);
});

test('unknown tiers and bad bodies get a 400 without calling Stripe', async (t) => {
  withPrices(t, TEST_PRICES);
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const body of [{ tier: 'gold' }, { tier: '__proto__' }, { tier: 'toString' }, { tier: 2 }, {}, 'not json', '']) {
    const response = await onRequestPost({ request: post(body), env: ENV });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.ok((await response.json()).error);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('a missing secret key or a placeholder price answers 503 checkout not configured', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  withPrices(t, TEST_PRICES);
  for (const env of [{}, { STRIPE_SECRET_KEY: '' }, undefined]) {
    const response = await onRequestPost({ request: post({ tier: 'plus' }), env });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'checkout not configured' });
  }
  PRICES.plus = 'PRICE_ID_PLUS';
  const response = await onRequestPost({ request: post({ tier: 'plus' }), env: ENV });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'checkout not configured' });
  assert.equal(upstream.mock.callCount(), 0);
});

test('a Stripe failure is a 502 that does not leak Stripe detail', async (t) => {
  withPrices(t, TEST_PRICES);
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json(
    { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such price: price_test_pro' } },
    { status: 400 }
  ));
  const response = await onRequestPost({ request: post({ tier: 'pro' }), env: ENV });
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.ok(!text.includes('price_test_pro') && !text.includes('No such price'), text);

  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
  const offline = await onRequestPost({ request: post({ tier: 'pro' }), env: ENV });
  assert.equal(offline.status, 502);
});

test('posts from another origin are refused; same-origin and no-origin posts pass', async (t) => {
  withPrices(t, TEST_PRICES);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ client_secret: 'cs_test_2_secret' }));
  const foreign = await onRequestPost({ request: post({ tier: 'partner' }, { origin: 'https://example.com' }), env: ENV });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  const same = await onRequestPost({ request: post({ tier: 'partner' }), env: ENV });
  assert.equal(same.status, 200);
  const bare = new Request(`${SITE}/api/checkout`, { method: 'POST', body: JSON.stringify({ tier: 'partner' }) });
  assert.equal((await onRequestPost({ request: bare, env: ENV })).status, 200);
});

test('OPTIONS answers 204 and other methods 405', async () => {
  const options = onRequestOptions();
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), null);
  const other = onRequest();
  assert.equal(other.status, 405);
  assert.equal(other.headers.get('allow'), 'POST, OPTIONS');
});

function status(query) {
  return new Request(`${SITE}/api/checkout-status${query}`);
}

test('checkout-status returns only status, paymentStatus, tier and email', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      id: 'cs_live_a1B2_c3', object: 'checkout.session', status: 'complete', payment_status: 'paid',
      client_secret: 'cs_live_a1B2_c3_secret_zzz', customer: 'cus_123', amount_total: 295000,
      metadata: { tier: 'partner' }, customer_details: { email: 'owner@example.com', phone: '+16145550100' }
    });
  });
  const response = await getStatus({ request: status('?session_id=cs_live_a1B2_c3'), env: ENV });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'complete', paymentStatus: 'paid', tier: 'partner', email: 'owner@example.com' });
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions/cs_live_a1B2_c3');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk_test_example');
});

test('checkout-status rejects malformed ids before calling Stripe', async (t) => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  const bad = ['', '?session_id=', '?session_id=pi_123', '?session_id=cs_', '?session_id=cs_abc%2F..%2Fx',
    '?session_id=cs_abc%3Fexpand%3Dcustomer', '?session_id=cs_abc-def', '?session_id=' + 'cs_' + 'a'.repeat(300)];
  for (const query of bad) {
    const response = await getStatus({ request: status(query), env: ENV });
    assert.equal(response.status, 400, query);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('checkout-status handles missing config, unknown sessions and Stripe outages', async (t) => {
  const missing = await getStatus({ request: status('?session_id=cs_test_1'), env: {} });
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { error: 'checkout not configured' });

  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code: 'resource_missing' } }, { status: 404 }));
  assert.equal((await getStatus({ request: status('?session_id=cs_test_1'), env: ENV })).status, 404);

  t.mock.method(globalThis, 'fetch', async () => new Response('upstream broke', { status: 500 }));
  assert.equal((await getStatus({ request: status('?session_id=cs_test_1'), env: ENV })).status, 502);

  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'open' }));
  assert.deepEqual(await (await getStatus({ request: status('?session_id=cs_test_1'), env: ENV })).json(),
    { status: 'open', paymentStatus: null, tier: null, email: null });

  assert.equal(statusOther().status, 405);
});
