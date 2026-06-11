import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { refineWithAI } from '@/lib/aiStructure';
import { DocumentModel } from '@/types/document';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503 });
  }

  const { document, instruction } = await req.json().catch(() => ({}));
  if (!document || !instruction || typeof instruction !== 'string') {
    return NextResponse.json({ error: 'Missing document or instruction.' }, { status: 400 });
  }

  try {
    const revised = await refineWithAI(document as DocumentModel, instruction);
    return NextResponse.json({ document: revised });
  } catch (e) {
    console.error('AI refine failed:', e);
    return NextResponse.json({ error: 'AI refine failed.' }, { status: 500 });
  }
}
