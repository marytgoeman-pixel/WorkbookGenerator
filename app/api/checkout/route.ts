import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { stripeConfigured, createCheckoutUrl, priceIdFor, BillingInterval } from '@/lib/stripeBilling';
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

  try {
    const url = await createCheckoutUrl({ clientId: s.clientId, plan, interval, origin: req.nextUrl.origin });
    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('Stripe checkout failed:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
