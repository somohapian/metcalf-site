/**
 * POST /api/checkout
 *
 * Creates an embedded Stripe Checkout Session (subscription) for one
 * Recruiting Partner tier and returns its client secret to the tier page,
 * which mounts Stripe's embedded checkout with it.
 *
 *   Request:  {"tier": "partner" | "plus" | "pro"}
 *   Response: {"clientSecret": "..."}
 *
 * Needs the STRIPE_SECRET_KEY secret on the Pages project, in live mode to
 * match the pk_live publishable key on the tier pages. Same-origin only: no
 * CORS headers are sent.
 */

// Stripe price id for each tier. Replace each placeholder with that tier's
// monthly recurring price id from the Stripe dashboard (it starts with
// "price_"). Until a real id is in place, the tier answers 503 and its page
// shows the email-or-call line instead of the checkout.
export const PRICES = {
  partner: 'PRICE_ID_PARTNER', // Recruiting Partner, $2,875 a month
  plus: 'PRICE_ID_PLUS', // Recruiting Partner Plus, $5,575 a month
  pro: 'PRICE_ID_PRO' // Recruiting Partner Pro, $10,675 a month
};

const STRIPE_SESSIONS = 'https://api.stripe.com/v1/checkout/sessions';
const RETURN_URL = 'https://metcalfsearch.com/onboarding/?session_id={CHECKOUT_SESSION_ID}';
const ALLOW = 'POST, OPTIONS';

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }, extra)
  });
}

export async function onRequestPost({ request, env }) {
  // Browsers send Origin on POST; a page on another site gets no session.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'forbidden' }, 403);
  }

  let body = null;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: 'invalid request' }, 400);
  }
  const tier = body && typeof body.tier === 'string' ? body.tier : '';
  if (!Object.prototype.hasOwnProperty.call(PRICES, tier)) {
    return json({ error: 'unknown tier' }, 400);
  }

  const secretKey = env && env.STRIPE_SECRET_KEY;
  const price = PRICES[tier];
  if (!secretKey || !/^price_\w+$/.test(price)) {
    return json({ error: 'checkout not configured' }, 503);
  }

  const form = new URLSearchParams({
    mode: 'subscription',
    ui_mode: 'embedded',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    return_url: RETURN_URL,
    'metadata[tier]': tier,
    'subscription_data[metadata][tier]': tier,
    billing_address_collection: 'auto'
  });

  let response = null;
  let session = null;
  try {
    response = await fetch(STRIPE_SESSIONS, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    });
    session = await response.json();
  } catch (err) {
    return json({ error: 'checkout unavailable' }, 502);
  }
  if (!response.ok || !session || typeof session.client_secret !== 'string') {
    // Stripe's error detail goes to the Functions log, never to the browser.
    const detail = session && session.error ? session.error.code || session.error.type : '';
    console.error('Stripe checkout session failed', response.status, detail);
    return json({ error: 'checkout unavailable' }, 502);
  }
  return json({ clientSecret: session.client_secret });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: ALLOW, 'cache-control': 'no-store' } });
}

export function onRequest() {
  return json({ error: 'method not allowed' }, 405, { allow: ALLOW });
}
