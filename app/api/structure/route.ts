import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { structureWithAI } from '@/lib/aiStructure';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Require a logged-in client (also keeps the API key usage gated)
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI formatting is not configured.' }, { status: 503 });
  }

  const { html } = await req.json().catch(() => ({}));
  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'Missing document content.' }, { status: 400 });
  }

  try {
    const document = await structureWithAI(html);
    return NextResponse.json({ document });
  } catch (e) {
    console.error('AI structuring failed:', e);
    return NextResponse.json({ error: 'AI formatting failed.' }, { status: 500 });
  }
}
