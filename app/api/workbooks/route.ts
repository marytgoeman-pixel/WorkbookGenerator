import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { listWorkbooks, saveWorkbook, deleteWorkbook, storageConfigured, SavedWorkbook } from '@/lib/savedStore';

export const runtime = 'nodejs';

async function clientIdFrom(req: NextRequest): Promise<string | null> {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return s && !s.isAdmin ? s.clientId : null;
}

// List the logged-in client's saved workbooks
export async function GET(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workbooks = await listWorkbooks(clientId);
  return NextResponse.json({ configured: storageConfigured(), workbooks });
}

// Save (create or update) a workbook for the logged-in client
export async function POST(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const w = body?.workbook as SavedWorkbook | undefined;
  if (!w || !w.id || !w.doc) return NextResponse.json({ error: 'Invalid workbook' }, { status: 400 });
  await saveWorkbook(clientId, {
    id: String(w.id),
    title: String(w.title || 'Untitled'),
    savedAt: Number(w.savedAt) || Date.now(),
    doc: w.doc,
  });
  return NextResponse.json({ ok: true, configured: storageConfigured(), id: w.id });
}

// Delete one of the logged-in client's saved workbooks
export async function DELETE(req: NextRequest) {
  const clientId = await clientIdFrom(req);
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await deleteWorkbook(clientId, id);
  return NextResponse.json({ ok: true, configured: storageConfigured() });
}
