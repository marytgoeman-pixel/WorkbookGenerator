import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { resetPassword } from '@/lib/accounts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const token = typeof b?.token === 'string' ? b.token : '';
  const password = typeof b?.password === 'string' ? b.password : '';
  if (!token) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 });

  const ok = await resetPassword(token, await bcrypt.hash(password, 10));
  if (!ok) return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
