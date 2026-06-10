'use client';
import { useState } from 'react';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding } from '@/types/document';
import { generatePDF } from '@/lib/generatePDF';

interface Props {
  doc: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
  branding?: ClientBranding;
}

export default function DownloadButton({ doc, templateId, colorTheme, branding }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!doc) return;
    setLoading(true);
    try {
      const bytes = await generatePDF(doc, templateId, colorTheme, branding);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'workbook'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleDownload}
        disabled={!doc || loading}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: doc ? colorTheme.primary : undefined, backgroundColor: doc ? undefined : '#9ca3af' }}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating PDF…
          </>
        ) : (
          <>
            ⬇ Download PDF
          </>
        )}
      </button>
      <p className="text-xs text-center text-gray-400">
        Fields are fillable in Adobe Reader, Preview, and Chrome
      </p>
    </div>
  );
}
