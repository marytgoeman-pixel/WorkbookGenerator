'use client';
import { useState } from 'react';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding } from '@/types/document';
import { generatePDF } from '@/lib/generatePDF';

interface Props {
  doc: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
  branding?: ClientBranding;
  onDownloaded?: (counts?: { monthly?: number; lifetime?: number; charged?: boolean; workbookId?: string }) => void; // fired after a download; passes the server's counts
  atLimit?: boolean;         // when true, downloading is gated → prompt to upgrade instead
  onBlocked?: () => void;    // fired when a download is attempted at the monthly cap
  watermark?: string;        // stamp a watermark on the PDF (demo / self-serve trial)
  skipTracking?: boolean;    // don't record the download (public Try Me, which has no session)
  workbookId?: string | null;             // the saved-workbook id this download maps to (for per-workbook credits)
  ensureSaved?: () => Promise<string | null | undefined>; // persist the workbook first, returns its id
  variant?: 'full' | 'compact'; // compact = small inline button (no helper text), e.g. in a top bar
}

export default function DownloadButton({ doc, templateId, colorTheme, branding, onDownloaded, atLimit, onBlocked, watermark, skipTracking, workbookId, ensureSaved, variant = 'full' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!doc) return;
    if (atLimit) { onBlocked?.(); return; }
    setLoading(true);
    try {
      // Save first so the download is tied to a stable workbook id (drives per-workbook
      // credits: first download of a new workbook spends one; re-downloads are free).
      let wbId: string | undefined = workbookId ?? undefined;
      if (ensureSaved) { try { wbId = (await ensureSaved()) ?? wbId; } catch { /* don't block on a save hiccup */ } }

      // Generate first — if it throws, no credit is spent.
      const bytes = await generatePDF(doc, templateId, colorTheme, branding, undefined, watermark ? { watermark } : undefined);

      // Pre-flight the credit check with the server (authoritative). A free re-download of an
      // already-paid workbook always passes; only the rare soft re-download cap blocks here.
      let counts: { monthly?: number; lifetime?: number; charged?: boolean; workbookId?: string } | undefined;
      if (!skipTracking) {
        try {
          const res = await fetch('/api/track-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: doc.title, workbookId: wbId }),
          });
          if (res.ok) {
            const d = await res.json();
            if (d.allowed === false) { onBlocked?.(); return; }
            counts = {
              monthly: typeof d.workbooks === 'number' ? d.workbooks : undefined,
              lifetime: typeof d.workbooksLifetime === 'number' ? d.workbooksLifetime : undefined,
              charged: !!d.charged,
              workbookId: wbId,
            };
          }
        } catch { /* best-effort — deliver anyway, the client cap still gates new workbooks */ }
      }

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workbook'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
