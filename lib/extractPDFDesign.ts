import { ColorTheme } from '@/types/document';

interface RGB { r: number; g: number; b: number; }

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function isNearWhite({ r, g, b }: RGB): boolean {
  return r > 220 && g > 220 && b > 220;
}

function isNearBlack({ r, g, b }: RGB): boolean {
  return r < 40 && g < 40 && b < 40;
}

function isGray({ r, g, b }: RGB): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 30;
}

function quantizeColor(c: RGB, step = 32): RGB {
  return {
    r: Math.round(c.r / step) * step,
    g: Math.round(c.g / step) * step,
    b: Math.round(c.b / step) * step,
  };
}

function samplePixels(canvas: HTMLCanvasElement, sampleRate = 4): RGB[] {
  const ctx = canvas.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    const a = data[i + 3];
    if (a < 200) continue; // skip transparent
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  return pixels;
}

function dominantColors(pixels: RGB[]): RGB[] {
  // Build frequency map of quantized colors
  const freq = new Map<string, { color: RGB; count: number }>();
  for (const p of pixels) {
    const q = quantizeColor(p);
    const key = `${q.r},${q.g},${q.b}`;
    const existing = freq.get(key);
    if (existing) existing.count++;
    else freq.set(key, { color: q, count: 1 });
  }

  // Sort by frequency
  const sorted = [...freq.values()].sort((a, b) => b.count - a.count);

  // Deduplicate by proximity (keep colors that differ by > 60 from all already-kept)
  const kept: RGB[] = [];
  for (const { color } of sorted) {
    if (kept.every((k) => colorDistance(k, color) > 60)) {
      kept.push(color);
    }
    if (kept.length >= 10) break;
  }
  return kept;
}

export interface PDFDesignResult {
  theme: ColorTheme;
  previewUrl: string; // data URL of the rendered first page
}

export async function extractPDFDesign(file: File): Promise<PDFDesignResult> {
  // Dynamically import pdfjs-dist to keep initial bundle lean
  const pdfjsLib = await import('pdfjs-dist');

  // Serve the worker from the public folder — works reliably in Next.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Render at a reasonable scale for color sampling
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, canvas, viewport } as any).promise;

  const previewUrl = canvas.toDataURL('image/jpeg', 0.7);
  const pixels = samplePixels(canvas);
  const colors = dominantColors(pixels);

  // Classify colors
  const background = colors.find(isNearWhite) ?? { r: 255, g: 255, b: 255 };

  // Accent colors: not white, not black, prefer chromatic
  const accents = colors.filter(
    (c) => !isNearWhite(c) && !isNearBlack(c) && colorDistance(c, background) > 60
  );

  // Prefer chromatic (non-gray) accents for primary
  const chromatic = accents.filter((c) => !isGray(c));
  const primary = chromatic[0] ?? accents[0] ?? { r: 26, g: 58, b: 92 };
  const secondary = chromatic[1] ?? accents[1] ?? chromatic[0] ?? accents[0] ?? hexToRgb('#555555');

  // Darken primary slightly if it's very light
  function darkenIfLight(c: RGB): RGB {
    const brightness = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
    if (brightness > 180) {
      return { r: Math.round(c.r * 0.5), g: Math.round(c.g * 0.5), b: Math.round(c.b * 0.5) };
    }
    return c;
  }

  return {
    theme: {
      primary: rgbToHex(darkenIfLight(primary)),
      secondary: rgbToHex(darkenIfLight(secondary)),
      background: rgbToHex(background),
    },
    previewUrl,
  };
}
