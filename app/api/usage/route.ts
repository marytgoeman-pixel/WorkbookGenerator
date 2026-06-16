import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getUsage } from '@/lib/analytics';

export const runtime = 'nodejs';

// The logged-in client's usage for the current calendar month (downloads + AI uses).
// The plan / download cap lives in the client's branding, so the UI compares against it.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || s.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const usage = await getUsage(s.clientId);
  return NextResponse.json(usage);
}
