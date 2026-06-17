import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getAccountById, saveAccount } from '@/lib/accounts';

export const runtime = 'nodejs';

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback);

// Save the self-serve template builder choices to the account's branding.
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || !session.clientId.startsWith('u_')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const acct = await getAccountById(session.clientId);
  if (!acct) return NextResponse.json({ error: 'No account' }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const c = b?.colors ?? {};
  const cur = acct.branding;

  // Logo: accept a data URL up to ~1.5 MB (keeps the Redis record small); else keep current.
  let logoUrl = cur.logoUrl;
  if (typeof b?.logoUrl === 'string' && b.logoUrl.startsWith('data:image/') && b.logoUrl.length < 1_600_000) {
    logoUrl = b.logoUrl;
  } else if (b?.logoUrl === '') {
    logoUrl = '';
  }

  const font = ['sans', 'serif', 'mono'].includes(b?.font) ? b.font : (cur.font ?? 'sans');
  const coverStyle = ['band', 'minimal', 'photo'].includes(b?.coverStyle) ? b.coverStyle : (cur.coverStyle ?? 'band');
  const footerStyle = ['standard', 'minimal', 'none'].includes(b?.footerStyle) ? b.footerStyle : (cur.footerStyle ?? 'standard');
  const logoPosition = ['top', 'bottom'].includes(b?.logoPosition) ? b.logoPosition : (cur.logoPosition ?? 'bottom');
  const calloutStyle = ['bar', 'plain', 'solid'].includes(b?.calloutStyle) ? b.calloutStyle : (cur.calloutStyle ?? 'bar');

  const branding = {
    ...cur,
    displayName: (typeof b?.displayName === 'string' && b.displayName.trim()) ? b.displayName.trim().slice(0, 80) : cur.displayName,
    tagline: typeof b?.tagline === 'string' ? b.tagline.slice(0, 120) : cur.tagline,
    logoUrl,
    colors: {
      header: hex(c.header, cur.colors.header),
      title: hex(c.title, cur.colors.title),
      subtitle: hex(c.subtitle, cur.colors.subtitle),
      accent: hex(c.accent, cur.colors.accent),
      calloutBg: hex(c.calloutBg, cur.colors.calloutBg),
      calloutBorder: hex(c.calloutBorder, cur.colors.calloutBorder),
      grayBox: hex(c.grayBox, cur.colors.grayBox),
    },
    font,
    coverStyle,
    footerStyle,
    logoPosition,
    calloutStyle,
  };

  await saveAccount({ ...acct, configured: true, branding });
  return NextResponse.json({ ok: true });
}
