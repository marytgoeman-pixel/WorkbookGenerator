import { NextRequest, NextResponse } from 'next/server';
import { sendInquiryEmail } from '@/lib/email';

export const runtime = 'nodejs';

// Public endpoint (the marketing page is unauthenticated). Sends the access-request
// inquiry to the owner. Returns { ok, sent }: sent=false means email isn't configured,
// so the client falls back to opening the visitor's mail app.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const name = str(body?.name, 200).trim();
  const email = str(body?.email, 200).trim();
  if (!name || !email) return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });

  const sent = await sendInquiryEmail({
    name,
    email,
    company: str(body?.company, 200),
    plan: str(body?.plan, 80),
    message: str(body?.message, 4000),
  });
  return NextResponse.json({ ok: true, sent });
}
