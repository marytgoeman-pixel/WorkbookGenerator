import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ClientBranding } from '@/types/document';
import { createAccount, createVerifyToken } from '@/lib/accounts';
import { sendVerifyEmail, sendInquiryEmail } from '@/lib/email';

export const runtime = 'nodejs';

// A neutral starter template; the builder (Stage 2) customizes logo/colors/fonts/styles.
function starterBranding(displayName: string): ClientBranding {
  return {
    id: 'pending',
    displayName,
    templateId: 'tlc',
    tagline: '',
    logoUrl: '',
    social: [],
    colors: {
      header: '#163446', title: '#163446', subtitle: '#334155', accent: '#0EA5E9',
      calloutBg: '#163446', calloutBorder: '#0EA5E9', grayBox: '#F1F5F9',
    },
    // Self-serve trial: 2 downloads (watermarked — applied in Stage 3).
    plan: { name: 'Trial', downloadsPerMonth: 2, trial: true },
  };
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = typeof b?.email === 'string' ? b.email.trim() : '';
  const password = typeof b?.password === 'string' ? b.password : '';
  const name = (typeof b?.name === 'string' ? b.name.trim() : '').slice(0, 80);
  const boutique = !!b?.boutique;

  if (!emailOk(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await createAccount({ email, passwordHash, boutique, branding: starterBranding(name || email.split('@')[0]) });
  if ('error' in created) return NextResponse.json({ error: created.error }, { status: 409 });

  // Boutique: also notify the owner so they can do the done-for-you setup.
  if (boutique) {
    sendInquiryEmail({ name: name || email, email, plan: 'Boutique setup ($499)', message: 'Registered and requested the done-for-you setup option.' }).catch(() => {});
  }

  // Email confirmation
  const token = await createVerifyToken(created.account.clientId);
  let emailed = false;
  if (token) emailed = await sendVerifyEmail(email, `${req.nextUrl.origin}/verify?token=${token}`);

  return NextResponse.json({ ok: true, emailed, boutique });
}
