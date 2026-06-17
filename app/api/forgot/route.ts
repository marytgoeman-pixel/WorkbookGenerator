import { NextRequest, NextResponse } from 'next/server';
import { getAccountByEmail, createResetToken } from '@/lib/accounts';
import { sendResetEmail } from '@/lib/email';

export const runtime = 'nodejs';

// Request a password-reset link. Always returns ok (never reveals whether an account
// exists). Only self-serve accounts can be reset here; managed clients contact support.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = typeof b?.email === 'string' ? b.email.trim() : '';
  if (email) {
    const acct = await getAccountByEmail(email);
    if (acct) {
      const token = await createResetToken(acct.clientId);
      if (token) await sendResetEmail(acct.email, `${req.nextUrl.origin}/reset?token=${token}`);
    }
  }
  return NextResponse.json({ ok: true });
}
