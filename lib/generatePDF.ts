import { PDFDocument, rgb, StandardFonts, RGB, PDFString, PDFName, PDFPage, PDFImage } from 'pdf-lib';
import { DocumentModel, TemplateId, ColorTheme, ClientBranding, FormField, DocTable } from '@/types/document';
import { classicTemplate } from './templates/classic';
import { modernTemplate } from './templates/modern';
import { workbookTemplate } from './templates/workbook';
import { jomangumTemplate } from './templates/jomangum';

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

function getTemplate(id: TemplateId): Template {
  if (id === 'modern') return modernTemplate;
  if (id === 'workbook') return workbookTemplate;
  if (id === 'jomangum') return jomangumTemplate;
  return classicTemplate;
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
  const words = sanitize(text).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const branded = templateId === 'jomangum' && !!branding;

  // Copy the template so we can apply document-level spacing without mutating the shared constant
  const tmpl = { ...getTemplate(templateId) };
  const spacingScale = doc.bodySpacing === 'compact' ? 0.5 : doc.bodySpacing === 'relaxed' ? 2 : 1;
  tmpl.paragraphSpacing = Math.round(tmpl.paragraphSpacing * spacingScale);
  // When branded, colors come from the client brand rather than the theme picker
  const primaryColor = hexToRgb(branded ? branding!.colors.title : theme.primary);
  const secondaryColor = hexToRgb(branded ? branding!.colors.subtitle : theme.secondary);
  const accentColor = hexToRgb(branded ? branding!.colors.accent : theme.secondary);
  const bgColor = hexToRgb(theme.background);

  // Pre-embed brand logo (may be null until the client uploads it)
  const brandLogo = branded ? await tryEmbedImage(pdfDoc, branding!.logoUrl) : null;

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

  fillBackground();

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
  const rawTitle = applyCase(sanitize(doc.title || 'Untitled'), titleCase);
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
    // A small, consistent gap before a heading (level-2 sits closer to its parent)
    if (branded && y < tmpl.pageHeight - tmpl.marginTop - 2) {
      y -= section.level === 1 ? 6 : 2;
    }
    ensureSpace(tmpl.headingSize + tmpl.sectionSpacing);

    // Section heading
    if (branded) {
      // Headers/subheaders are NOT bulleted by default. 'accent' (opt-in) adds a square bullet;
      // default H1 = brand title color, H2 = brand subtitle color, both bold and unbulleted.
      const style = section.headingStyle ?? (section.level === 1 ? 'title' : 'brand');
      const size = section.level === 1 ? tmpl.headingSize : tmpl.subheadingSize;
      const headingText = applyCase(sanitize(section.title), section.headingCase);
      const headingColor =
        style === 'brand' ? hexToRgb(branding!.colors.subtitle)
        : style === 'plain' ? rgb(0.15, 0.15, 0.15)
        : primaryColor; // 'title' and 'accent' both use the primary brand color
      const sq = Math.round(size * 0.55);
      const drawBullet = style === 'accent';
      const textX = drawBullet ? tmpl.marginLeft + sq + 7 : tmpl.marginLeft;
      if (drawBullet) {
        page.drawRectangle({ x: tmpl.marginLeft, y: y + 1, width: sq, height: sq, color: accentColor });
      }
      // Wrap long headings to the content margin instead of overflowing
      const hLines = wrapText(headingText, mainColWidth - (textX - tmpl.marginLeft), boldFont, size);
      for (const hl of hLines) {
        page.drawText(hl, { x: textX, y, size, font: boldFont, color: headingColor });
        y -= size + 2;
      }
      y -= (section.level === 1 ? 8 : 5);
    } else if (section.level === 1) {
      {
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
      page.drawText(applyCase(sanitize(section.title), section.headingCase), {
        x: tmpl.marginLeft,
        y,
        size: tmpl.subheadingSize,
        font: boldFont,
        color: secondaryColor,
      });
      y -= tmpl.subheadingSize + 6;
    }

    // Per-section spacing multiplier — the editor's drag bar adjusts this to pull
    // content up (smaller) or push it down (larger) to control page breaks.
    const sp = section.spacing ?? 1;

    // ---- ordered content rendering (preserves document order) ----
    const renderText = (txt: string) => {
      for (const wline of wrapText(txt, mainColWidth, font, tmpl.bodySize)) {
        ensureSpace(tmpl.lineHeight);
        page.drawText(wline, { x: tmpl.marginLeft, y, size: tmpl.bodySize, font, color: rgb(0.1, 0.1, 0.1) });
        y -= tmpl.lineHeight;
      }
      y -= tmpl.paragraphSpacing * sp;
    };

    const renderBullet = (txt: string) => {
      const wrapped = wrapText(txt, mainColWidth - tmpl.bulletIndent - 6, font, tmpl.bodySize);
      ensureSpace(tmpl.lineHeight);
      if (branded) {
        page.drawRectangle({ x: tmpl.marginLeft + tmpl.bulletIndent, y: y + 1, width: 6, height: 6, color: accentColor });
      } else {
        page.drawText('•', { x: tmpl.marginLeft + tmpl.bulletIndent, y, size: tmpl.bodySize, font: boldFont, color: secondaryColor });
      }
      page.drawText(wrapped[0], { x: tmpl.marginLeft + tmpl.bulletIndent + 10, y, size: tmpl.bodySize, font, color: rgb(0.1, 0.1, 0.1) });
      y -= tmpl.lineHeight;
      for (let i = 1; i < wrapped.length; i++) {
        ensureSpace(tmpl.lineHeight);
        page.drawText(wrapped[i], { x: tmpl.marginLeft + tmpl.bulletIndent + 10, y, size: tmpl.bodySize, font, color: rgb(0.1, 0.1, 0.1) });
        y -= tmpl.lineHeight;
      }
    };

    const renderField = (field: FormField) => {
      const fieldName = `${section.id}__${field.id}`;
      const IFS = 10; // interactive font size (Arial/Helvetica 10) for all fillable text
      if (field.type === 'checkbox') {
        ensureSpace(20);
        page.drawText(sanitize(field.label), { x: tmpl.marginLeft + 20, y, size: IFS, font, color: rgb(0.2, 0.2, 0.2) });
        const cb = form.createCheckBox(fieldName);
        cb.addToPage(page, { x: tmpl.marginLeft, y: y - 2, width: 14, height: 14, borderColor: primaryColor, backgroundColor: rgb(1, 1, 1) });
        y -= 22;
      } else if (field.type === 'dropdown') {
        const label = sanitize(field.label).trim();
        ensureSpace((label ? IFS + 4 : 0) + tmpl.fieldHeight + 8);
        if (label) { page.drawText(label, { x: tmpl.marginLeft, y, size: IFS, font, color: rgb(0.2, 0.2, 0.2) }); y -= IFS - 2; }
        const dd = form.createDropdown(fieldName);
        dd.addOptions(field.options ?? []);
        dd.addToPage(page, { x: tmpl.marginLeft, y: y - tmpl.fieldHeight, width: Math.min(160, mainColWidth), height: tmpl.fieldHeight, borderColor: branded ? accentColor : primaryColor, backgroundColor: rgb(1, 1, 1) });
        dd.setFontSize(IFS);
        y -= tmpl.fieldHeight + 18 * sp;
      } else {
        const label = sanitize(field.label).trim();
        const fh = field.type === 'textarea' ? tmpl.textareaHeight : tmpl.fieldHeight;
        ensureSpace((label ? IFS + 4 : 0) + fh + 8);
        if (label) { page.drawText(label, { x: tmpl.marginLeft, y, size: IFS, font, color: rgb(0.2, 0.2, 0.2) }); y -= IFS - 2; }
        const tf = form.createTextField(fieldName);
        if (field.type === 'textarea') tf.enableMultiline();
        tf.addToPage(page, { x: tmpl.marginLeft, y: y - fh, width: mainColWidth, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: branded ? hexToRgb(branding.colors.grayBox) : rgb(0.98, 0.98, 0.98) });
        tf.setFontSize(IFS);
        y -= fh + 18 * sp;
      }
    };

    const renderTable = (table: DocTable) => {
      const cols = table.headers.length || (table.rows[0]?.length ?? 0);
      if (cols === 0) return;
      const colW = mainColWidth / cols;
      const rowH = 24;
      const headerColor = branded ? hexToRgb(branding.colors.subtitle) : primaryColor;

      const drawHeader = () => {
        page.drawRectangle({ x: tmpl.marginLeft, y: y - rowH + 4, width: mainColWidth, height: rowH, color: headerColor, opacity: 0.12 });
        table.headers.forEach((h: string, c: number) => {
          const lines = wrapText(h, colW - 8, boldFont, 9);
          page.drawText(lines[0] ?? '', { x: tmpl.marginLeft + c * colW + 4, y: y - 12, size: 9, font: boldFont, color: headerColor });
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
              dd.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: rgb(1, 1, 1) });
            } else {
              const tf = form.createTextField(name);
              tf.addToPage(page, { x: fx, y: fy, width: fw, height: fh, borderColor: branded ? accentColor : primaryColor, backgroundColor: rgb(1, 1, 1) });
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
      const allWrapped = [];
      for (const line of lines) { allWrapped.push(...wrapText(line, innerW, font, tmpl.bodySize)); allWrapped.push(''); }
      if (allWrapped[allWrapped.length - 1] === '') allWrapped.pop();
      const boxH = allWrapped.length * tmpl.lineHeight + pad * 2;
      ensureSpace(boxH + 8);
      const boxTop = y + tmpl.bodySize;
      page.drawRectangle({ x: tmpl.marginLeft, y: boxTop - boxH, width: mainColWidth, height: boxH, color: calloutBg });
      page.drawRectangle({ x: tmpl.marginLeft + 5, y: boxTop - boxH + 5, width: mainColWidth - 10, height: boxH - 10, borderColor: hexToRgb(branding!.colors.calloutBorder), borderWidth: 1, borderDashArray: [3, 3], color: calloutBg });
      let cy = boxTop - pad - tmpl.bodySize + 2;
      for (const wline of allWrapped) { if (wline) page.drawText(wline, { x: tmpl.marginLeft + pad, y: cy, size: tmpl.bodySize, font, color: rgb(1, 1, 1) }); cy -= tmpl.lineHeight; }
      y = boxTop - boxH - tmpl.paragraphSpacing;
    };

    if (branded && section.callout) {
      const texts = section.content.filter((i) => i.kind === 'text').map((i) => i.text);
      if (texts.length) renderCalloutBox(texts);
      for (const item of section.content) {
        if (item.kind === 'bullet') renderBullet(item.text);
        else if (item.kind === 'field') renderField(item.field);
        else if (item.kind === 'table') renderTable(item.table);
      }
    } else {
      for (const item of section.content) {
        if (item.kind === 'text') renderText(item.text);
        else if (item.kind === 'bullet') renderBullet(item.text);
        else if (item.kind === 'field') renderField(item.field);
        else if (item.kind === 'table') renderTable(item.table);
      }
    }

    y -= tmpl.sectionSpacing * sp;
  }

  // --- Page chrome (header bar + footer) on every page ---
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);

    if (branded) {
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
    const targetH = 44;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: tmpl.marginLeft, y: centerY - targetH / 2 + 2, width: w, height: targetH });
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
