import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { stripeConfigured, createPortalUrl } from '@/lib/stripeBilling';
import { getStoredCustomer } from '@/lib/planStore';

export const runtime = 'nodejs';

// Open the Stripe Customer Portal for an existing subscriber so they can change or
// cancel their plan (edits the existing subscription — no duplicate charge).
// Returns { url } to redirect to; 503/404 when not available → UI falls back to email.
export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || s.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const customerId = await getStoredCustomer(s.clientId);
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const flow = body?.flow === 'update' ? ('update' as const) : undefined;

  try {
    const url = await createPortalUrl(customerId, req.nextUrl.origin, flow ? { flow } : undefined);
    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 });
    return NextResponse.json({ url });
  } catch (e) {
    console.error('Stripe portal failed:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
