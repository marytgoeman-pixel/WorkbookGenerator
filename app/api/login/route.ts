import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findClientByUsername } from '@/lib/clients';
import { getAccountByEmail } from '@/lib/accounts';
import { createSession, SESSION_COOKIE } from '@/lib/auth';
import { recordLogin } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';

const DUMMY_HASH = '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const setCookie = (res: NextResponse, token: string) => {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  };

  // 1) Managed/boutique clients (hardcoded)
  const client = findClientByUsername(username);
  if (client) {
    const ok = await bcrypt.compare(password, client.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    const token = await createSession({
      username: client.username,
      clientId: client.branding.id,
      displayName: client.branding.displayName,
      isAdmin: client.isAdmin,
    });
    if (!client.isAdmin) await recordLogin(client.branding.id, geoFromHeaders(req.headers));
    return setCookie(NextResponse.json({ ok: true, displayName: client.branding.displayName, isAdmin: !!client.isAdmin }), token);
  }

  // 2) Self-serve accounts (Redis)
  const acct = await getAccountByEmail(username);
  if (acct && (await bcrypt.compare(password, acct.passwordHash))) {
    if (!acct.verified) {
      return NextResponse.json({ error: 'Please confirm your email first — check your inbox for the link.' }, { status: 403 });
    }
    const token = await createSession({
      username: acct.email,
      clientId: acct.clientId,
      displayName: acct.branding.displayName,
      isAdmin: false,
    });
    await recordLogin(acct.clientId, geoFromHeaders(req.headers));
    return setCookie(NextResponse.json({ ok: true, displayName: acct.branding.displayName, isAdmin: false }), token);
  }

  // No match — run a compare to keep timing roughly constant
  await bcrypt.compare(password, DUMMY_HASH);
  return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
}
