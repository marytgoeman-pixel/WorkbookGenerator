import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { buildWorkbookFromBrief } from '@/lib/aiStructure';
import { recordAiUse } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_SOURCE_CHARS = 200_000;

// Build a workbook from the CRAFT intake (Claude). Requires a logged-in client (gates
// the API key + counts the AI credit).
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI is not configured.' }, { status: 503 });
  }

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const topic = str(b?.topic, 4000).trim();
  const sourceText = str(b?.sourceText, MAX_SOURCE_CHARS).trim();
  if (!topic && !sourceText) {
    return NextResponse.json({ error: 'Tell us what the workbook is about, or upload some material.' }, { status: 400 });
  }

  const brief = [
    topic && `TOPIC / CONTEXT:\n${topic}`,
    str(b?.type, 80) && `WORKBOOK TYPE: ${str(b?.type, 80)}`,
    str(b?.audience, 120) && `TARGET AUDIENCE: ${str(b?.audience, 120)}`,
    str(b?.goal, 2000) && `GOAL — what the learner should be able to do:\n${str(b?.goal, 2000)}`,
    str(b?.length, 80) && `DESIRED LENGTH: ${str(b?.length, 80)}`,
    sourceText && `SOURCE MATERIAL (base the workbook on this):\n${sourceText}`,
  ].filter(Boolean).join('\n\n');

  try {
    const document = await buildWorkbookFromBrief(brief);
    recordAiUse(session.clientId, geoFromHeaders(req.headers)).catch(() => {});
    return NextResponse.json({ document });
  } catch (e) {
    console.error('AI build failed:', e);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (e as any)?.status as number | undefined;
    let msg = 'Building the workbook failed — please try again in a moment.';
    if (status === 429) msg = 'The AI service is busy right now. Wait a few seconds and try again.';
    else if (status === 400 || status === 401 || status === 403) msg = 'The AI request was rejected — the account may be out of credits or the API key needs attention.';
    else if (e instanceof Error && /incomplete|too long|too complex/i.test(e.message)) msg = e.message;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
