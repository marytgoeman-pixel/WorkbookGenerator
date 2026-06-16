import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findClientByUsername } from '@/lib/clients';
import { createSession, SESSION_COOKIE } from '@/lib/auth';
import { recordLogin } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const client = findClientByUsername(username);
  // Always run a compare to reduce timing differences when the user doesn't exist
  const hash = client?.passwordHash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);

  if (!client || !ok) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const token = await createSession({
    username: client.username,
    clientId: client.branding.id,
    displayName: client.branding.displayName,
    isAdmin: client.isAdmin,
  });

  if (!client.isAdmin) await recordLogin(client.branding.id, geoFromHeaders(req.headers));

  const res = NextResponse.json({ ok: true, displayName: client.branding.displayName, isAdmin: !!client.isAdmin });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
