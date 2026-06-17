'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientBranding } from '@/types/document';
import { CALLOUT_ICONS, ICON_KEYS } from '@/lib/icons';

const NAVY = '#163446', GREEN = '#009346';

// Downscale an uploaded logo to a small PNG data URL (keeps the account record small).
function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('bad image'));
      img.src = fr.result as string;
    };
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(file);
  });
}

// Make a white-silhouette version of a logo: every non-transparent pixel becomes white,
// alpha (and anti-aliased edges) preserved. Used for placing the logo on dark cover bands.
function whitenLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, cv.width, cv.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; } }
      ctx.putImageData(id, 0, 0);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('bad image'));
    img.src = dataUrl;
  });
}

// Pull a dark "primary" and a saturated "accent" color out of the logo.
function extractColors(dataUrl: string): Promise<{ primary: string; accent: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = 48; const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
      const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0, s, s);
      const d = ctx.getImageData(0, 0, s, s).data;
      const buckets: Record<string, { n: number; r: number; g: number; b: number; sat: number }> = {};
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx > 240 && mn > 240) continue; // near-white
        const key = `${r >> 5},${g >> 5},${b >> 5}`;
        const k = (buckets[key] ||= { n: 0, r: 0, g: 0, b: 0, sat: 0 });
        k.n++; k.r += r; k.g += g; k.b += b; k.sat += mx - mn;
      }
      const arr = Object.values(buckets).map((k) => ({ r: Math.round(k.r / k.n), g: Math.round(k.g / k.n), b: Math.round(k.b / k.n), sat: k.sat / k.n }));
      const toHex = (c: { r: number; g: number; b: number }) => '#' + [c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, '0')).join('');
      if (!arr.length) return resolve({ primary: NAVY, accent: '#0EA5E9' });
      const darkest = [...arr].sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b))[0];
      const mostSat = [...arr].sort((a, b) => b.sat - a.sat)[0];
      resolve({ primary: toHex(darkest), accent: toHex(mostSat) });
    };
    img.onerror = () => resolve({ primary: NAVY, accent: '#0EA5E9' });
    img.src = dataUrl;
  });
}

const FONTS: Record<string, string> = { sans: 'system-ui, sans-serif', serif: 'Georgia, serif', mono: 'ui-monospace, monospace' };

