/**
 * GET /api/checkout-status?session_id=cs_...
 *
 * Looks up one Checkout Session for the onboarding page (Stripe returns the
 * buyer there with ?session_id=...) and answers with four fields only:
 * {status, paymentStatus, tier, email}. The raw session never leaves the
 * function. Uses the same STRIPE_SECRET_KEY secret as /api/checkout.
 */

const STRIPE_SESSIONS = 'https://api.stripe.com/v1/checkout/sessions/';
const SESSION_ID = /^cs_[A-Za-z0-9_]+$/;

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

const text = (value) => (typeof value === 'string' ? value : null);

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('session_id') || '';
  if (id.length > 255 || !SESSION_ID.test(id)) {
    return json({ error: 'invalid session_id' }, 400);
  }
  const secretKey = env && env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'checkout not configured' }, 503);
  }

  let response = null;
  let session = null;
  try {
    response = await fetch(STRIPE_SESSIONS + id, {
      headers: { Authorization: 'Bearer ' + secretKey }
    });
    session = await response.json();
  } catch (err) {
    return json({ error: 'status unavailable' }, 502);
  }
  if (response.status === 404) {
    return json({ error: 'session not found' }, 404);
  }
  if (!response.ok || !session || typeof session !== 'object') {
    return json({ error: 'status unavailable' }, 502);
  }

  const metadata = session.metadata || {};
  const details = session.customer_details || {};
  return json({
    status: text(session.status),
    paymentStatus: text(session.payment_status),
    tier: text(metadata.tier),
    email: text(details.email)
  });
}

export function onRequest() {
  return json({ error: 'method not allowed' }, 405, { allow: 'GET' });
}
