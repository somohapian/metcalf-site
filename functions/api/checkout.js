/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout Session (subscription) for one Recruiting
 * Partner tier in Stripe's custom checkout mode and returns its client secret
 * to the tier page, which renders our own form around the Payment Element
 * (Stripe.js initCheckoutElementsSdk).
 *
 * Custom checkout: Stripe renamed ui_mode "custom" to "elements" in API
 * version 2026-03-25.dahlia, and "custom" is refused from then on. The
 * request pins STRIPE_VERSION so the session does not depend on the
 * account's default API version, and the tier pages load the matching
 * Stripe.js release (https://js.stripe.com/endive/stripe.js). Stripe asks
 * that the server API version and the Stripe.js release stay on one train:
 * change both together.
 *
 *   Request:  {"tier": "partner" | "plus" | "pro"}
 *   Response: {"clientSecret": "..."}
 *
 * Needs the STRIPE_SECRET_KEY secret on the Pages project, in live mode to
 * match the pk_live publishable key on the tier pages. Same-origin only: no
 * CORS headers are sent.
 */

// Stripe price id for each tier: the monthly recurring price on that tier's
// product in the Stripe dashboard (it starts with "price_"). When the list
// price changes, create a new price in Stripe (never edit an old one, existing
// subscribers keep theirs) and put the new id here. A tier without a real id
// answers 503 and its page shows the email-or-call line instead of the checkout.
export const PRICES = {
  partner: 'price_1UUc76AoR3j4s929DNwkRUuw', // Recruiting Partner, $2,950 a month (Oct 2026)
  plus: 'price_1UUc8EAoR3j4s9294mudwGZd', // Recruiting Partner Plus, $5,950 a month (Oct 2026)
  pro: 'price_1UUc91AoR3j4s929cRLOBsDw' // Recruiting Partner Pro, $10,950 a month (Oct 2026)
};

const STRIPE_SESSIONS = 'https://api.stripe.com/v1/checkout/sessions';
export const STRIPE_VERSION = '2026-09-30.endive';
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
    ui_mode: 'elements',
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_VERSION
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