export default function TemplateBuilder({ initial, managed }: { initial: ClientBranding; managed?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initial.displayName || '');
  const [tagline, setTagline] = useState(initial.tagline || '');
  const [logo, setLogo] = useState(initial.logoUrl || '');
  const [primary, setPrimary] = useState(initial.colors.title || NAVY);
  const [accent, setAccent] = useState(initial.colors.accent || '#0EA5E9');
  const [box, setBox] = useState(initial.colors.grayBox || '#F1F5F9');
  const [font, setFont] = useState<'sans' | 'serif' | 'mono'>(initial.font || 'sans');
  const [coverStyle, setCoverStyle] = useState<'band' | 'minimal' | 'photo' | 'bold' | 'sidebar'>(initial.coverStyle || 'band');
  const [coverLogoScale, setCoverLogoScale] = useState<number>(initial.coverLogoScale ?? 1);
  const [coverLogoAlign, setCoverLogoAlign] = useState<'left' | 'center' | 'right'>(initial.coverLogoAlign || 'right');
  const [coverLogoWhite, setCoverLogoWhite] = useState<boolean>(initial.coverLogoWhite ?? true);
  const [logoWhite, setLogoWhite] = useState(initial.logoUrlWhite || '');
  const [footerStyle, setFooterStyle] = useState<'standard' | 'minimal' | 'none'>(initial.footerStyle || 'standard');
  const [logoPosition, setLogoPosition] = useState<'top' | 'bottom'>(initial.logoPosition || 'bottom');
  const [calloutStyle, setCalloutStyle] = useState<'bar' | 'plain' | 'solid'>(initial.calloutStyle || 'bar');
  const [calloutIcon, setCalloutIcon] = useState<string>(initial.calloutIcon || '');
  const [iconQuery, setIconQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function onLogo(file: File) {
    setError('');
    try {
      const dataUrl = await resizeLogo(file);
      setLogo(dataUrl);
      setLogoWhite(await whitenLogo(dataUrl).catch(() => '')); // keep the white variant in sync
      const { primary: p, accent: a } = await extractColors(dataUrl);
      setPrimary(p); setAccent(a);
    } catch {
      setError('Could not read that image. Try a PNG or JPG.');
    }
  }

  // Turning the white-logo option on generates the white variant if we don't have one yet.
  async function toggleWhiteLogo() {
    const next = !coverLogoWhite;
    setCoverLogoWhite(next);
    if (next && logo && !logoWhite) setLogoWhite(await whitenLogo(logo).catch(() => ''));
  }

  async function resetToOriginal() {
    if (!confirm('Reset to your original template? This removes your custom changes.')) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      if (res.ok) { router.push('/'); router.refresh(); return; }
      setError('Could not reset.');
    } catch { setError('Could not reset.'); } finally { setSaving(false); }
  }

  async function save() {
    setSaving(true); setError('');
    const colors = {
      header: primary, title: primary, subtitle: accent, accent,
      calloutBg: primary, calloutBorder: accent, grayBox: box,
    };
    try {
      const res = await fetch('/api/template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, tagline, logoUrl: logo, logoUrlWhite: logoWhite, colors, font, coverStyle, coverLogoScale, coverLogoAlign, coverLogoWhite, footerStyle, logoPosition, calloutStyle, calloutIcon }),
      });
      if (res.ok) { router.push('/'); router.refresh(); return; }
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Could not save your template.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const label = 'block text-xs font-semibold text-gray-500 mb-1';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';
  const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm border ${active ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;

  // Cover-preview logo: scales with the size slider; falls back to the brand name when no
  // logo is uploaded. onDark picks a readable color for that text fallback.
  const coverLogoH = Math.round(24 * coverLogoScale);
  const logoSlot = (onDark: boolean) => logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} alt="" style={{ height: coverLogoH, filter: coverLogoWhite && onDark ? 'brightness(0) invert(1)' : undefined }} className="object-contain max-w-[70%]" />
    : <span className="font-bold text-[11px]" style={{ color: onDark ? '#fff' : primary }}>{displayName || 'Your Brand'}</span>;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GREEN }}>The Learning Creative</span>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{managed ? 'Edit your template' : 'Build your template'}</h1>
          <p className="text-sm text-gray-500 mt-1">Set it once, every workbook comes out on-brand. You can change this anytime.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className={card}>
              <label className={label}>Brand / business name</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <label className={`${label} mt-3`}>Tagline (footer)</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Practical tools for growth" />
            </div>

            <div className={card}>
              <label className={label}>Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logo ? <img src={logo} alt="logo" className="max-w-full max-h-full" /> : <span className="text-gray-300 text-xs">No logo</span>}
                </div>
                <div className="space-y-1">
                  <button onClick={() => fileRef.current?.click()} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400">{logo ? 'Replace logo' : 'Upload logo'}</button>
                  {logo && <button onClick={() => { setLogo(''); setLogoWhite(''); }} className="block text-xs text-gray-400 hover:text-red-600">Remove</button>}
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); }} />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">PNG with transparency works best. Uploading a logo auto-suggests your colors below.</p>
            </div>

            <div className={card}>
              <label className={label}>Colors</label>
              <div className="grid grid-cols-3 gap-3">
                {([['Primary', primary, setPrimary], ['Accent', accent, setAccent], ['Field tint', box, setBox]] as const).map(([name, val, set]) => (
                  <label key={name} className="text-xs text-gray-500">
                    {name}
                    <input type="color" value={val} onChange={(e) => set(e.target.value)} className="block w-full h-9 rounded border border-gray-200 mt-1 cursor-pointer" />
                  </label>
                ))}
              </div>
              {logo && <button onClick={() => extractColors(logo).then(({ primary: p, accent: a }) => { setPrimary(p); setAccent(a); })} className="text-xs mt-2 underline" style={{ color: GREEN }}>↺ Use my logo&apos;s colors</button>}
            </div>

            <div className={card}>
              <label className={label}>Font</label>
              <div className="flex gap-2">
                {(['sans', 'serif', 'mono'] as const).map((f) => (
                  <button key={f} onClick={() => setFont(f)} className={seg(font === f)} style={font === f ? { backgroundColor: primary, borderColor: primary } : undefined}>
                    <span style={{ fontFamily: FONTS[f] }}>{f === 'sans' ? 'Sans' : f === 'serif' ? 'Serif' : 'Mono'}</span>
                  </button>
                ))}
              </div>
              <label className={`${label} mt-3`}>Cover style</label>
              <div className="flex gap-2 flex-wrap">
                {([['band', 'Band'], ['photo', 'Photo'], ['minimal', 'Minimal'], ['bold', 'Bold color'], ['sidebar', 'Sidebar']] as const).map(([c, lbl]) => (
                  <button key={c} onClick={() => setCoverStyle(c)} className={seg(coverStyle === c)} style={coverStyle === c ? { backgroundColor: primary, borderColor: primary } : undefined}>{lbl}</button>
                ))}
              </div>

              <label className={`${label} mt-3`}>Cover logo size</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0.5} max={2.5} step={0.1} value={coverLogoScale} onChange={(e) => setCoverLogoScale(parseFloat(e.target.value))} className="flex-1" />
                <span className="text-xs text-gray-500 w-10 text-right">{Math.round(coverLogoScale * 100)}%</span>
              </div>
              <label className={`${label} mt-3`}>Cover logo position</label>
              <div className="flex gap-2 flex-wrap">
                {([['left', 'Left'], ['center', 'Center'], ['right', 'Right']] as const).map(([v, lbl]) => (
                  <button key={v} onClick={() => setCoverLogoAlign(v)} className={seg(coverLogoAlign === v)} style={coverLogoAlign === v ? { backgroundColor: primary, borderColor: primary } : undefined}>{lbl}</button>
                ))}
              </div>

              <button onClick={toggleWhiteLogo} className="flex items-center gap-2 mt-3 text-left">
                <span className={`w-9 h-5 rounded-full relative transition-colors ${coverLogoWhite ? '' : 'bg-gray-200'}`} style={coverLogoWhite ? { backgroundColor: primary } : undefined}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${coverLogoWhite ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
                <span className="text-sm text-gray-600">Use a white logo on dark covers</span>
              </button>
              <p className="text-[11px] text-gray-400 mt-1">Recolors your logo white so it shows up on the Band, Bold color &amp; Sidebar covers. Leave off if your logo is already light.</p>

              <label className={`${label} mt-3`}>Footer style</label>
              <div className="flex gap-2 flex-wrap">
                {(['standard', 'minimal', 'none'] as const).map((c) => (
                  <button key={c} onClick={() => setFooterStyle(c)} className={seg(footerStyle === c)} style={footerStyle === c ? { backgroundColor: primary, borderColor: primary } : undefined}>{c[0].toUpperCase() + c.slice(1)}</button>
                ))}
              </div>
              <label className={`${label} mt-3`}>Logo position (interior pages)</label>
              <div className="flex gap-2 flex-wrap">
                {([['top', 'Top bar'], ['bottom', 'Footer']] as const).map(([v, lbl]) => (
                  <button key={v} onClick={() => setLogoPosition(v)} className={seg(logoPosition === v)} style={logoPosition === v ? { backgroundColor: primary, borderColor: primary } : undefined}>{lbl}</button>
                ))}
              </div>
              <label className={`${label} mt-3`}>Callout style</label>
              <div className="flex gap-2 flex-wrap">
                {([['bar', 'Accent bar'], ['plain', 'Plain'], ['solid', 'Solid']] as const).map(([v, lbl]) => (
                  <button key={v} onClick={() => setCalloutStyle(v)} className={seg(calloutStyle === v)} style={calloutStyle === v ? { backgroundColor: primary, borderColor: primary } : undefined}>{lbl}</button>
                ))}
              </div>

              <label className={`${label} mt-3`}>Callout icon (optional)</label>
              <input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Search icons (star, idea, goal…)" className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2" />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCalloutIcon('')} title="No icon"
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs ${calloutIcon === '' ? 'text-white' : 'bg-white text-gray-500 border-gray-200'}`}
                  style={calloutIcon === '' ? { backgroundColor: primary, borderColor: primary } : undefined}>None</button>
                {ICON_KEYS.filter((k) => {
                  const q = iconQuery.trim().toLowerCase();
                  if (!q) return true;
                  const ic = CALLOUT_ICONS[k];
                  return k.includes(q) || ic.label.toLowerCase().includes(q) || ic.keywords.includes(q);
                }).map((k) => (
                  <button key={k} onClick={() => setCalloutIcon(k)} title={CALLOUT_ICONS[k].label}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center ${calloutIcon === k ? 'border-2' : 'border-gray-200 hover:border-gray-300'}`}
                    style={{ borderColor: calloutIcon === k ? accent : undefined, color: accent }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d={CALLOUT_ICONS[k].path} /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live mock previews — cover first, then an interior page */}
          <div className="md:sticky md:top-8 self-start space-y-4">
            {/* COVER preview */}
            <div className={card}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cover preview</p>
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ fontFamily: FONTS[font] }}>
                <div className="relative" style={{ aspectRatio: '8.5 / 11', backgroundColor: '#fff' }}>
                  {(() => {
                    const justify = coverLogoAlign === 'left' ? 'flex-start' : coverLogoAlign === 'right' ? 'flex-end' : 'center';

                    // BAND — photo area on top, brand band along the bottom with the title + logo.
                    if (coverStyle === 'band' || coverStyle === 'photo') {
                      const bandPct = coverStyle === 'photo' ? 34 : 46;
                      return (<>
                        <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${100 - bandPct}%` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/covers/thumb-3.jpg" alt="Sample cover photo" className="w-full h-full object-cover" />
                          <span className="absolute top-1 left-1 text-[8px] text-white bg-black/45 rounded px-1 py-0.5">Sample image</span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 px-5 pt-3 pb-4 flex flex-col justify-end" style={{ height: `${bandPct}%`, backgroundColor: primary }}>
                          <div className="text-[9px] uppercase tracking-wide" style={{ color: accent }}>A hands-on guide</div>
                          <div className="text-lg font-bold leading-tight text-white">Sample Workbook</div>
                          <div className="inline-block self-start text-[10px] text-white px-1.5 py-0.5 mt-1" style={{ backgroundColor: accent }}>{displayName || 'Your Brand'}</div>
                          <div className="flex items-end mt-2" style={{ justifyContent: justify }}>{logoSlot(true)}</div>
                        </div>
                      </>);
                    }

                    // BOLD — full brand color, everything centered.
                    if (coverStyle === 'bold') {
                      return (<div className="absolute inset-0 flex flex-col items-center justify-between py-8 px-5" style={{ backgroundColor: primary }}>
                        <div className="w-full flex" style={{ justifyContent: justify }}>{logoSlot(true)}</div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-white leading-tight">Sample Workbook</div>
                          <div className="h-1 w-12 mx-auto my-2" style={{ backgroundColor: accent }} />
                          <div className="text-[11px]" style={{ color: '#dbe4ea' }}>A hands-on guide</div>
                        </div>
                        <div className="text-[10px] text-white/80">{displayName || 'Your Brand'} · {tagline || ''}</div>
                      </div>);
                    }

                    // SIDEBAR — vertical brand band on one side, title on the white field.
                    if (coverStyle === 'sidebar') {
                      const onLeft = coverLogoAlign !== 'right';
                      const bar = (<div className="absolute inset-y-0 flex flex-col items-center justify-between py-6 px-2" style={{ width: '36%', backgroundColor: primary, left: onLeft ? 0 : undefined, right: onLeft ? undefined : 0 }}>
                        <div>{logoSlot(true)}</div>
                        <div className="text-[8px] text-center" style={{ color: '#dbe4ea' }}>{tagline || ''}</div>
                      </div>);
                      return (<>
                        {bar}
                        <div className="absolute inset-y-0 flex flex-col justify-center px-4" style={{ width: '60%', left: onLeft ? undefined : 0, right: onLeft ? 0 : undefined }}>
                          <div className="text-lg font-bold leading-tight" style={{ color: primary }}>Sample Workbook</div>
                          <div className="h-1 w-10 my-2" style={{ backgroundColor: accent }} />
                          <div className="text-[11px]" style={{ color: accent }}>A hands-on guide</div>
                        </div>
                      </>);
                    }

                    // MINIMAL — clean white, logo on top, title below.
                    return (<div className="absolute inset-0 flex flex-col px-6 pt-8 pb-6">
                      <div className="flex" style={{ justifyContent: justify }}>{logoSlot(false)}</div>
                      <div className="mt-auto">
                        <div className="text-xl font-bold leading-tight" style={{ color: primary }}>Sample Workbook</div>
                        <div className="h-1 w-12 my-2" style={{ backgroundColor: accent }} />
                        <div className="text-[11px]" style={{ color: accent }}>A hands-on guide</div>
                        <div className="text-[10px] text-gray-400 mt-3">{displayName || 'Your Brand'}</div>
                      </div>
                    </div>);
                  })()}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">The photo on the Band &amp; Photo covers is a sample — you choose the real cover image when you build each workbook.</p>
            </div>

            {/* PAGE preview */}
            <div className={card}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Page preview</p>
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ fontFamily: FONTS[font] }}>
                <div className="relative bg-white" style={{ aspectRatio: '8.5 / 11' }}>
                  {logoPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-9 flex items-center justify-between px-4" style={{ backgroundColor: primary }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo ? <img src={logo} alt="" className="h-5 object-contain" /> : <span className="text-white text-[10px] font-bold">{displayName || 'Your Brand'}</span>}
                  </div>}
                  <div className="px-6" style={{ paddingTop: logoPosition === 'top' ? 52 : 28 }}>
                    <div className="text-lg font-bold" style={{ color: primary }}>Section heading</div>
                    <div className="text-[11px] text-gray-600 mt-1">A short prompt that introduces the exercise below.</div>
                    <div className="mt-3 rounded-md border p-3 text-[10px] text-gray-400" style={{ backgroundColor: box, borderColor: accent }}>Your fillable answer box</div>
                    <div className="mt-3 flex items-start gap-1.5 text-[11px]" style={{ color: '#1f2937' }}><span style={{ color: accent }}>■</span> A sample bullet point</div>
                    {/* callout sample reflecting calloutStyle + icon */}
                    <div className="mt-3 flex items-start gap-2 p-2.5 text-[10px]"
                      style={calloutStyle === 'solid'
                        ? { backgroundColor: primary, color: '#fff', borderRadius: 6 }
                        : { backgroundColor: box, color: '#1f2937', borderRadius: 6, borderLeft: calloutStyle === 'plain' ? undefined : `4px solid ${accent}` }}>
                      {calloutIcon && CALLOUT_ICONS[calloutIcon] && (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill={calloutStyle === 'solid' ? '#fff' : accent} className="mt-0.5 shrink-0"><path d={CALLOUT_ICONS[calloutIcon].path} /></svg>
                      )}
                      <span>A highlighted callout or tip box.</span>
                    </div>
                  </div>
                  {footerStyle !== 'none' && <div className="absolute bottom-0 left-0 right-0 px-4 py-1.5 flex items-center justify-between text-[8px] text-gray-400 border-t" style={{ borderColor: '#eee' }}>
                    {logoPosition === 'bottom' && logo
                      ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-3.5 object-contain" />)
                      : <span>{footerStyle === 'standard' ? (displayName || 'Your Brand') : ''}</span>}
                    <span>Page 1</span>
                  </div>}
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mt-3">{error}</p>}
            <button onClick={save} disabled={saving} className="w-full mt-3 py-3 rounded-xl font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>
              {saving ? 'Saving…' : 'Save template & continue →'}
            </button>
            {managed && (
              <button onClick={resetToOriginal} disabled={saving} className="w-full mt-2 py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-60">
                Reset to my original template
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
