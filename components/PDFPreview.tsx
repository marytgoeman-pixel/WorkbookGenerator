'use client';
import { useEffect, useState, useRef } from 'react';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding } from '@/types/document';
import { generatePDF } from '@/lib/generatePDF';

interface Props {
  doc: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
  branding?: ClientBranding;
}

export default function PDFPreview({ doc, templateId, colorTheme, branding }: Props) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  // Native-PDF fallback (used if pdf.js can't render — e.g. older Safari): a blob URL in an <iframe>
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!doc) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      const revokeBlob = () => {
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      };
      try {
        const bytes = await generatePDF(doc, templateId, colorTheme, branding);

        // Always prepare a native-PDF blob URL as a robust fallback for any browser
        // whose pdf.js canvas path fails (notably older Safari on macOS).
        revokeBlob();
        const blob = new Blob([bytes.slice(0) as unknown as BlobPart], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        try {
          // Use the LEGACY pdf.js build — it targets older browsers (incl. older Safari),
          // unlike the modern build which relies on very recent JS features.
          // @ts-ignore - legacy build path has no bundled type declarations
          const pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as typeof import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

          const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
          const pdf = await loadingTask.promise;

          const images: string[] = [];
          const maxPages = Math.min(pdf.numPages, 10); // cap preview at 10 pages
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({
              canvasContext: ctx as unknown as CanvasRenderingContext2D,
              canvas,
              viewport,
              annotationMode: pdfjsLib.AnnotationMode.ENABLE,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).promise;
            images.push(canvas.toDataURL('image/png'));
          }
          setPageImages(images);
          setFallbackUrl(null);
          revokeBlob(); // canvas path worked; the blob isn't needed
        } catch (renderErr) {
          // pdf.js failed (e.g. unsupported on this browser) — show the native PDF viewer instead
          console.warn('pdf.js preview failed; falling back to native PDF viewer:', renderErr);
          setPageImages([]);
          setFallbackUrl(blobUrl);
        }
      } catch (e) {
        console.error('Preview generation failed:', e);
        setError('Could not render preview.');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [doc, templateId, colorTheme, branding]);

  // Revoke any outstanding blob URL on unmount
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  if (!doc) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-5xl mb-4">📄</div>
        <p className="text-sm font-medium">Preview will appear here</p>
        <p className="text-xs mt-1">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded-xl border border-gray-200 shadow-sm bg-gray-100 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Generating preview…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm">{error}</div>
      )}
      {fallbackUrl ? (
        <iframe src={fallbackUrl} title="PDF preview" className="w-full h-full border-0" />
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="flex flex-col items-center gap-4 p-4">
            {pageImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`Page ${i + 1}`}
                className="w-full max-w-2xl shadow-md rounded bg-white"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
