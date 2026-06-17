import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { getBrandingById } from '@/lib/clients';
import { getAccountById, saveAccount } from '@/lib/accounts';
import { getBrandingOverride, setBrandingOverride, clearBrandingOverride, mergeBranding } from '@/lib/brandStore';
import { ICON_KEYS } from '@/lib/icons';

export const runtime = 'nodejs';

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback);

// Save template-builder choices. Managed clients save a branding OVERRIDE; self-serve
// accounts save to their account. { reset: true } (managed only) restores the original.
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isManaged = !session.clientId.startsWith('u_');
  const b = await req.json().catch(() => ({}));

  if (isManaged && b?.reset) {
    await clearBrandingOverride(session.clientId);
    return NextResponse.json({ ok: true, reset: true });
  }

  // The branding we merge edits onto.
  let cur;
  let acct = null;
  if (isManaged) {
    const base = getBrandingById(session.clientId);
    if (!base) return NextResponse.json({ error: 'No template' }, { status: 404 });
    cur = mergeBranding(base, await getBrandingOverride(session.clientId));
  } else {
    acct = await getAccountById(session.clientId);
    if (!acct) return NextResponse.json({ error: 'No account' }, { status: 404 });
    cur = acct.branding;
  }

  const c = b?.colors ?? {};
  let logoUrl = cur.logoUrl;
  if (typeof b?.logoUrl === 'string' && b.logoUrl.startsWith('data:image/') && b.logoUrl.length < 1_600_000) logoUrl = b.logoUrl;
  else if (b?.logoUrl === '') logoUrl = '';

  const pick = <T extends string>(opts: readonly T[], v: unknown, fb: T): T => (opts.includes(v as T) ? (v as T) : fb);
  const fields = {
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
    font: pick(['sans', 'serif', 'mono'] as const, b?.font, cur.font ?? 'sans'),
    coverStyle: pick(['band', 'minimal', 'photo', 'bold', 'sidebar'] as const, b?.coverStyle, cur.coverStyle ?? 'band'),
    footerStyle: pick(['standard', 'minimal', 'none'] as const, b?.footerStyle, cur.footerStyle ?? 'standard'),
    logoPosition: pick(['top', 'bottom'] as const, b?.logoPosition, cur.logoPosition ?? 'bottom'),
    calloutStyle: pick(['bar', 'plain', 'solid'] as const, b?.calloutStyle, cur.calloutStyle ?? 'bar'),
    calloutIcon: b?.calloutIcon === '' ? '' : (ICON_KEYS.includes(b?.calloutIcon) ? b.calloutIcon : (cur.calloutIcon ?? '')),
    coverLogoScale: (typeof b?.coverLogoScale === 'number' && isFinite(b.coverLogoScale))
      ? Math.max(0.5, Math.min(2.5, b.coverLogoScale)) : (cur.coverLogoScale ?? 1),
    coverLogoAlign: pick(['left', 'center', 'right'] as const, b?.coverLogoAlign, cur.coverLogoAlign ?? 'right'),
  };

  if (isManaged) {
    await setBrandingOverride(session.clientId, fields);
  } else {
    await saveAccount({ ...acct!, configured: true, branding: { ...cur, ...fields } });
  }
  return NextResponse.json({ ok: true });
}
