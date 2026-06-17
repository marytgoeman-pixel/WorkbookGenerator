import { NextRequest, NextResponse } from 'next/server';
import { recordTry } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';

// Public endpoint — the Try Me sandbox is unauthenticated. Records anonymous demo
// activity (an "open" or a "download") with approximate location for the admin view.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const event = body?.event === 'download' ? 'download' : body?.event === 'open' ? 'open' : null;
  if (!event) return NextResponse.json({ error: 'bad_event' }, { status: 400 });
  const title = typeof body?.title === 'string' ? body.title.slice(0, 120) : undefined;
  await recordTry(event, geoFromHeaders(req.headers), title);
  return NextResponse.json({ ok: true });
}
