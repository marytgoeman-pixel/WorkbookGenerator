import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { clientIds } from '@/lib/clients';
import { clearStoredPlan, clearTrialStart } from '@/lib/planStore';
import { resetDownloadCounts } from '@/lib/analytics';

export const runtime = 'nodejs';

// Admin-only: reset a client to a fresh 7-day trial — clears any paid-plan override +
// Stripe customer, restarts the trial clock, and zeroes their download counters so the
// free download is available again. Used to re-arm a demo account.
export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || !s.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
  if (!clientId || !clientIds().includes(clientId)) {
    return NextResponse.json({ error: 'bad_client' }, { status: 400 });
  }

  await Promise.all([
    clearStoredPlan(clientId),
    clearTrialStart(clientId),
    resetDownloadCounts(clientId),
  ]);
  return NextResponse.json({ ok: true });
}
