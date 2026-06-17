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

export default function TemplateBuilder({ initial }: { initial: ClientBranding }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initial.displayName || '');
  const [tagline, setTagline] = useState(initial.tagline || '');
  const [logo, setLogo] = useState(initial.logoUrl || '');
  const [primary, setPrimary] = useState(initial.colors.title || NAVY);
  const [accent, setAccent] = useState(initial.colors.accent || '#0EA5E9');
  const [box, setBox] = useState(initial.colors.grayBox || '#F1F5F9');
  const [font, setFont] = useState<'sans' | 'serif' | 'mono'>(initial.font || 'sans');
  const [coverStyle, setCoverStyle] = useState<'band' | 'minimal' | 'photo'>(initial.coverStyle || 'band');
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
      const { primary: p, accent: a } = await extractColors(dataUrl);
      setPrimary(p); setAccent(a);
    } catch {
      setError('Could not read that image. Try a PNG or JPG.');
    }
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
        body: JSON.stringify({ displayName, tagline, logoUrl: logo, colors, font, coverStyle, footerStyle, logoPosition, calloutStyle, calloutIcon }),
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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GREEN }}>The Learning Creative</span>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Build your template</h1>
          <p className="text-sm text-gray-500 mt-1">Set it once — every workbook you make comes out on-brand. You can change this anytime.</p>
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
                  {logo && <button onClick={() => setLogo('')} className="block text-xs text-gray-400 hover:text-red-600">Remove</button>}
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
                {(['band', 'minimal', 'photo'] as const).map((c) => (
                  <button key={c} onClick={() => setCoverStyle(c)} className={seg(coverStyle === c)} style={coverStyle === c ? { backgroundColor: primary, borderColor: primary } : undefined}>{c[0].toUpperCase() + c.slice(1)}</button>
                ))}
              </div>
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

          {/* Live mock preview */}
          <div className="md:sticky md:top-8 self-start">
            <div className={card}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Preview</p>
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ fontFamily: FONTS[font] }}>
                {/* cover mock */}
                <div className="relative bg-white" style={{ aspectRatio: '8.5 / 11' }}>
                  {coverStyle === 'band' && <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4" style={{ backgroundColor: primary }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo ? <img src={logo} alt="" className="h-6 object-contain" /> : <span className="text-white text-xs font-bold">{displayName || 'Your Brand'}</span>}
                    <span className="text-white/80 text-[9px] uppercase">{tagline || ''}</span>
                  </div>}
                  <div className="px-6" style={{ paddingTop: coverStyle === 'band' ? 70 : 48 }}>
                    {coverStyle !== 'band' && logo && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-8 object-contain mb-4" />)}
                    <div className="text-2xl font-bold leading-tight" style={{ color: primary }}>Sample Workbook</div>
                    <div className="text-sm mt-1" style={{ color: accent }}>A hands-on guide</div>
                    <div className="mt-5 rounded-md border p-3 text-[10px] text-gray-400" style={{ backgroundColor: box, borderColor: accent }}>Your fillable answer box</div>
                    <div className="mt-3 flex items-start gap-1 text-[11px]" style={{ color: '#1f2937' }}><span style={{ color: accent }}>■</span> A sample bullet point</div>
                  </div>
                  {footerStyle !== 'none' && <div className="absolute bottom-0 left-0 right-0 px-4 py-1.5 flex items-center justify-between text-[8px] text-gray-400 border-t" style={{ borderColor: '#eee' }}>
                    <span>{footerStyle === 'standard' ? (displayName || 'Your Brand') : ''}</span>
                    <span>Page 1</span>
                  </div>}
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mt-3">{error}</p>}
            <button onClick={save} disabled={saving} className="w-full mt-3 py-3 rounded-xl font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>
              {saving ? 'Saving…' : 'Save template & continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
