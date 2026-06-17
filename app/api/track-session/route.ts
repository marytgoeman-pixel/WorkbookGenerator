import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { touchSession } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';

// Session heartbeat. A logged-in client scopes to its clientId; the public Try Me (no
// session) scopes to 'tryme'. Records start + last-seen so admin can show session length.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.slice(0, 64) : '';
  if (!id) return NextResponse.json({ error: 'bad_id' }, { status: 400 });

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const scope = session && !session.isAdmin ? session.clientId : 'tryme';
  await touchSession(scope, id, geoFromHeaders(req.headers));
  return NextResponse.json({ ok: true });
}
