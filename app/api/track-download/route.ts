import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { recordDownload, getUsage } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title } = await req.json().catch(() => ({}));
  await recordDownload(session.clientId, typeof title === 'string' ? title.slice(0, 120) : undefined);
  const usage = await getUsage(session.clientId);
  return NextResponse.json({ ok: true, downloads: usage.downloads, lifetime: usage.lifetime });
}
