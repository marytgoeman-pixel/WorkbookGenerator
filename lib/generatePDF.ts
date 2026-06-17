import { PDFDocument, rgb, degrees, StandardFonts, RGB, PDFString, PDFName, PDFPage, PDFImage } from 'pdf-lib';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding, FormField, DocTable, ContentItem } from '@/types/document';
import { classicTemplate } from './templates/classic';
import { modernTemplate } from './templates/modern';
import { workbookTemplate } from './templates/workbook';
import { jomangumTemplate } from './templates/jomangum';
import { sellitTemplate } from './templates/sellit';
import { tlcTemplate } from './templates/tlc';
import { coverById } from './covers';
import fontkit from '@pdf-lib/fontkit';

type Template = {
  id: string; name: string; description: string;
  marginTop: number; marginBottom: number; marginLeft: number; marginRight: number;
  pageWidth: number; pageHeight: number;
  titleSize: number; headingSize: number; subheadingSize: number; bodySize: number;
  lineHeight: number; sectionSpacing: number; paragraphSpacing: number;
  fieldHeight: number; textareaHeight: number; bulletIndent: number;
  headerBarHeight: number; twoColumn: boolean; notesColumnWidth: number;
  topBarHeight?: number; footerHeight?: number;
};

type PDFFontT = Awaited<ReturnType<PDFDocument['embedFont']>>;

// Replace characters that WinAnsi (Helvetica) cannot encode
function sanitize(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, (ch) => {
      // Common Unicode replacements
      const map: Record<string, string> = {
        '□': '[ ]', '☐': '[ ]',
        '■': '[x]', '☑': '[x]', '✓': '[x]', '✔': '[x]',
        '™': '(TM)', '®': '(R)', '©': '(C)',
        '→': '->', '←': '<-',
        '’': "'", '‘': "'",
        '“': '"', '”': '"',
        '–': '-', '—': '--',
        '…': '...', '•': '-',
      };
      if (map[ch] !== undefined) return map[ch];
      // Pass through Latin-1 printable chars WinAnsi supports; drop the rest
      const code = ch.charCodeAt(0);
      if (code >= 0xA0 && code <= 0xFF) return ch;
      return '';
    });
}

function applyCase(text: string, c: import('@/types/document').TextCase | undefined): string {
  switch (c) {
    case 'upper': return text.toUpperCase();
    case 'sentence': return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'title': return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    default: return text;
  }
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

const NAMED_COLORS: Record<string, string> = {
  red: '#D32F2F', green: '#2E7D32', blue: '#1565C0', orange: '#E04927',
  purple: '#6A1B9A', teal: '#00796B', gray: '#555555', grey: '#555555',
  black: '#111111', gold: '#C9A227', navy: '#16293A',
};

// Resolve a user/AI color (hex or name) to RGB; returns null if blank/invalid → use default
function resolveColor(color: string | undefined): RGB | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();
  if (/^#?[0-9a-f]{6}$/.test(c)) return hexToRgb(c.startsWith('#') ? c : '#' + c);
  if (NAMED_COLORS[c]) return hexToRgb(NAMED_COLORS[c]);
  return null;
}

function getTemplate(id: TemplateId): Template {
  if (id === 'modern') return modernTemplate;
  if (id === 'workbook') return workbookTemplate;
  if (id === 'jomangum') return jomangumTemplate;
  if (id === 'sellit') return sellitTemplate;
  if (id === 'tlc') return tlcTemplate;
  return classicTemplate;
}

// Fetch raw font bytes (for embedding custom OTF/WOFF). Returns null if unavailable.
async function tryFetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Add a clickable URI link annotation over a rectangle
function addLink(pdfDoc: PDFDocument, page: PDFPage, x: number, y: number, w: number, h: number, url: string) {
  const annot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  const ref = pdfDoc.context.register(annot);
  const existing = page.node.Annots();
  if (existing) {
    existing.push(ref);
  } else {
    page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
  }
}

// Try to fetch + embed a PNG/JPG logo; returns null if unavailable (e.g. not uploaded yet)
async function tryEmbedImage(pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // Detect format by magic bytes so data: URLs (user-uploaded covers) embed correctly:
    // JPEG starts FF D8; otherwise treat as PNG.
    const isJpg = (buf[0] === 0xFF && buf[1] === 0xD8) || /\.jpe?g$/i.test(url);
    return isJpg ? await pdfDoc.embedJpg(buf) : await pdfDoc.embedPng(buf);
  } catch {
    return null;
  }
}

function wrapText(text: string, maxWidth: number, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number): string[] {
  // Respect hard line breaks (\n) FIRST — split on newlines before sanitizing,
  // since sanitize() drops control chars. Then word-wrap each segment to maxWidth.
  // This lets a title/heading/text item like "Line one\nLine two" render on two lines.
  const segments = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];
  for (const seg of segments) {
    const words = sanitize(seg).split(' ');
    const segLines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        if (current) segLines.push(current);
        current = word;
      }
    }
    segLines.push(current); // push even when empty so a blank line from "\n\n" is preserved
    // Runt control: avoid a lonely single-word last line by pulling the previous
    // word down onto it (only if it still fits). Applied per segment so explicit
    // line breaks keep their own balance.
    if (segLines.length >= 2) {
      const last = segLines[segLines.length - 1];
      if (last && !last.includes(' ')) {
        const prevWords = segLines[segLines.length - 2].split(' ');
        if (prevWords.length >= 2) {
          const moved = prevWords[prevWords.length - 1];
          if (font.widthOfTextAtSize(`${moved} ${last}`, size) <= maxWidth) {
            prevWords.pop();
            segLines[segLines.length - 2] = prevWords.join(' ');
            segLines[segLines.length - 1] = `${moved} ${last}`;
          }
        }
      }
    }
    for (const l of segLines) lines.push(l);
  }
  return lines.length ? lines : [''];
}

