import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { recordDownload, chargeWorkbookDownload } from '@/lib/analytics';
import { geoFromHeaders } from '@/lib/geo';

export const runtime = 'nodejs';

// Records a download and decides whether it spends a workbook credit (first download of a
// new workbook) or is a free edit/re-download (the workbook id is already in the ledger).
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, workbookId } = await req.json().catch(() => ({}));
  const wbId = typeof workbookId === 'string' && workbookId ? workbookId.slice(0, 80) : undefined;

  const charge = await chargeWorkbookDownload(session.clientId, wbId);
  // Only log an actual download event when we're letting it through.
  if (charge.allowed) {
    await recordDownload(session.clientId, typeof title === 'string' ? title.slice(0, 120) : undefined, geoFromHeaders(req.headers));
  }
  return NextResponse.json({
    ok: true,
    allowed: charge.allowed,
    charged: charge.charged,
    workbooks: charge.workbooks,
    workbooksLifetime: charge.workbooksLifetime,
    reDownloads: charge.reDownloads,
  });
}
