import { PDFDocument, rgb, StandardFonts, RGB, PDFString, PDFName, PDFPage, PDFImage } from 'pdf-lib';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding, FormField, DocTable } from '@/types/document';
import { classicTemplate } from './templates/classic';
import { modernTemplate } from './templates/modern';
import { workbookTemplate } from './templates/workbook';
import { jomangumTemplate } from './templates/jomangum';
import { sellitTemplate } from './templates/sellit';
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
    if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
      return await pdfDoc.embedJpg(buf);
    }
    return await pdfDoc.embedPng(buf);
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
  branding?: ClientBranding
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const form = pdfDoc.getForm();
  let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const jo = templateId === 'jomangum' && !!branding;
  const sellit = templateId === 'sellit' && !!branding;
  const branded = jo || sellit;

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
      await drawSellItCover(pdfDoc, page, tmpl, doc, branding!, boldFont, font, brandLogo, sellitMark);
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

    // A small, consistent gap before a heading (level-2 sits closer to its parent)
    if (branded && y < tmpl.pageHeight - tmpl.marginTop - 2) {
      y -= section.level === 1 ? 6 : 2;
    }

    // Section heading
    if (branded) {
      // Headers/subheaders are NOT bulleted by default. 'accent' (opt-in) adds a square bullet;
      // default H1 = brand title color, H2 = brand subtitle color, both bold and unbulleted.
      const style = section.headingStyle ?? (section.level === 1 ? 'title' : 'brand');
      const size = section.level === 1 ? tmpl.headingSize : tmpl.subheadingSize;
      // raw (not pre-sanitized) so wrapText() can honor hard line breaks in the heading
      const headingText = applyCase(section.title, section.headingCase);
      const headingColor =
        style === 'brand' ? hexToRgb(branding!.colors.subtitle)
        : style === 'plain' ? rgb(0.15, 0.15, 0.15)
        : primaryColor; // 'title' and 'accent' both use the primary brand color
      const sq = Math.round(size * 0.55);
      // Sell It draws its icon mark beside every page (H1) title instead of a bullet.
      const useMark = sellit && section.level === 1 && !!sellitMark;
      const markH = size + 4;
      const markW = useMark ? markH * (sellitMark!.width / sellitMark!.height) : 0;
      const drawBullet = !useMark && style === 'accent';
      const textX = useMark ? tmpl.marginLeft + markW + 9 : drawBullet ? tmpl.marginLeft + sq + 7 : tmpl.marginLeft;
      // Wrap long headings to the content margin instead of overflowing
      const hLines = wrapText(headingText, mainColWidth - (textX - tmpl.marginLeft), boldFont, size);
      // Orphan control: keep the whole heading together with the start of its content
      ensureSpace(hLines.length * (size + 2) + (section.level === 1 ? 8 : 5) + leadEstimate());
      if (useMark) {
        page.drawImage(sellitMark!, { x: tmpl.marginLeft, y: y - 2, width: markW, height: markH });
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
      const col = resolveColor(color) ?? rgb(0.1, 0.1, 0.1);
      // widow/orphan control keeps >=2 lines of a paragraph together across pages
      placeLines(wrapText(txt, mainColWidth, font, tmpl.bodySize), lineH,
        (wline) => page.drawText(wline, { x: tmpl.marginLeft, y, size: tmpl.bodySize, font, color: col }));
      y -= tmpl.paragraphSpacing * sp;
    };

    const renderBullet = (txt: string, color?: string) => {
      const col = resolveColor(color) ?? rgb(0.1, 0.1, 0.1);
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
      const IFS = 10;          // interactive font size for fillable text
      const labLH = IFS + 3;   // label line height (so long prompts wrap, not overflow)
      const labelColor = rgb(0.2, 0.2, 0.2);

      if (field.type === 'checkbox') {
        // Wrap the label to the right of the checkbox; box sits on the first line.
        const lines = wrapText(field.label, mainColWidth - 20, font, IFS);
        ensureSpace(Math.max(20, lines.length * labLH));
        const cb = form.createCheckBox(fieldName);
        cb.addToPage(page, { x: tmpl.marginLeft, y: y - 2, width: 14, height: 14, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
        for (const ln of lines) { page.drawText(ln, { x: tmpl.marginLeft + 20, y, size: IFS, font, color: labelColor }); y -= labLH; }
        y -= Math.max(0, 22 - labLH);
      } else {
        const hasLabel = !!field.label.trim();
        const fh = field.type === 'textarea' ? tmpl.textareaHeight : tmpl.fieldHeight;
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

    const renderTable = (table: DocTable) => {
      const cols = table.headers.length || (table.rows[0]?.length ?? 0);
      if (cols === 0) return;
      const colW = mainColWidth / cols;
      const rowH = 24;
      const headerColor = branded ? hexToRgb(branding.colors.subtitle) : primaryColor;

      // Sell It: solid blue header bar with white text. Others: light tint with brand-color text.
      const solidHeader = sellit;
      const drawHeader = () => {
        page.drawRectangle({ x: tmpl.marginLeft, y: y - rowH + 4, width: mainColWidth, height: rowH, color: headerColor, opacity: solidHeader ? 1 : 0.12 });
        const htColor = solidHeader ? rgb(1, 1, 1) : headerColor;
        table.headers.forEach((h: string, c: number) => {
          const lines = wrapText(h, colW - 8, boldFont, 9);
          page.drawText(lines[0] ?? '', { x: tmpl.marginLeft + c * colW + 4, y: y - 12, size: 9, font: boldFont, color: htColor });
        });
        y -= rowH;
      };

      // Keep the table together: if it doesn't fit here but fits on a fresh page, start fresh
      const tableHeight = (table.rows.length + 1) * rowH;
      const usable = tmpl.pageHeight - tmpl.marginTop - tmpl.marginBottom;
      if (y - tableHeight < tmpl.marginBottom && tableHeight <= usable) {
        newPage();
      }

      let ty = (drawHeader(), y);
      for (const row of table.rows) {
        if (ty - rowH < tmpl.marginBottom) {
          newPage();
          drawHeader();          // repeat the header on the continued page
          ty = y;
        }
        for (let c = 0; c < cols; c++) {
          const cell = row[c];
          const cx = tmpl.marginLeft + c * colW;
          page.drawRectangle({ x: cx, y: ty - rowH + 4, width: colW, height: rowH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5, color: rgb(1, 1, 1) });
          if (!cell) continue;
          if (cell.field) {
            const name = `${section.id}__${cell.field.id}`;
            const fw = colW - 10, fh = 15, fx = cx + 5, fy = ty - rowH + 4 + (rowH - fh) / 2;
            if (cell.field.type === 'dropdown' && cell.field.options) {
              const dd = form.createDropdown(name); dd.addOptions(cell.field.options);
              dd.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
            } else {
              const tf = form.createTextField(name);
              tf.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: fieldBg });
            }
          } else if (cell.text) {
            const lines = wrapText(cell.text, colW - 8, font, 9);
            page.drawText(lines[0] ?? '', { x: cx + 4, y: ty - 12, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
          }
        }
        ty -= rowH;
      }
      y = ty - tmpl.paragraphSpacing;
    };

    const renderCalloutBox = (lines: string[]) => {
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
      // Track whether the previous block was a "box" (textarea/dropdown/table) so a
      // following text line (e.g. the next numbered question) gets clear separation.
      let lastWasBox = false;
      for (const item of section.content) {
        if (item.kind === 'text') {
          if (lastWasBox) y -= 12 * sp;
          renderText(item.text, item.color);
          lastWasBox = false;
        } else if (item.kind === 'bullet') {
          renderBullet(item.text, item.color);
          lastWasBox = false;
        } else if (item.kind === 'field') {
          renderField(item.field);
          lastWasBox = item.field.type === 'textarea' || item.field.type === 'dropdown' || item.field.type === 'text';
        } else if (item.kind === 'table') {
          renderTable(item.table);
          lastWasBox = true;
        }
      }
    }

    y -= tmpl.sectionSpacing * sp;
  }

  // --- Page chrome (header bar + footer) on every page ---
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    if (hasCover && i === 0) continue; // the cover has its own full-bleed design
    const p = pdfDoc.getPage(i);

    if (sellit) {
      drawSellItChrome(p, tmpl, branding!, brandLogo, font, boldFont, i + 1);
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

  return pdfDoc.save();
}

// Sell It interior chrome: eyebrow tagline (left) + logo (right) header, page-number footer.
function drawSellItChrome(
  page: PDFPage,
  tmpl: Template,
  branding: ClientBranding,
  logo: PDFImage | null,
  font: PDFFontT,
  boldFont: PDFFontT,
  pageNum: number
) {
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const gray = rgb(0.5, 0.54, 0.58);
  const topY = H - 48;

  // Eyebrow tagline (left), lightly letter-spaced
  const eyebrow = sanitize(branding.tagline.toUpperCase()).split('').join(' '.replace(/.*/, ' '));
  page.drawText(sanitize(branding.tagline.toUpperCase()), { x: tmpl.marginLeft, y: topY, size: 8, font: boldFont, color: gray });

  // Logo (right)
  if (logo) {
    const h = 15;
    const w = h * (logo.width / logo.height);
    page.drawImage(logo, { x: W - tmpl.marginRight - w, y: topY - 4, width: w, height: h });
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
  mark: PDFImage | null
) {
  void logo;
  const W = tmpl.pageWidth, H = tmpl.pageHeight;
  const blue = hexToRgb(branding.colors.header);
  const ink = hexToRgb(branding.colors.title);
  const gray = rgb(0.5, 0.54, 0.58);
  const pad = tmpl.marginLeft;
  const innerW = W - pad * 2;

  let ty = H - 64;
  // Eyebrow + rule
  page.drawText(sanitize(branding.tagline.toUpperCase()), { x: pad, y: ty, size: 9, font: boldFont, color: ink });
  ty -= 9;
  page.drawLine({ start: { x: pad, y: ty }, end: { x: W - pad, y: ty }, thickness: 1, color: ink });
  ty -= 46;

  // Title (blue) with the icon mark to its left
  let tSize = 36;
  const markH = tSize;
  const markW = mark ? markH * (mark.width / mark.height) : 0;
  const tx = mark ? pad + markW + 14 : pad;
  const titleMaxW = W - pad - tx;
  let titleLines = wrapText(applyCase(doc.title || 'Untitled', 'none'), titleMaxW, boldFont, tSize);
  while (titleLines.length > 3 && tSize > 24) { tSize = tSize - 3; titleLines = wrapText(applyCase(doc.title || 'Untitled', 'none'), W - pad - (mark ? pad + tSize * (mark.width / mark.height) + 14 : pad), boldFont, tSize); }
  if (mark) page.drawImage(mark, { x: pad, y: ty - (tSize - tSize) - 4, width: tSize * (mark.width / mark.height), height: tSize });
  const tx2 = mark ? pad + tSize * (mark.width / mark.height) + 14 : pad;
  for (const ln of titleLines) {
    page.drawText(ln, { x: tx2, y: ty, size: tSize, font: boldFont, color: blue });
    ty -= tSize + 4;
  }
  ty -= 18;

  // WORKBOOK
  page.drawText('WORKBOOK', { x: pad, y: ty, size: 26, font: boldFont, color: ink });
  ty -= 30;

  // Cover subtitle (e.g. "Session 1 — ...") in blue
  const sub = doc.cover?.subtitle?.trim();
  if (sub) {
    for (const ln of wrapText(sub, innerW, boldFont, 13)) { page.drawText(ln, { x: pad, y: ty, size: 13, font: boldFont, color: blue }); ty -= 18; }
  }
  // Author line (gray) if present
  if (doc.author?.trim()) { page.drawText(sanitize(doc.author.trim()), { x: pad, y: ty, size: 12, font, color: gray }); ty -= 18; }

  // Optional image contained in the remaining lower area
  const chosen = coverById(doc.cover?.imageId);
  const img = chosen ? await tryEmbedImage(pdfDoc, chosen.cover) : null;
  if (img) {
    const top = ty - 12;
    const bottom = tmpl.marginBottom + 6;
    const boxH = top - bottom;
    if (boxH > 60) {
      const scale = Math.min(innerW / img.width, boxH / img.height); // contain — never overflow
      const dw = img.width * scale, dh = img.height * scale;
      page.drawImage(img, { x: pad, y: top - dh, width: dw, height: dh });
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
  const chosen = coverById(doc.cover?.imageId);
  const img = chosen ? await tryEmbedImage(pdfDoc, chosen.cover) : null;
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

  // Logo bottom-right within the band, if available
  if (logo) {
    const targetH = 54;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: W - pad - w, y: 22, width: w, height: targetH });
  }
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
  if (logo) {
    const targetH = 42;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    // Raised off the page bottom so it isn't crammed against the edge
    page.drawImage(logo, { x: tmpl.marginLeft, y: centerY - targetH / 2 + 12, width: w, height: targetH });
  } else {
    page.drawText('Jo', { x: tmpl.marginLeft, y: centerY, size: 16, font: boldFont, color: hexToRgb(branding.colors.title) });
    page.drawText('Mangum', { x: tmpl.marginLeft + 18, y: centerY, size: 14, font: italicFont, color: headerColor });
  }

  // Tagline (center, italic) — sanitize keeps the middot (·, 0xB7) which Helvetica supports
  const tagline = sanitize(branding.tagline);
  const tagSize = 8.5;
  const tagWidth = italicFont.widthOfTextAtSize(tagline, tagSize);
  page.drawText(tagline, {
    x: (W - tagWidth) / 2,
    y: centerY,
    size: tagSize,
    font: italicFont,
    color: headerColor,
  });

  // Social icons (right), clickable
  const iconSize = 16;
  const gap = 8;
  const count = branding.social.length;
  const pageNumW = 18;
  let ix = W - tmpl.marginRight - pageNumW - count * (iconSize + gap);
  const iconY = centerY - 4;
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

  // Page number (far right)
  page.drawText(`${pageNum}`, {
    x: W - tmpl.marginRight - 6,
    y: centerY,
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