export async function generatePDF(
  doc: DocumentModel,
  templateId: TemplateId,
  theme: ColorTheme,
  branding?: ClientBranding,
  anchors?: import('@/types/document').SectionAnchor[],  // optional: collects per-section positions for click-to-edit
  opts?: { watermark?: string }                          // optional: stamp a diagonal demo watermark on every page
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const form = pdfDoc.getForm();
  let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const jo = templateId === 'jomangum' && !!branding;
  const sellit = templateId === 'sellit' && !!branding;
  const tlc = templateId === 'tlc' && !!branding;
  // 'tlc' reuses the navy-bar + footer chrome (drawBrandedChrome) and the standard cover.
  const branded = jo || sellit || tlc;

  // Sell It uses its own typefaces: Aeonik (bold) for headings, Inter for body.
  if (sellit) {
    pdfDoc.registerFontkit(fontkit);
    const base = branding!.logoUrl.replace(/[^/]*$/, '');
    const [aeonik, inter] = await Promise.all([
      tryFetchBytes(`${base}AeonikPro-Bold.otf`),
      tryFetchBytes(`${base}Inter-Regular.woff`),
    ]);
    try {
      if (aeonik) boldFont = await pdfDoc.embedFont(aeonik, { subset: true });
      if (inter) { font = await pdfDoc.embedFont(inter, { subset: true }); italicFont = font; }
    } catch { /* fall back to Helvetica on any embed error */ }
  }

  // Copy the template so we can apply document-level spacing without mutating the shared constant
  const tmpl = { ...getTemplate(templateId) };
  const spacingScale = doc.bodySpacing === 'compact' ? 0.5 : doc.bodySpacing === 'relaxed' ? 2 : 1;
  tmpl.paragraphSpacing = Math.round(tmpl.paragraphSpacing * spacingScale);
  // When branded, colors come from the client brand rather than the theme picker
  const primaryColor = hexToRgb(branded ? branding!.colors.title : theme.primary);
  const secondaryColor = hexToRgb(branded ? branding!.colors.subtitle : theme.secondary);
  const accentColor = hexToRgb(branded ? branding!.colors.accent : theme.secondary);
  const bgColor = hexToRgb(theme.background);
  // Fillable-field background: branded clients tint it (Sell It = periwinkle, Jo = light gray)
  const fieldBg = branded ? hexToRgb(branding!.colors.grayBox) : rgb(0.98, 0.98, 0.98);

  // Pre-embed brand logo (may be null until the client uploads it)
  const brandLogo = branded ? await tryEmbedImage(pdfDoc, branding!.logoUrl) : null;
  // White logo variant for the dark cover band (falls back to the normal logo)
  const whiteName = sellit ? 'sellitlogowhite.png' : 'logowhite.png';
  const whiteLogo = branded
    ? (await tryEmbedImage(pdfDoc, branding!.logoUrl.replace(/[^/]*$/, whiteName))) ?? brandLogo
    : null;
  // Sell It's icon mark (the converging-arrows symbol) in brand blue, drawn beside page titles
  const sellitMark = sellit ? await tryEmbedImage(pdfDoc, branding!.logoUrl.replace(/[^/]*$/, 'sellitmark-blue.png')) : null;
  // The Learning Creative leaf mark — accents callout panels (website-style, not a dark box)
  const leafMark = tlc ? await tryEmbedImage(pdfDoc, '/leaf.png') : null;

  // Pre-embed social icon PNGs from the same folder as the logo (e.g. /clients/jo/linkedin.png)
  const socialIcons: Record<string, PDFImage | null> = {};
  if (branded) {
    const baseDir = branding!.logoUrl.replace(/[^/]*$/, ''); // strip filename
    for (const s of branding!.social) {
      socialIcons[s.type] = await tryEmbedImage(pdfDoc, `${baseDir}${s.type}.png`);
    }
  }

  const contentWidth = tmpl.pageWidth - tmpl.marginLeft - tmpl.marginRight;
  const mainColWidth = tmpl.twoColumn
    ? contentWidth * (1 - tmpl.notesColumnWidth) - 10
    : contentWidth;

  let page = pdfDoc.addPage([tmpl.pageWidth, tmpl.pageHeight]);
  let y = tmpl.pageHeight - tmpl.marginTop;
  let fieldIndex = 0;

  // Fill page background
  function fillBackground() {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: tmpl.pageWidth,
      height: tmpl.pageHeight,
      color: bgColor,
    });
  }

  function newPage() {
    page = pdfDoc.addPage([tmpl.pageWidth, tmpl.pageHeight]);
    fillBackground();
    // Notes column divider line for workbook template
    if (tmpl.twoColumn) {
      const dividerX = tmpl.marginLeft + mainColWidth + 8;
      page.drawLine({
        start: { x: dividerX, y: tmpl.pageHeight - tmpl.marginTop },
        end: { x: dividerX, y: tmpl.marginBottom },
        thickness: 0.5,
        color: primaryColor,
        opacity: 0.3,
      });
      page.drawText('Notes', {
        x: dividerX + 6,
        y: tmpl.pageHeight - tmpl.marginTop,
        size: 9,
        font: boldFont,
        color: primaryColor,
        opacity: 0.5,
      });
    }
    y = tmpl.pageHeight - tmpl.marginTop;
  }

  function ensureSpace(needed: number) {
    if (y - needed < tmpl.marginBottom) newPage();
  }

  // Place wrapped lines with widow/orphan control: never strand fewer than 2 lines
  // of a paragraph alone at the top or bottom of a page. `draw` renders one line at
  // the current y; we advance y after each.
  function placeLines(lines: string[], lh: number, draw: (line: string) => void) {
    let idx = 0;
    while (idx < lines.length) {
      let fit = Math.floor((y - tmpl.marginBottom) / lh);
      if (fit <= 0) { newPage(); fit = Math.floor((y - tmpl.marginBottom) / lh); }
      const remaining = lines.length - idx;
      if (remaining <= fit) {
        for (; idx < lines.length; idx++) { draw(lines[idx]); y -= lh; }
      } else {
        let take = fit;
        if (remaining - take < 2) take = remaining - 2; // widow: keep >=2 lines for next page
        if (take < 2) { newPage(); continue; }          // orphan: keep >=2 lines together here
        for (let k = 0; k < take; k++, idx++) { draw(lines[idx]); y -= lh; }
        newPage();
      }
    }
  }

  fillBackground();

  // Optional branded cover page (page 1). Real content then starts on a fresh page.
  let hasCover = false;
  if (branded && doc.cover?.enabled) {
    if (sellit) {
      await drawSellItCover(pdfDoc, page, tmpl, doc, branding!, boldFont, font, brandLogo, whiteLogo);
    } else {
      await drawCoverPage(pdfDoc, page, tmpl, doc, branding!, boldFont, font, italicFont, whiteLogo);
    }
    hasCover = true;
    newPage();
  }

  // Notes column for first page
  if (tmpl.twoColumn) {
    const dividerX = tmpl.marginLeft + mainColWidth + 8;
    page.drawLine({
      start: { x: dividerX, y: tmpl.pageHeight - tmpl.marginTop },
      end: { x: dividerX, y: tmpl.marginBottom },
      thickness: 0.5,
      color: primaryColor,
      opacity: 0.3,
    });
    page.drawText('Notes', {
      x: dividerX + 6,
      y: tmpl.pageHeight - tmpl.marginTop,
      size: 9,
      font: boldFont,
      color: primaryColor,
      opacity: 0.5,
    });
  }

  // Title block — case controlled by doc.titleCase (defaults to UPPER in branded mode).
  // Long titles wrap across lines (and shrink a step if very long) so they never overflow.
  const titleCase = doc.titleCase ?? (branded ? 'upper' : 'none');
  // NOTE: don't sanitize here — wrapText() needs the raw text (with any \n) and
  // sanitizes each line itself. Pre-sanitizing would strip hard line breaks.
  const rawTitle = applyCase(doc.title || 'Untitled', titleCase);
  let titleSize = tmpl.titleSize;
  let titleLines = wrapText(rawTitle, contentWidth, boldFont, titleSize);
  if (titleLines.length > 2) {
    titleSize = Math.max(16, tmpl.titleSize - 4);
    titleLines = wrapText(rawTitle, contentWidth, boldFont, titleSize);
  }
  // The main title uses the brand blue (header color) when branded
  const titleColor = branded ? hexToRgb(branding!.colors.header) : primaryColor;
  const titleLineH = titleSize + 4;
  ensureSpace(titleLines.length * titleLineH + 12);
  for (const tline of titleLines) {
    page.drawText(tline, { x: tmpl.marginLeft, y, size: titleSize, font: boldFont, color: titleColor });
    y -= titleLineH;
  }

  if (doc.author) {
    page.drawText(sanitize(`by ${doc.author}`), {
      x: tmpl.marginLeft,
      y,
      size: tmpl.bodySize,
      font,
      color: secondaryColor,
    });
    y -= tmpl.bodySize + 4;
  }

  // Title underline (skipped in branded mode per Jo's design)
  if (!branded) {
    page.drawLine({
      start: { x: tmpl.marginLeft, y: y - 4 },
      end: { x: tmpl.marginLeft + contentWidth, y: y - 4 },
      thickness: 1.5,
      color: primaryColor,
    });
    y -= 18;
  } else {
    y -= 10;
  }

  for (const section of doc.sections) {
    // Force a new page when requested (skip if we're already at the top)
    if (section.pageBreakBefore && y < tmpl.pageHeight - tmpl.marginTop - 1) {
      newPage();
    }
    // Per-section multipliers (driven by editor sliders): sp = gaps between blocks,
    // ls = line height within text/callouts. Computed up-front so the heading's
    // orphan control can estimate the first content block's height.
    const sp = section.spacing ?? 1;
    const ls = section.lineSpacing ?? 1;
    const lineH = tmpl.lineHeight * ls;

    // Estimate the first content block's height so a heading is never stranded at the
    // bottom of a page without at least the start of its content (orphan control).
    const leadEstimate = (): number => {
      const first = section.content[0];
      if (!first) return 0;
      if (first.kind === 'text' || first.kind === 'bullet')
        return Math.min(2, wrapText(first.text, mainColWidth, font, tmpl.bodySize).length) * lineH;
      if (first.kind === 'field')
        return (first.field.type === 'checkbox' ? 22 : first.field.type === 'textarea' ? tmpl.textareaHeight : tmpl.fieldHeight) + 16;
      if (first.kind === 'table') return 48;
      return lineH;
    };

    // Rough height a content item will consume — used to reserve space below a full-page
    // element so anything added after it stays on the same page.
    const estimateItemHeight = (it: ContentItem): number => {
      if (it.kind === 'text' || it.kind === 'bullet')
        return wrapText(it.text, mainColWidth, font, tmpl.bodySize).length * lineH + tmpl.paragraphSpacing * sp;
      if (it.kind === 'field')
        return (it.field.type === 'checkbox' ? 22 : it.field.type === 'textarea' ? tmpl.textareaHeight : tmpl.fieldHeight) + 16;
      if (it.kind === 'lines') return 120;
      if (it.kind === 'table') return 60;
      return lineH;
    };

    // A small, consistent gap before a heading (level-2 sits closer to its parent)
    if (branded && y < tmpl.pageHeight - tmpl.marginTop - 2) {
      y -= section.level === 1 ? 6 : 2;
    }

    // Record where this section's heading lands (for click-to-edit in the preview)
    const recordAnchor = () => {
      anchors?.push({ sectionId: section.id, page: pdfDoc.getPageCount() - 1, topFrac: Math.min(1, Math.max(0, (tmpl.pageHeight - y) / tmpl.pageHeight)) });
    };

    // Section heading
    if (branded) {
      // Headers/subheaders are NOT bulleted by default. 'accent' (opt-in) adds a square bullet;
      // default H1 = brand title color, H2 = brand subtitle color, both bold and unbulleted.
      const style = section.headingStyle ?? (section.level === 1 ? 'title' : 'brand');
      const size = section.level === 1 ? tmpl.headingSize : tmpl.subheadingSize;
      // raw (not pre-sanitized) so wrapText() can honor hard line breaks in the heading
      const headingText = applyCase(section.title, section.headingCase);
      const headingColor =
        tlc ? hexToRgb(branding!.colors.subtitle)          // TLC: dark-green headers
        : style === 'brand' ? hexToRgb(branding!.colors.subtitle)
        : style === 'plain' ? rgb(0.15, 0.15, 0.15)
        : primaryColor; // 'title' and 'accent' both use the primary brand color
      const sq = Math.round(size * 0.55);
      // Sell It draws its icon mark beside every page (H1) title instead of a bullet.
      const useMark = sellit && section.level === 1 && !!sellitMark;
      const markH = size + 12;
      const markW = useMark ? markH * (sellitMark!.width / sellitMark!.height) : 0;
      // TLC headers carry no bullet (dark-green text only); otherwise only the opt-in 'accent' style is bulleted.
      const drawBullet = !useMark && !tlc && style === 'accent';
      // With the mark, the heading text aligns LEFT with the body text and the mark hangs in the margin.
      const textX = drawBullet ? tmpl.marginLeft + sq + 7 : tmpl.marginLeft;
      const markX = Math.max(6, tmpl.marginLeft - markW - 8);
      // Wrap long headings to the content margin instead of overflowing
      const hLines = wrapText(headingText, mainColWidth - (textX - tmpl.marginLeft), boldFont, size);
      // Orphan control: keep the whole heading together with the start of its content
      ensureSpace(hLines.length * (size + 2) + (section.level === 1 ? 8 : 5) + leadEstimate());
      recordAnchor();
      if (useMark) {
        // Mark hangs in the left margin, vertically centered on the heading text
        page.drawImage(sellitMark!, { x: markX, y: y + size * 0.36 - markH / 2, width: markW, height: markH });
      } else if (drawBullet) {
        page.drawRectangle({ x: tmpl.marginLeft, y: y + 1, width: sq, height: sq, color: accentColor });
      }
      for (const hl of hLines) {
        page.drawText(hl, { x: textX, y, size, font: boldFont, color: headingColor });
        y -= size + 2;
      }
      y -= (section.level === 1 ? 8 : 5);
    } else if (section.level === 1) {
      {
        ensureSpace(tmpl.headingSize + tmpl.sectionSpacing);
        if (tmpl.headerBarHeight > 0) {
          // Modern template: colored bar behind heading
          ensureSpace(tmpl.headingSize + tmpl.headerBarHeight + 8);
          page.drawRectangle({
            x: tmpl.marginLeft,
            y: y - tmpl.headingSize - 4,
            width: mainColWidth,
            height: tmpl.headingSize + tmpl.headerBarHeight + 4,
            color: primaryColor,
            opacity: 0.1,
          });
          page.drawRectangle({
            x: tmpl.marginLeft,
            y: y - tmpl.headingSize - 4,
            width: 4,
            height: tmpl.headingSize + tmpl.headerBarHeight + 4,
            color: primaryColor,
          });
        }
        page.drawText(sanitize(section.title), {
          x: tmpl.marginLeft + (tmpl.headerBarHeight > 0 ? 10 : 0),
          y,
          size: tmpl.headingSize,
          font: boldFont,
          color: primaryColor,
        });
        y -= tmpl.headingSize + 6;
        if (tmpl.headerBarHeight === 0) {
          page.drawLine({
            start: { x: tmpl.marginLeft, y },
            end: { x: tmpl.marginLeft + mainColWidth, y },
            thickness: 0.75,
            color: primaryColor,
            opacity: 0.4,
          });
          y -= 6;
        } else {
          y -= 4;
        }
      }
    } else {
      ensureSpace(tmpl.subheadingSize + tmpl.sectionSpacing);
      page.drawText(applyCase(sanitize(section.title), section.headingCase), {
        x: tmpl.marginLeft,
        y,
        size: tmpl.subheadingSize,
        font: boldFont,
        color: secondaryColor,
      });
      y -= tmpl.subheadingSize + 6;
    }

    // (sp / ls / lineH were computed above the heading for orphan control)

    // ---- ordered content rendering (preserves document order) ----
    const renderText = (txt: string, color?: string) => {
      // "Pressure"/"Presence" lines render in the default color (coloring removed per request)
      const col = /pressure|presence/i.test(txt) ? rgb(0.1, 0.1, 0.1) : (resolveColor(color) ?? rgb(0.1, 0.1, 0.1));
      // widow/orphan control keeps >=2 lines of a paragraph together across pages
      placeLines(wrapText(txt, mainColWidth, font, tmpl.bodySize), lineH,
        (wline) => page.drawText(wline, { x: tmpl.marginLeft, y, size: tmpl.bodySize, font, color: col }));
      y -= tmpl.paragraphSpacing * sp;
    };

    const renderBullet = (txt: string, color?: string) => {
      // "Pressure"/"Presence" lines render in the default color (coloring removed per request)
      const col = /pressure|presence/i.test(txt) ? rgb(0.1, 0.1, 0.1) : (resolveColor(color) ?? rgb(0.1, 0.1, 0.1));
      const wrapped = wrapText(txt, mainColWidth - tmpl.bulletIndent - 6, font, tmpl.bodySize);
      ensureSpace(tmpl.lineHeight);
      if (branded) {
        page.drawRectangle({ x: tmpl.marginLeft + tmpl.bulletIndent, y: y + 1, width: 6, height: 6, color: accentColor });
      } else {
        page.drawText('•', { x: tmpl.marginLeft + tmpl.bulletIndent, y, size: tmpl.bodySize, font: boldFont, color: secondaryColor });
      }
      page.drawText(wrapped[0], { x: tmpl.marginLeft + tmpl.bulletIndent + 10, y, size: tmpl.bodySize, font, color: col });
      y -= tmpl.lineHeight;
      for (let i = 1; i < wrapped.length; i++) {
        ensureSpace(tmpl.lineHeight);
        page.drawText(wrapped[i], { x: tmpl.marginLeft + tmpl.bulletIndent + 10, y, size: tmpl.bodySize, font, color: col });
        y -= tmpl.lineHeight;
      }
    };

    const renderField = (field: FormField) => {
      const fieldName = `${section.id}__${field.id}`;
      const IFS = 12;          // interactive font size for fillable text (12pt minimum)
      const labLH = IFS + 4;   // label line height (so long prompts wrap, not overflow)
      const labelColor = rgb(0.2, 0.2, 0.2);
      // Per-box "size" control scales the height of this text/textarea answer box
      const fieldScale = field.heightScale ?? 1;

      if (field.type === 'checkbox') {
        // Wrap the label to the right of the checkbox; box sits on the first line.
        const lines = wrapText(field.label, mainColWidth - 22, font, IFS);
        ensureSpace(Math.max(20, lines.length * labLH));
        const cb = form.createCheckBox(fieldName);
        cb.addToPage(page, { x: tmpl.marginLeft, y: y - 3, width: 15, height: 15, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
        for (const ln of lines) { page.drawText(ln, { x: tmpl.marginLeft + 22, y, size: IFS, font, color: labelColor }); y -= labLH; }
        y -= Math.max(0, 24 - labLH);
      } else {
        const hasLabel = !!field.label.trim();
        const fh = field.type === 'dropdown'
          ? tmpl.fieldHeight
          : (field.type === 'textarea' ? tmpl.textareaHeight : tmpl.fieldHeight) * fieldScale;
        if (hasLabel) y -= 10 * sp; // separate the prompt from the item above
        const lines = hasLabel ? wrapText(field.label, mainColWidth, font, IFS) : [];
        ensureSpace(lines.length * labLH + fh + 10);
        for (const ln of lines) { page.drawText(ln, { x: tmpl.marginLeft, y, size: IFS, font, color: labelColor }); y -= labLH; }
        if (field.type === 'dropdown') {
          const dd = form.createDropdown(fieldName);
          dd.addOptions(field.options ?? []);
          dd.addToPage(page, { x: tmpl.marginLeft, y: y - fh, width: Math.min(160, mainColWidth), height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
          dd.setFontSize(IFS);
        } else {
          const tf = form.createTextField(fieldName);
          if (field.type === 'textarea') tf.enableMultiline();
          tf.addToPage(page, { x: tmpl.marginLeft, y: y - fh, width: mainColWidth, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
          tf.setFontSize(IFS);
        }
        y -= fh + 18 * sp;
      }
    };

    const renderTable = (table: DocTable, reserveBelow = 0) => {
      const cols = table.headers.length || (table.rows[0]?.length ?? 0);
      if (cols === 0) return;
      const colW = mainColWidth / cols;
      const TFS = 12;          // table font size — kept at the 12pt minimum
      const cellLineH = 15;    // line height for wrapped cell text
      const vpad = 8;          // vertical padding inside a cell
      // Calendar mode: a cell carrying BOTH a date label and a fillable field — give rows
      // enough height to actually type a note inside each day.
      const isCalendar = table.rows.some((r) => r.some((c) => !!(c && c.text && c.field)));
      const minRowH = isCalendar ? 54 : 30;
      // Calendar day boxes are small — use a smaller field font so more text fits per box.
      const cellFieldSize = isCalendar ? 8 : TFS;
      const headerColor = branded ? hexToRgb(branding.colors.subtitle) : primaryColor;
      const solidHeader = sellit; // Sell It: solid blue header + white text; others: light tint
      const labelSize = table.labelSize ?? 9;          // in-cell label size (date number / quadrant title)
      const hasHeaders = table.headers.some((h) => h && h.trim());

      const wrapCell = (text: string, f: typeof font) => wrapText(text, colW - 8, f, TFS);

      // Header height grows to fit wrapped header labels (omitted entirely when there are none)
      const headerWrapped = table.headers.map((h) => wrapCell(h, boldFont));
      const headerLines = Math.max(1, ...headerWrapped.map((l) => l.length));
      const headerH = hasHeaders ? Math.max(28, headerLines * cellLineH + vpad) : 0;

      const drawHeader = () => {
        page.drawRectangle({ x: tmpl.marginLeft, y: y - headerH + 4, width: mainColWidth, height: headerH, color: headerColor, opacity: solidHeader ? 1 : 0.12 });
        const htColor = solidHeader ? rgb(1, 1, 1) : headerColor;
        headerWrapped.forEach((lines, c) => {
          // Center each header title horizontally in its column and vertically in the row
          const blockH = lines.length * cellLineH;
          let cy = y + 4 - (headerH - blockH) / 2 - TFS + 1;
          for (const ln of lines) {
            const w = boldFont.widthOfTextAtSize(ln, TFS);
            page.drawText(ln, { x: tmpl.marginLeft + c * colW + (colW - w) / 2, y: cy, size: TFS, font: boldFont, color: htColor });
            cy -= cellLineH;
          }
        });
        y -= headerH;
      };

      // Pre-wrap static text cells and compute each row's height
      const rowWrapped = table.rows.map((row) => row.map((cell) => (cell && cell.text && !cell.field) ? wrapCell(cell.text, font) : ['']));
      let rowHeights = rowWrapped.map((cells) => Math.max(minRowH, Math.max(1, ...cells.map((l) => l.length)) * cellLineH + vpad));

      // Full-page tables (calendars, SWOT, grids) expand their rows to fill the page.
      if (table.fullPage) {
        // Fill the page from the current y down to the bottom margin, split evenly across
        // rows — so the whole grid always stays on ONE page (rows shrink to fit if needed).
        // reserveBelow leaves room for any items added AFTER the table in this section.
        const avail = y - tmpl.marginBottom - headerH - 4 - reserveBelow;
        const per = Math.max(28, Math.floor(avail / Math.max(1, table.rows.length)));
        rowHeights = table.rows.map(() => per);
      }

      // Keep the table together if it fits on a fresh page
      const total = headerH + rowHeights.reduce((a, b) => a + b, 0);
      const usable = tmpl.pageHeight - tmpl.marginTop - tmpl.marginBottom;
      if (!table.fullPage && y - total < tmpl.marginBottom && total <= usable) newPage();

      if (hasHeaders) drawHeader();
      table.rows.forEach((row, ri) => {
        const rh = rowHeights[ri];
        if (y - rh < tmpl.marginBottom) { newPage(); if (hasHeaders) drawHeader(); }
        const rowTop = y;
        for (let c = 0; c < cols; c++) {
          const cell = row[c];
          const cx = tmpl.marginLeft + c * colW;
          page.drawRectangle({ x: cx, y: rowTop - rh + 4, width: colW, height: rh, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5, color: rgb(1, 1, 1) });
          if (!cell) continue;
          if (cell.field) {
            const name = `${section.id}__${cell.field.id}`;
            const hasDate = !!(cell.text && cell.text.trim());
            const fw = colW - 10, fx = cx + 5;
            let fh: number, fy: number;
            if (hasDate) {
              // Labelled cell (calendar day / SWOT quadrant): label top-left, fill area below
              page.drawText(cell.text!, { x: cx + 5, y: rowTop - labelSize - 3, size: labelSize, font: boldFont, color: branded ? hexToRgb(branding.colors.subtitle) : primaryColor });
              fh = Math.max(14, rh - labelSize - 14);
              fy = rowTop - rh + 7;
            } else if (table.fullPage) {
              // Grid cell with no label — fill the whole cell
              fh = Math.max(14, rh - 12);
              fy = rowTop - rh + 4 + 4;
            } else {
              fh = Math.min(rh - 8, 20);
              fy = rowTop - rh + 4 + (rh - fh) / 2;
            }
            if (cell.field.type === 'dropdown' && cell.field.options) {
              const dd = form.createDropdown(name); dd.addOptions(cell.field.options);
              dd.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
              dd.setFontSize(cellFieldSize);
            } else {
              const tf = form.createTextField(name);
              if (cell.field.type === 'textarea') tf.enableMultiline();
              tf.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
              tf.setFontSize(cellFieldSize);
            }
          } else if (cell.text) {
            let cy = rowTop - vpad - TFS + 5;
            for (const ln of rowWrapped[ri][c]) { page.drawText(ln, { x: cx + 4, y: cy, size: TFS, font, color: rgb(0.15, 0.15, 0.15) }); cy -= cellLineH; }
          }
        }
        y -= rh;
      });
      y -= tmpl.paragraphSpacing;
    };

    // A single full-page notes box: one multiline field that wraps as you type.
    // (No background rules — typed text can't be aligned to drawn lines reliably.)
    const renderLines = () => {
      const top = y - 2;
      const bottom = tmpl.marginBottom + 4;
      const areaH = top - bottom;
      if (areaH < 24) return;
      const tf = form.createTextField(`${section.id}__notes`);
      tf.enableMultiline();
      tf.addToPage(page, {
        x: tmpl.marginLeft, y: bottom, width: mainColWidth, height: areaH,
        borderWidth: 1,
        borderColor: branded ? accentColor : rgb(0.7, 0.73, 0.78),
        backgroundColor: fieldBg,
      });
      tf.setFontSize(12);
      y = bottom - tmpl.paragraphSpacing;
    };

    const renderCalloutBox = (lines: string[]) => {
      // The Learning Creative: a light, leaf-accented panel (matches the website) —
      // pale-green background, a solid green left accent bar, the leaf mark top-left,
      // and navy body text. No dark fill, no dashed border.
      if (tlc) {
        const pad = 14;
        const accentW = 4;                                   // green left accent bar
        const cLineH = tmpl.lineHeight * ls;
        const paraGap = cLineH * 0.5;
        const panelBg = hexToRgb(branding!.colors.grayBox);  // pale lime tint
        const barColor = hexToRgb(branding!.colors.subtitle);// dark green
        const textColor = hexToRgb(branding!.colors.header); // navy
        const textX = tmpl.marginLeft + accentW + pad;
        const innerW = mainColWidth - accentW - pad * 2;
        const paras = lines.map((l) => wrapText(l, innerW, font, tmpl.bodySize)).filter((p) => p.join('').trim());
        const leafW = leafMark ? 30 : 0;
        const leafH = leafMark ? leafW * (leafMark.height / leafMark.width) : 0;
        const leafGap = leafMark ? 9 : 0;
        const textH = paras.reduce((h, p) => h + p.length * cLineH, 0) + Math.max(0, paras.length - 1) * paraGap;
        const boxH = pad + leafH + leafGap + textH + pad;
        ensureSpace(boxH + 8);
        const boxTop = y + tmpl.bodySize;
        page.drawRectangle({ x: tmpl.marginLeft, y: boxTop - boxH, width: mainColWidth, height: boxH, color: panelBg });
        page.drawRectangle({ x: tmpl.marginLeft, y: boxTop - boxH, width: accentW, height: boxH, color: barColor });
        if (leafMark) {
          page.drawImage(leafMark, { x: textX, y: boxTop - pad - leafH, width: leafW, height: leafH });
        }
        let cy = boxTop - pad - leafH - leafGap - tmpl.bodySize + 2;
        paras.forEach((p, i) => {
          for (const wline of p) { page.drawText(wline, { x: textX, y: cy, size: tmpl.bodySize, font, color: textColor }); cy -= cLineH; }
          if (i < paras.length - 1) cy -= paraGap;
        });
        y = boxTop - boxH - tmpl.paragraphSpacing;
        return;
      }
      const calloutBg = hexToRgb(branding!.colors.calloutBg);
      const pad = 12;
      const innerW = mainColWidth - pad * 2;
      const cLineH = tmpl.lineHeight * ls;          // line spacing controls how tight lines are
      const paraGap = cLineH * 0.5;                 // modest gap between paragraphs (was a full blank line)
      const paras = lines.map((l) => wrapText(l, innerW, font, tmpl.bodySize)).filter((p) => p.join('').trim());
      const boxH = paras.reduce((h, p) => h + p.length * cLineH, 0) + Math.max(0, paras.length - 1) * paraGap + pad * 2;
      ensureSpace(boxH + 8);
      const boxTop = y + tmpl.bodySize;
      page.drawRectangle({ x: tmpl.marginLeft, y: boxTop - boxH, width: mainColWidth, height: boxH, color: calloutBg });
      page.drawRectangle({ x: tmpl.marginLeft + 5, y: boxTop - boxH + 5, width: mainColWidth - 10, height: boxH - 10, borderColor: hexToRgb(branding!.colors.calloutBorder), borderWidth: 1, borderDashArray: [3, 3], color: calloutBg });
      let cy = boxTop - pad - tmpl.bodySize + 2;
      paras.forEach((p, i) => {
        for (const wline of p) { page.drawText(wline, { x: tmpl.marginLeft + pad, y: cy, size: tmpl.bodySize, font, color: rgb(1, 1, 1) }); cy -= cLineH; }
        if (i < paras.length - 1) cy -= paraGap;
      });
      y = boxTop - boxH - tmpl.paragraphSpacing;
    };

    if (branded && section.callout) {
      const texts = section.content.filter((i) => i.kind === 'text').map((i) => i.text);
      if (texts.length) renderCalloutBox(texts);
      for (const item of section.content) {
        if (item.kind === 'bullet') renderBullet(item.text, item.color);
        else if (item.kind === 'field') renderField(item.field);
        else if (item.kind === 'table') renderTable(item.table);
      }
    } else {
      // Track the previous block kind so a following text line gets clear separation
      // from a "box" (textarea/dropdown/table) above it — and from a bullet list above it.
      let lastWasBox = false;
      let lastWasBullet = false;
      section.content.forEach((item, idx) => {
        if (item.kind === 'text') {
          if (lastWasBox) y -= 12 * sp;
          else if (lastWasBullet) y -= 8 * sp; // breathing room between a bullet list and the text that follows it
          renderText(item.text, item.color);
          lastWasBox = false;
          lastWasBullet = false;
        } else if (item.kind === 'bullet') {
          renderBullet(item.text, item.color);
          lastWasBox = false;
          lastWasBullet = true;
        } else if (item.kind === 'field') {
          renderField(item.field);
          lastWasBox = item.field.type === 'textarea' || item.field.type === 'dropdown' || item.field.type === 'text';
          lastWasBullet = false;
        } else if (item.kind === 'table') {
          // A full-page table reserves room for items AFTER it too, so the whole element
          // (table + anything added below it) stays on a single page.
          const reserveBelow = item.table.fullPage
            ? section.content.slice(idx + 1).reduce((h, it) => h + estimateItemHeight(it) + 12 * sp, 0)
            : 0;
          renderTable(item.table, reserveBelow);
          lastWasBox = true;
          lastWasBullet = false;
        } else if (item.kind === 'lines') {
          renderLines();
          lastWasBox = true;
          lastWasBullet = false;
        }
      });
    }

    y -= tmpl.sectionSpacing * sp;
  }

  // --- Optional appended pages (Jo only): About Jo, then a plain Legal page ---
  let legalPageIndex = -1;
  if (jo && doc.aboutPage) {
    newPage();
    const photo = await tryEmbedImage(pdfDoc, branding!.logoUrl.replace(/[^/]*$/, 'jopicture.png'));
    drawAboutJoPage(page, tmpl, branding!, photo, brandLogo, font, boldFont, italicFont);
  }
  if (jo && doc.legalPage) {
    newPage();
    legalPageIndex = pdfDoc.getPageCount() - 1;
    drawLegalPage(page, tmpl, font, boldFont);
  }

  // --- Page chrome (header bar + footer) on every page ---
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    if (hasCover && i === 0) continue;     // the cover has its own full-bleed design
    if (i === legalPageIndex) continue;    // the legal page is a plain disclaimer (no chrome)
    const p = pdfDoc.getPage(i);

    if (sellit) {
      drawSellItChrome(p, tmpl, branding!, brandLogo, font, boldFont, i + 1, doc.cover?.header?.trim() || branding!.tagline);
    } else if (branded) {
      drawBrandedChrome(pdfDoc, p, tmpl, branding!, brandLogo, socialIcons, font, italicFont, boldFont, i + 1);
    } else {
      // Generic footer: title left, page number right
      p.drawText(`${i + 1} / ${pageCount}`, {
        x: tmpl.pageWidth - tmpl.marginRight,
        y: tmpl.marginBottom / 2,
        size: 9,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
      p.drawText(sanitize(doc.title), {
        x: tmpl.marginLeft,
        y: tmpl.marginBottom / 2,
        size: 9,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  // Demo watermark: a single light diagonal stamp centered on every page (drawn last, so
  // it sits behind the fillable field widgets). Used by the public "Try Me" sandbox.
  if (opts?.watermark) {
    const wm = sanitize(opts.watermark);
    const unit = boldFont.widthOfTextAtSize(wm, 1) || 1;
    for (const p of pdfDoc.getPages()) {
      const W = p.getWidth(), H = p.getHeight();
      const size = Math.max(14, Math.min(40, (Math.hypot(W, H) * 0.6) / unit));
      const textW = boldFont.widthOfTextAtSize(wm, size);
      const half = (textW / 2) * Math.SQRT1_2; // half the text vector along a 45° diagonal
      p.drawText(wm, {
        x: W / 2 - half,
        y: H / 2 - half,
        size,
        font: boldFont,
        color: rgb(0.55, 0.58, 0.6),
        opacity: 0.16,
        rotate: degrees(45),
      });
    }
  }

  return pdfDoc.save();
}

// Sell It interior chrome: editable eyebrow (left) + logo (right) header, page-number footer.
function drawSellItChrome(
  page: PDFPage,
  tmpl: Template,
  branding: ClientBranding,
  logo: PDFImage | null,
  font: PDFFontT,
  boldFont: PDFFontT,
  pageNum: number,
  eyebrowText: string
) {
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const gray = rgb(0.5, 0.54, 0.58);
  const topY = H - 48;

  // Eyebrow tagline (left), lightly letter-spaced
  const eyebrow = sanitize(branding.tagline.toUpperCase()).split('').join(' '.replace(/.*/, ' '));
  page.drawText(sanitize(eyebrowText.toUpperCase()), { x: tmpl.marginLeft, y: topY, size: 8.5, font: boldFont, color: gray });

  // Logo (right) — larger, vertically centered on the header row
  if (logo) {
    const h = 22;
    const w = h * (logo.width / logo.height);
    page.drawImage(logo, { x: W - tmpl.marginRight - w, y: topY + 3 - h / 2, width: w, height: h });
  }
  void eyebrow;

  // Footer page number (right)
  const pn = `${pageNum}`;
  page.drawText(pn, { x: W - tmpl.marginRight - font.widthOfTextAtSize(pn, 9), y: tmpl.marginBottom / 2, size: 9, font, color: gray });
}

// Sell It cover: eyebrow + rule, big blue title with the icon mark, WORKBOOK, subtitle,
// and (optionally) the chosen image contained in the lower area. White background.
async function drawSellItCover(
  pdfDoc: PDFDocument,
  page: PDFPage,
  tmpl: Template,
  doc: DocumentModel,
  branding: ClientBranding,
  boldFont: PDFFontT,
  font: PDFFontT,
  logo: PDFImage | null,
  whiteLogo: PDFImage | null
) {
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const blue = hexToRgb(branding.colors.header);
  const ink = hexToRgb(branding.colors.title);
  const gray = rgb(0.5, 0.54, 0.58);
  const pad = tmpl.marginLeft;
  const innerW = W - pad * 2;
  const eyebrowText = doc.cover?.header?.trim() || branding.tagline;

  let ty = H - 64;
  // Eyebrow (editable) + logo (right) + rule
  page.drawText(sanitize(eyebrowText.toUpperCase()), { x: pad, y: ty, size: 9, font: boldFont, color: ink });
  if (logo) {
    const lh = 30, lw = lh * (logo.width / logo.height);
    page.drawImage(logo, { x: W - pad - lw, y: ty + 4 - lh / 2, width: lw, height: lh });
  }
  ty -= 11;
  page.drawLine({ start: { x: pad, y: ty }, end: { x: W - pad, y: ty }, thickness: 1, color: ink });
  ty -= 50;

  // Title (blue) at the left margin; the "Workbook" label renders inline (ink) after it.
  // (No icon mark on the cover.)
  let tSize = 38;
  const title = applyCase(doc.title || 'Untitled', 'none');
  const wbLabel = (doc.cover?.workbookLabel ?? 'Workbook').trim();
  let titleLines = wrapText(title, innerW, boldFont, tSize);
  while (titleLines.length > 3 && tSize > 24) { tSize -= 3; titleLines = wrapText(title, innerW, boldFont, tSize); }
  const tx = pad;
  const titleLineH = tSize + 6;
  for (let i = 0; i < titleLines.length; i++) {
    const ln = titleLines[i];
    page.drawText(ln, { x: tx, y: ty, size: tSize, font: boldFont, color: blue });
    if (i === titleLines.length - 1 && wbLabel) {
      const lnW = boldFont.widthOfTextAtSize(ln, tSize);
      // "Workbook" label renders in the REGULAR weight (unbold) for contrast with the bold title.
      const lblW = font.widthOfTextAtSize(' ' + wbLabel, tSize);
      if (tx + lnW + lblW <= W - pad) {
        page.drawText(' ' + wbLabel, { x: tx + lnW, y: ty, size: tSize, font, color: ink });
      } else {
        ty -= titleLineH;
        page.drawText(wbLabel, { x: tx, y: ty, size: tSize, font, color: ink });
      }
    }
    ty -= titleLineH;
  }
  ty -= 16;

  // Session line (blue) + descriptor (gray) — both editable, optional
  const session = doc.cover?.subtitle?.trim();
  if (session) {
    for (const ln of wrapText(session, innerW, boldFont, 14)) { page.drawText(ln, { x: pad, y: ty, size: 14, font: boldFont, color: blue }); ty -= 20; }
  }
  const descriptor = doc.cover?.descriptor?.trim();
  if (descriptor) {
    for (const ln of wrapText(descriptor, innerW, font, 13)) { page.drawText(ln, { x: pad, y: ty, size: 13, font, color: gray }); ty -= 18; }
  }

  // Cover image — framed at content width for EVERY image (cropped left/right, bleeds off the bottom)
  const frameTop = ty - 18;
  const coverSrc = doc.cover?.imageUrl || coverById(doc.cover?.imageId)?.cover;
  const img = coverSrc ? await tryEmbedImage(pdfDoc, coverSrc) : null;
  if (img && frameTop > 130) {
    // Cover-fit into the content-width frame [pad..W-pad] × [0..frameTop]
    const scale = Math.max(innerW / img.width, frameTop / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    page.drawImage(img, { x: pad - (dw - innerW) / 2, y: frameTop - dh, width: dw, height: dh });
    // Mask side overflow so every image is framed at the same content width
    page.drawRectangle({ x: 0, y: 0, width: pad, height: frameTop, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: W - pad, y: 0, width: pad, height: frameTop, color: rgb(1, 1, 1) });
    // Smooth blue fade over the picture ONLY (gradient image → no banding): blue at the bottom → clear at the top
    const fade = await tryEmbedImage(pdfDoc, branding.logoUrl.replace(/[^/]*$/, 'blue-fade.png'));
    if (fade) {
      page.drawImage(fade, { x: pad, y: 0, width: innerW, height: frameTop });
    } else {
      const strips = 80;
      for (let s = 0; s < strips; s++) {
        page.drawRectangle({ x: pad, y: (s / strips) * frameTop, width: innerW, height: frameTop / strips + 0.8, color: blue, opacity: 0.9 * Math.pow(1 - s / strips, 1.25) });
      }
    }
    // White Sell It logo, bottom-right, over the fade — kept inside the image frame.
    if (whiteLogo) {
      const lh = 40, lw = lh * (whiteLogo.width / whiteLogo.height);
      page.drawImage(whiteLogo, { x: W - pad - lw - 10, y: 28, width: lw, height: lh });
    }
  }
}

// Draw a branded cover page: full-bleed photo (the client's chosen image) with a
// brand-colored band carrying the workbook title, author, and tagline.
async function drawCoverPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  tmpl: Template,
  doc: DocumentModel,
  branding: ClientBranding,
  boldFont: PDFFontT,
  font: PDFFontT,
  italicFont: PDFFontT,
  logo: PDFImage | null
) {
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const navy = hexToRgb(branding.colors.header);
  const gold = hexToRgb(branding.colors.accent);
  const pad = tmpl.marginLeft;
  const innerW = W - pad * 2;

  // Brand base so any area the photo doesn't cover (when zoomed out) reads as navy.
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: navy });

  // Background image. Base scale fills the page (cover-fit); imageZoom scales from
  // there (>1 zooms in/crops, <1 zooms out and lets the navy base show around it).
  // imageAlign / imageAlignV choose which part stays in frame.
  const coverSrc = doc.cover?.imageUrl || coverById(doc.cover?.imageId)?.cover;
  const img = coverSrc ? await tryEmbedImage(pdfDoc, coverSrc) : null;
  if (img) {
    const zoom = Math.max(0.4, Math.min(3, doc.cover?.imageZoom ?? 1));
    const scale = Math.max(W / img.width, H / img.height) * zoom;
    const dw = img.width * scale, dh = img.height * scale;
    const align = doc.cover?.imageAlign ?? 'center';
    const alignV = doc.cover?.imageAlignV ?? 'center';
    const dx = align === 'left' ? 0 : align === 'right' ? W - dw : (W - dw) / 2;
    // PDF y-origin is bottom-left: top → show the image's top, bottom → its bottom
    const dy = alignV === 'top' ? H - dh : alignV === 'bottom' ? 0 : (H - dh) / 2;
    page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
  }

  // Top brand bar + gold accent stripe
  const topBar = 16;
  page.drawRectangle({ x: 0, y: H - topBar, width: W, height: topBar, color: navy });
  page.drawRectangle({ x: 0, y: H - topBar - 3, width: W, height: 3, color: gold });

  // --- Title band along the bottom ---
  const titleCase = doc.titleCase ?? 'upper';
  let tSize = 32;
  const rawTitle = applyCase(doc.title || 'Untitled', titleCase);
  let titleLines = wrapText(rawTitle, innerW, boldFont, tSize);
  while (titleLines.length > 3 && tSize > 22) { tSize -= 2; titleLines = wrapText(rawTitle, innerW, boldFont, tSize); }
  const titleLH = tSize + 6;

  const orange = hexToRgb(branding.colors.title);
  // Author highlight: use the title color when it contrasts the band; otherwise the accent so it always pops
  const hlColor = branding.colors.title.toLowerCase() !== branding.colors.header.toLowerCase() ? orange : gold;
  const sub = doc.cover?.subtitle?.trim();
  const tagline = sanitize(branding.tagline);
  // Just the author's name (no "A workbook by" prefix). Falls back to the brand name if blank.
  const authorName = sanitize(doc.author?.trim() || branding.displayName);

  const topPad = 30, botPad = 28, titleGap = 16, byGap = 16, tagGap = 16;
  const eyebrowH = sub ? 22 : 0;
  const authorSize = 14;
  const contentH = eyebrowH + titleLines.length * titleLH + titleGap + authorSize + byGap + tagGap;
  const bandH = Math.min(H * 0.5, Math.max(H * 0.34, contentH + topPad + botPad));

  page.drawRectangle({ x: 0, y: 0, width: W, height: bandH, color: navy, opacity: img ? 0.9 : 1 });
  page.drawRectangle({ x: 0, y: bandH - 4, width: W, height: 4, color: gold });

  let ty = bandH - topPad;
  if (sub) {
    page.drawText(sanitize(sub.toUpperCase()), { x: pad, y: ty - 11, size: 11, font: boldFont, color: gold });
    ty -= eyebrowH;
  }
  ty -= tSize; // move to first title baseline
  for (const ln of titleLines) {
    page.drawText(ln, { x: pad, y: ty, size: tSize, font: boldFont, color: rgb(1, 1, 1) });
    ty -= titleLH;
  }
  ty -= titleGap;
  // Author name on an orange highlighter bar (no "A workbook by" prefix)
  const aW = boldFont.widthOfTextAtSize(authorName, authorSize);
  page.drawRectangle({ x: pad - 4, y: ty - 4, width: aW + 8, height: authorSize + 5, color: orange });
  page.drawText(authorName, { x: pad, y: ty, size: authorSize, font: boldFont, color: rgb(1, 1, 1) });
  ty -= byGap + 2;
  page.drawText(tagline, { x: pad, y: ty, size: 9, font: italicFont, color: rgb(0.85, 0.9, 0.94) });

  // Logo bottom-right within the band, if available (white wordmark + green leaf reads on navy)
  if (logo) {
    const targetH = 50;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: W - pad - w, y: 22, width: w, height: targetH });
  }
}

const JO_BIO: string[] = [
  'Jo Mangum is a REALTOR® with more than 30 years of experience as an agent, coach, leader, and teacher. After a successful career as a full-time agent, she discovered her true passion—helping others achieve success—and transitioned into coaching and education.',
  'At Realogy/Anywhere, Jo designed and launched programs to strengthen real estate careers across multiple brands. She led strategic productivity initiatives, drove recruiting efforts, and built international consulting divisions for ERA Global and Century 21 Global.',
  'As Vice President of Global REAL Coaching, Jo created and launched a division dedicated to leadership development, coaching skills, and personalized coaching programs. Her initiatives supported Coldwell Banker, Century 21, Sotheby’s International Realty, ERA, Better Homes & Gardens Realty, and Corcoran Realty worldwide.',
  'Jo’s influence has touched hundreds of thousands of agents and leaders through her coaching strategies, international programs, and continuing education courses. Her work continues to shape the growth and resilience of real estate professionals across the globe.',
];

// Optional "About Jo" page: photo (left) + logo & credentials (right), bio, accolade.
function drawAboutJoPage(
  page: PDFPage,
  tmpl: Template,
  branding: ClientBranding,
  photo: PDFImage | null,
  logo: PDFImage | null,
  font: PDFFontT,
  boldFont: PDFFontT,
  italicFont: PDFFontT
) {
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const pad = tmpl.marginLeft;
  const blue = hexToRgb(branding.colors.header);
  const ink = rgb(0.13, 0.13, 0.13);
  const bodySize = 12, lineH = 16, paraGap = 10;

  // Photo (left)
  const photoW = 165;
  const photoTop = H - tmpl.marginTop - 2;
  const photoH = photo ? photoW * (photo.height / photo.width) : 0;
  if (photo) page.drawImage(photo, { x: pad + 46, y: photoTop - photoH, width: photoW, height: photoH });
  const photoBottom = photo ? photoTop - photoH : photoTop - 200;

  // Logo + credentials (right of photo, upper area)
  if (logo) {
    const logoW = 188, logoH = logoW * (logo.height / logo.width);
    const lx = pad + 46 + photoW + 56;
    const ly = photoTop - 44 - logoH;
    page.drawImage(logo, { x: lx, y: ly, width: logoW, height: logoH });
    const cred = sanitize('CRS, GRI, PCC, REALTOR®');
    const cw = font.widthOfTextAtSize(cred, bodySize);
    page.drawText(cred, { x: lx + (logoW - cw) / 2, y: ly - 22, size: bodySize, font, color: ink });
  }

  // Bio + accolade, vertically centered in the white space below the photo/logo block
  const bioWrapped = JO_BIO.map((p) => wrapText(p, W - pad * 2, font, bodySize));
  const bioH = bioWrapped.reduce((s, lns) => s + lns.length * lineH, 0) + paraGap * (JO_BIO.length - 1);
  const accGap = 22, accH = 18;
  const blockH = bioH + accGap + accH;
  const regionTop = photoBottom - 28;
  const regionBottom = tmpl.marginBottom + 30;
  const extra = Math.max(0, (regionTop - regionBottom) - blockH);
  let yy = regionTop - extra / 2;
  for (const lns of bioWrapped) {
    for (const ln of lns) { page.drawText(ln, { x: pad, y: yy, size: bodySize, font, color: ink }); yy -= lineH; }
    yy -= paraGap;
  }

  // Accolade (italic, brand blue, centered)
  yy -= accGap - paraGap;
  const acc = sanitize('North Carolina Educator of the Year 2015');
  const aw = italicFont.widthOfTextAtSize(acc, 13);
  page.drawText(acc, { x: (W - aw) / 2, y: Math.max(tmpl.marginBottom + 18, yy), size: 13, font: italicFont, color: blue });
}

const JO_LEGAL: string[] = [
  'The information contained in this program is provided for educational and information purposes only and may not be suitable for your situation or location. This content is not a substitute for consulting with a licensed professional in your state of residence and nothing herein should be construed as legal advice. Please note that market conditions, local laws and regulation may differ based on your state of residence and can have a substantial effect on your business.  JAMM, Inc. makes no representations, warrantied (implied or otherwise) or guarantees that any of the advice contained herein will result in an increase in business, profits, or client volume. Nothing contained in this website or any JAMM, Inc. materials shall be construed as such a promise or guarantee.  JAMM, Inc. shall not be liable for any loss of profit or any other personal/commercial damages.',
  'Nothing contained in this program may be reproduced, stored, or transmitted in any form, or by any means except as permitted under Section 107 or 108 of the United States Copyright Act, without the prior written permission of JAMM, Inc.',
];

// Optional plain Legal/disclaimer page (no header bar or footer).
function drawLegalPage(page: PDFPage, tmpl: Template, font: PDFFontT, _boldFont: PDFFontT) {
  void _boldFont;
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const pad = tmpl.marginLeft;
  const ink = rgb(0.15, 0.15, 0.15);
  const bodySize = 12, lineH = 16, paraGap = 14;
  // Bottom-aligned: place the disclaimer block near the bottom of the page
  const legalWrapped = JO_LEGAL.map((p) => wrapText(p, W - pad * 2, font, bodySize));
  const totalH = legalWrapped.reduce((s, lns) => s + lns.length * lineH, 0) + paraGap * (JO_LEGAL.length - 1);
  let yy = tmpl.marginBottom + totalH + 6;
  for (const lns of legalWrapped) {
    for (const ln of lns) { page.drawText(ln, { x: pad, y: yy, size: bodySize, font, color: ink }); yy -= lineH; }
    yy -= paraGap;
  }
  void H;
}

// Draw the navy top bar and the branded footer (logo, tagline, social links, page number)
function drawBrandedChrome(
  pdfDoc: PDFDocument,
  page: PDFPage,
  tmpl: Template,
  branding: ClientBranding,
  logo: PDFImage | null,
  socialIcons: Record<string, PDFImage | null>,
  font: PDFFontT,
  italicFont: PDFFontT,
  boldFont: PDFFontT,
  pageNum: number
) {
  const W = tmpl.pageWidth;
  const headerColor = hexToRgb(branding.colors.header);
  const barH = tmpl.topBarHeight ?? 34;
  const footerH = tmpl.footerHeight ?? 56;

  // Top bar
  page.drawRectangle({ x: 0, y: W ? tmpl.pageHeight - barH : 0, width: W, height: barH, color: headerColor });

  // --- Footer ---
  const footerY = footerH; // baseline area
  // thin divider line above footer content
  page.drawLine({
    start: { x: tmpl.marginLeft, y: footerY + 6 },
    end: { x: W - tmpl.marginRight, y: footerY + 6 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  const centerY = footerH / 2 - 2;

  // Logo (left). If not yet uploaded, fall back to styled text.
  // rowMid = the logo's vertical center; the tagline, social icons, and page
  // number are all centered to it so they sit level with the wordmark.
  let rowMid = centerY + 5;
  if (logo) {
    const targetH = 42;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    // Raised off the page bottom so it isn't crammed against the edge
    const logoY = centerY - targetH / 2 + 12;
    page.drawImage(logo, { x: tmpl.marginLeft, y: logoY, width: w, height: targetH });
    rowMid = logoY + targetH / 2;
  } else {
    page.drawText(sanitize(branding.displayName), { x: tmpl.marginLeft, y: centerY, size: 14, font: boldFont, color: hexToRgb(branding.colors.title) });
  }

  // Tagline (center) — vertically centered to the logo. sanitize keeps the middot (·).
  const tagline = sanitize(branding.tagline);
  const tagSize = 8.5;
  const tagWidth = italicFont.widthOfTextAtSize(tagline, tagSize);
  page.drawText(tagline, {
    x: (W - tagWidth) / 2,
    y: rowMid - tagSize * 0.34,
    size: tagSize,
    font: italicFont,
    color: headerColor,
  });

  // Social icons (right), clickable — vertically centered to the logo
  const iconSize = 16;
  const gap = 8;
  const count = branding.social.length;
  const pageNumW = 18;
  let ix = W - tmpl.marginRight - pageNumW - count * (iconSize + gap);
  const iconY = rowMid - iconSize / 2;
  for (const s of branding.social) {
    const img = socialIcons[s.type];
    if (img) {
      const scale = iconSize / img.height;
      page.drawImage(img, { x: ix, y: iconY, width: img.width * scale, height: iconSize });
    } else {
      drawSocialIcon(page, s.type, ix, iconY, iconSize, font);
    }
    addLink(pdfDoc, page, ix, iconY, iconSize, iconSize, s.url);
    ix += iconSize + gap;
  }

  // Page number (far right) — vertically centered to the logo
  page.drawText(`${pageNum}`, {
    x: W - tmpl.marginRight - 6,
    y: rowMid - 9 * 0.34,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

// Simple recognizable social icons drawn with shapes (placeholder until brand PNGs are supplied)
function drawSocialIcon(
  page: PDFPage,
  type: ClientBranding['social'][number]['type'],
  x: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const colors: Record<string, RGB> = {
    website: rgb(0.2, 0.2, 0.2),
    linkedin: rgb(0.04, 0.4, 0.62),
    youtube: rgb(0.8, 0.13, 0.13),
    instagram: rgb(0.76, 0.18, 0.45),
    facebook: rgb(0.1, 0.34, 0.65),
  };
  const c = colors[type] ?? rgb(0.2, 0.2, 0.2);

  if (type === 'website') {
    // globe: circle outline
    page.drawCircle({ x: x + size / 2, y: y + size / 2, size: size / 2 - 1, borderColor: c, borderWidth: 1.2, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: x + 1, y: y + size / 2 }, end: { x: x + size - 1, y: y + size / 2 }, thickness: 0.8, color: c });
    page.drawEllipse({ x: x + size / 2, y: y + size / 2, xScale: size / 5, yScale: size / 2 - 1, borderColor: c, borderWidth: 0.8, color: rgb(1, 1, 1) });
  } else {
    // rounded square badge with a letter/symbol
    page.drawRectangle({ x, y, width: size, height: size, color: c });
    const glyph = type === 'linkedin' ? 'in' : type === 'youtube' ? '>' : type === 'instagram' ? 'o' : 'f';
    const gs = type === 'linkedin' ? 7 : 9;
    const gw = font.widthOfTextAtSize(glyph, gs);
    page.drawText(glyph, { x: x + (size - gw) / 2, y: y + (size - gs) / 2 + 1, size: gs, font, color: rgb(1, 1, 1) });
  }
}
