'use client';
import { useState } from 'react';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding } from '@/types/document';
import { generatePDF } from '@/lib/generatePDF';

interface Props {
  doc: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
  branding?: ClientBranding;
  onDownloaded?: (counts?: { monthly?: number; lifetime?: number }) => void; // fired after a download; passes the server's counts
  atLimit?: boolean;         // when true, downloading is gated → prompt to upgrade instead
  onBlocked?: () => void;    // fired when a download is attempted at the monthly cap
  watermark?: string;        // stamp a watermark on the PDF (demo / self-serve trial)
  skipTracking?: boolean;    // don't record the download (public Try Me, which has no session)
  variant?: 'full' | 'compact'; // compact = small inline button (no helper text), e.g. in a top bar
}

export default function DownloadButton({ doc, templateId, colorTheme, branding, onDownloaded, atLimit, onBlocked, watermark, skipTracking, variant = 'full' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!doc) return;
    if (atLimit) { onBlocked?.(); return; }
    setLoading(true);
    try {
      const bytes = await generatePDF(doc, templateId, colorTheme, branding, undefined, watermark ? { watermark } : undefined);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workbook'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // Record the download and use the server's authoritative monthly count to update
      // the cap (so the count can't drift and let an extra download slip through).
      // Public Try Me is sessionless — skip tracking there; self-serve trials still count
      // (watermarked) so the download cap is enforced.
      let counts: { monthly?: number; lifetime?: number } | undefined;
      if (!skipTracking) {
        try {
          const res = await fetch('/api/track-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: doc.title }),
          });
          if (res.ok) {
            const d = await res.json();
            counts = {
              monthly: typeof d.downloads === 'number' ? d.downloads : undefined,
              lifetime: typeof d.lifetime === 'number' ? d.lifetime : undefined,
            };
          }
        } catch { /* best-effort — fall back to optimistic count */ }
      }
      // Save the workbook so it can be reopened and edited later
      onDownloaded?.(counts);
    } finally {
      setLoading(false);
    }
  }

  const buttonColor = !doc ? '#9ca3af' : atLimit ? (branding?.colors.accent || '#009346') : (branding?.colors.title || colorTheme.primary || '#2563eb');

  const label = loading ? (
    <>
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      {variant === 'compact' ? 'Generating…' : 'Generating PDF…'}
    </>
  ) : atLimit ? (
    <>⬆ {variant === 'compact' ? 'Upgrade' : 'Upgrade to download more'}</>
  ) : (
    <>⬇ Download PDF</>
  );

  if (variant === 'compact') {
    return (
      <button
        onClick={handleDownload}
        disabled={!doc || loading}
        className="px-3 py-1.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-sm"
        style={{ backgroundColor: buttonColor }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleDownload}
        disabled={!doc || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        style={{ backgroundColor: buttonColor }}
      >
        {label}
      </button>
      <p className="text-xs text-center text-gray-400">
        Fields are fillable in Adobe Reader, Preview, and Chrome
      </p>
    </div>
  );
}
