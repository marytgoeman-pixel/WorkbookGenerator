import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { listCovers, saveCover, deleteCover, coverStorageConfigured, CoverRecord } from '@/lib/coverStore';

export const runtime = 'nodejs';

async function clientIdFrom(req: NextRequest): Promise<string | null> {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return s && !s.isAdmin ? s.clientId : null;
}

// List the logged-in client's uploaded cover photos
export async function GET(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ configured: coverStorageConfigured(), covers: await listCovers(clientId) });
}

// Add a cover photo (returns 409 when the 20-photo gallery is full)
export async function POST(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const c = body?.cover as CoverRecord | undefined;
  if (!c || !c.id || !c.dataUrl) return NextResponse.json({ error: 'Invalid cover' }, { status: 400 });
  const ok = await saveCover(clientId, { id: String(c.id), label: String(c.label || 'Photo'), dataUrl: String(c.dataUrl) });
  const covers = await listCovers(clientId);
  if (!ok) return NextResponse.json({ error: 'LIMIT', configured: coverStorageConfigured(), covers }, { status: 409 });
  return NextResponse.json({ ok: true, configured: coverStorageConfigured(), covers });
}

// Delete one of the logged-in client's cover photos
export async function DELETE(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await deleteCover(clientId, id);
  return NextResponse.json({ ok: true, configured: coverStorageConfigured(), covers: await listCovers(clientId) });
}
