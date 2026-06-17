'use client';
import { useState, useEffect } from 'react';
import { DocumentModel, ColorTheme, ClientBranding } from '@/types/document';
import DocumentEditor from '@/components/DocumentEditor';
import PDFPreview from '@/components/PDFPreview';
import DownloadButton from '@/components/DownloadButton';
import { buildSampleWorkbook } from '@/lib/sampleWorkbook';
import { useSessionHeartbeat } from '@/components/useSessionHeartbeat';

const WATERMARK = 'Demo · The Learning Creative';
const TRY_DOWNLOAD_LIMIT = 3; // watermarked sample downloads per visitor before the CTA takes over

interface Props {
  branding: ClientBranding;
}

// Public, no-login "Try Me" sandbox. Loads a polished sample on upload, lets visitors
// edit / add elements, preview live, and download a watermarked PDF — then nudges them
// to request access for the clean, branded version.
export default function TryMeApp({ branding }: Props) {
  useSessionHeartbeat(); // track how long a visitor stays in the demo
  const [doc, setDoc] = useState<DocumentModel | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [previewFocus, setPreviewFocus] = useState<{ id: string; n: number } | null>(null);
  const [downloads, setDownloads] = useState(0);
  const [showCta, setShowCta] = useState(false);

  const colorTheme: ColorTheme = {
    primary: branding.colors.title,
    secondary: branding.colors.subtitle,
    background: '#FFFFFF',
  };

  useEffect(() => {
    try { setDownloads(Number(localStorage.getItem('tryme_downloads') || 0)); } catch { /* ignore */ }
  }, []);

  const atLimit = downloads >= TRY_DOWNLOAD_LIMIT;

  // Anonymous demo analytics (time + approximate location) for the admin view.
  function track(event: 'open' | 'download', title?: string) {
    fetch('/api/track-try', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, title }),
    }).catch(() => {});
  }

  // "Upload" → load the curated sample with a brief formatting beat so it feels real.
  function startSample() {
    if (formatting) return;
    track('open');
    setFormatting(true);
    setTimeout(() => {
      setDoc(buildSampleWorkbook(branding.id));
      setFormatting(false);
    }, 1100);
  }

  function onDownloaded() {
    track('download', doc?.title);
    const n = downloads + 1;
    setDownloads(n);
    try { localStorage.setItem('tryme_downloads', String(n)); } catch { /* ignore */ }
    setShowCta(true);
  }

  const requestAccessHref = '/login#inquiry';

  // Shared download props — used in three spots (top bar, under the editor, beside the preview).
  const dlProps = {
    doc,
    templateId: branding.templateId,
    colorTheme,
    branding,
    watermark: WATERMARK,
    atLimit,
    onBlocked: () => setShowCta(true),
    onDownloaded,
  };
  const watermarkNote = (
    <p className="text-xs text-center text-gray-400">
      Demo PDFs include a watermark. <a href={requestAccessHref} className="underline" style={{ color: branding.colors.subtitle }}>Request access</a> for the clean, fully-branded version.
    </p>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logoUrl} alt={branding.displayName} className="h-8 w-auto" />
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: branding.colors.accent }}>
            LIVE DEMO
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {doc && <DownloadButton {...dlProps} variant="compact" />}
          <a href={requestAccessHref} className="px-3 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: branding.colors.title }}>
            Request access →
          </a>
          <a href="/login" className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hidden sm:inline-block">Sign in</a>
        </div>
      </header>

      {!doc ? (
        /* ---------- Intro / upload ---------- */
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="max-w-xl w-full text-center">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ color: branding.colors.title }}>
              See how it works, no signup
            </h1>
            <p className="mt-3 text-gray-500">
              Drop in an outline and watch it become a branded, truly fillable workbook. We’ll start you with a sample so you can feel it instantly.
            </p>
            <button
              onClick={startSample}
              disabled={formatting}
              className={`mt-8 w-full border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${formatting ? 'opacity-70' : 'hover:border-gray-400'} `}
              style={{ borderColor: formatting ? branding.colors.accent : undefined }}
            >
              {formatting ? (
                <div className="flex flex-col items-center gap-3 text-sm" style={{ color: branding.colors.subtitle }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: branding.colors.accent, borderTopColor: 'transparent' }} />
                  ✨ Formatting your workbook…
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-3">📄</div>
                  <p className="font-semibold text-gray-700">Click to load a sample outline</p>
                  <p className="text-sm text-gray-400 mt-1">We’ll turn it into an interactive workbook</p>
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-4">Want your own logo, colors, and fonts baked in? <a href={requestAccessHref} className="underline" style={{ color: branding.colors.subtitle }}>Request access</a>.</p>
          </div>
        </main>
      ) : (
        /* ---------- Editor + preview ---------- */
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          {/* Tips strip — highlights the controls to try */}
          <div className="rounded-2xl border p-4 mb-4 text-sm" style={{ borderColor: branding.colors.accent, backgroundColor: branding.colors.grayBox }}>
            <span className="font-semibold" style={{ color: branding.colors.title }}>Try this 👇</span>
            <span className="text-gray-600"> ✏️ Edit any text or answer box · 🧩 <b>Add an element</b> (calendar, SWOT, notes) · ↡ toggle <b>“Start on new page”</b> on a section · ⬇️ download your fillable PDF.</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: editor */}
            <div className="lg:w-[440px] shrink-0 space-y-4">
              <DocumentEditor
                doc={doc}
                onChange={setDoc}
                branding={branding}
                focus={focus}
                lockElements={false}
                onUpgrade={() => { window.location.href = requestAccessHref; }}
                onActiveSection={(id) => setPreviewFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))}
              />
              {/* Download under the editor — same spot as the real software */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                <DownloadButton {...dlProps} />
                {watermarkNote}
              </div>
            </div>

            {/* Right: live preview + download */}
            <div className="flex-1 min-w-0">
              <div className="lg:sticky lg:top-6 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 h-[78vh]">
                  <PDFPreview
                    doc={doc}
                    templateId={branding.templateId}
                    colorTheme={colorTheme}
                    branding={branding}
                    watermark={WATERMARK}
                    onSelectSection={(id) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))}
                    scrollTo={previewFocus}
                  />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                  <DownloadButton {...dlProps} />
                  {watermarkNote}
                </div>

                {(showCta || atLimit) && (
                  <div className="rounded-2xl border p-5 text-center" style={{ borderColor: branding.colors.accent, backgroundColor: branding.colors.grayBox }}>
                    <p className="font-semibold" style={{ color: branding.colors.title }}>Like what you made?</p>
                    <p className="text-sm text-gray-600 mt-1">Get your own branded workspace, your logo, colors, and fonts, and clean downloads with no watermark.</p>
                    <a href={requestAccessHref} className="inline-block mt-3 px-5 py-2.5 rounded-xl font-semibold text-white" style={{ backgroundColor: branding.colors.title }}>
                      Request access →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
