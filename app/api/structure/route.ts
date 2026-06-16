import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { structureWithAI } from '@/lib/aiStructure';
import { recordAiUse } from '@/lib/analytics';

// Cap the input so one oversized upload can't run up a large AI bill (~50k tokens).
const MAX_INPUT_CHARS = 200_000;

export const runtime = 'nodejs';
// Vercel Pro/Premium allows up to 300s; large briefs can take >120s to structure.
export const maxDuration = 300;

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
  if (html.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: 'This document is too large for AI auto-format. Trim it or build it manually.' }, { status: 413 });
  }

  try {
    const document = await structureWithAI(html);
    recordAiUse(session.clientId).catch(() => {}); // count the AI credit (best-effort)
    return NextResponse.json({ document });
  } catch (e) {
    console.error('AI structuring failed:', e);
    return NextResponse.json({ error: 'AI formatting failed.' }, { status: 500 });
  }
}
