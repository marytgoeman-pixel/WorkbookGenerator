import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { stripeConfigured, createCheckoutUrl, priceIdFor, BillingInterval, findActiveSubscription, createPortalUrl } from '@/lib/stripeBilling';
import { setStoredCustomer } from '@/lib/planStore';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';

// Start a Stripe Checkout session for an upgrade. Returns { url } to redirect to.
// 503 when Stripe isn't configured → the UI falls back to emailing a request.
export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || s.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan;
  const interval: BillingInterval = body?.interval === 'annual' ? 'annual' : 'monthly';
  if (!isPlanId(plan) || plan === 'enterprise') {
    return NextResponse.json({ error: 'bad_plan' }, { status: 400 });
  }
  if (!priceIdFor(plan, interval)) {
    return NextResponse.json({ error: 'no_price' }, { status: 503 });
  }

  // HARD GUARD: never create a second subscription for a client that already has one
  // (that double-charges). Send them to the portal's plan-change flow instead, and
  // backfill their customer id so the UI shows "Manage" going forward.
  try {
    const existing = await findActiveSubscription(s.clientId);
    if (existing) {
      await setStoredCustomer(s.clientId, existing.customerId);
      const portalUrl = await createPortalUrl(existing.customerId, req.nextUrl.origin, { flow: 'update' });
      if (portalUrl) return NextResponse.json({ url: portalUrl, viaPortal: true });
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });
    }
  } catch (e) {
    console.error('Duplicate-subscription guard failed:', e);
  }

  try {
    const url = await createCheckoutUrl({ clientId: s.clientId, plan, interval, origin: req.nextUrl.origin });
    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('Stripe checkout failed:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
