import { DocumentModel, Section, FormField, FieldType, DocTable, TableCell, ContentItem } from '@/types/document';

let sectionCounter = 0;
let fieldCounter = 0;

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function newField(type: FieldType, label: string, options?: string[]): FormField {
  fieldCounter++;
  return { id: makeId('field'), label: label || `Field ${fieldCounter}`, type, required: false, ...(options ? { options } : {}) };
}

function parseFieldMarker(line: string): FormField | null {
  const textMatch = line.match(/^\[field\]\s*(.*)/i);
  const textareaMatch = line.match(/^\[textarea\]\s*(.*)/i);
  const checkboxMatch = line.match(/^\[checkbox\]\s*(.*)/i);
  if (textMatch) return newField('text', textMatch[1].trim());
  if (textareaMatch) return newField('textarea', textareaMatch[1].trim());
  if (checkboxMatch) return newField('checkbox', checkboxMatch[1].trim());
  return null;
}

// ---- shared content helpers --------------------------------------------------

function asCheckbox(text: string): string | null {
  const m = text.match(/^\s*[□☐■☑✓✔☒]\s*(.*)$/);
  return m ? m[1].trim() : null;
}

// An open-ended prompt that should become a write-in answer box
function isAnswerPrompt(text: string): boolean {
  return /\?\s*$/.test(text) && /^(why|how|what|which|explain|describe|list|share|your|tell)\b/i.test(text);
}

function isBoldHeading(el: Element): boolean {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const bold = el.querySelectorAll('strong, b');
  if (bold.length === 0) return false;
  const boldText = Array.from(bold).map((b) => b.textContent || '').join('').trim();
  if (boldText.length < text.length - 2) return false;
  const wordCount = text.split(' ').length;
  return text.length <= 60 && wordCount <= 8 && !/[.?!,;]$/.test(text);
}

// ---- table parsing -----------------------------------------------------------

function isBlankCell(text: string): boolean {
  return text === '' || /^[_.\s]{2,}$/.test(text);
}

function rangeOptions(header: string): string[] | null {
  const m = header.match(/\(?\s*(\d+)\s*[-–]\s*(\d+)\s*\)?/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (isNaN(lo) || isNaN(hi) || hi <= lo || hi - lo > 50) return null;
  const opts: string[] = [];
  for (let v = lo; v <= hi; v++) opts.push(String(v));
  return opts;
}

function cellText(td: Element): string {
  return (td.textContent || '').replace(/\s+/g, ' ').trim();
}

function parseTable(tableEl: Element): DocTable {
  const headerCells = Array.from(tableEl.querySelectorAll('thead th, thead td'));
  let headers = headerCells.map(cellText);
  let dataRows = Array.from(tableEl.querySelectorAll('tbody tr'));

  if (headers.length === 0) {
    const allRows = Array.from(tableEl.querySelectorAll('tr'));
    if (allRows.length) {
      headers = Array.from(allRows[0].children).map(cellText);
      dataRows = allRows.slice(1);
    }
  }

  const colOptions = headers.map(rangeOptions);

  const rows: TableCell[][] = dataRows.map((tr) =>
    Array.from(tr.children).map((td, col): TableCell => {
      const text = cellText(td);
      if (isBlankCell(text)) {
        const opts = colOptions[col];
        return { text: '', field: newField(opts ? 'dropdown' : 'text', '', opts ?? undefined) };
      }
      return { text };
    })
  );

  return { id: makeId('table'), headers, rows };
}

// ---- section builder ---------------------------------------------------------

function makeSection(level: 1 | 2, title: string): Section {
  sectionCounter++;
  return { id: makeId('section'), level, title, content: [] };
}

// ---- HTML parser (Word docs via mammoth) -------------------------------------

export function parseWorkbookHtml(html: string): DocumentModel {
  sectionCounter = 0;
  fieldCounter = 0;

  const docEl = new DOMParser().parseFromString(html, 'text/html');
  const blocks = Array.from(docEl.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, table'));

  const sections: Section[] = [];
  let current: Section | null = null;
  let title = 'Untitled Document';
  let titleSet = false;

  const push = () => { if (current) sections.push(current); };
  const ensure = () => { if (!current) current = makeSection(1, 'Document'); };
  const text = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  function nextText(from: number): string {
    for (let j = from + 1; j < blocks.length; j++) {
      const e = blocks[j];
      if ((e.tagName === 'P' || e.tagName === 'LI') && e.closest('table, li')) continue;
      const t = text(e);
      if (t) return t;
    }
    return '';
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const el = blocks[bi];
    const tag = el.tagName.toLowerCase();

    if (tag === 'table') {
      ensure();
      current!.content.push({ id: makeId('c'), kind: 'table', table: parseTable(el) });
      continue;
    }

    if ((el.tagName === 'P' || el.tagName === 'LI') && el.closest('table')) continue;
    if (el.tagName === 'P' && el.closest('li')) continue;

    const t = text(el);
    if (!t) continue;

    if (/^h[1-6]$/.test(tag) || (tag === 'p' && isBoldHeading(el))) {
      const level: 1 | 2 = tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' ? 2 : 1;
      if (!titleSet) { title = t; titleSet = true; }
      push();
      current = makeSection(level, t);
      continue;
    }

    const cb = asCheckbox(t);
    if (cb !== null) {
      ensure();
      current!.content.push({ id: makeId('c'), kind: 'field', field: newField('checkbox', cb) });
      continue;
    }

    const marker = parseFieldMarker(t);
    if (marker) {
      ensure();
      current!.content.push({ id: makeId('c'), kind: 'field', field: marker });
      continue;
    }

    if (isAnswerPrompt(t) && asCheckbox(nextText(bi)) === null) {
      ensure();
      current!.content.push({ id: makeId('c'), kind: 'field', field: newField('textarea', t) });
      continue;
    }

    ensure();
    if (tag === 'li') current!.content.push({ id: makeId('c'), kind: 'bullet', text: t });
    else current!.content.push({ id: makeId('c'), kind: 'text', text: t });
  }

  push();
  if (sections.length === 0) sections.push(makeSection(1, 'Document'));
  return { title, author: '', sections };
}

// ---- plain text / markdown parser (.txt, .md, pasted) ------------------------

export function parseWorkbook(rawText: string): DocumentModel {
  sectionCounter = 0;
  fieldCounter = 0;

  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  let title = 'Untitled Document';
  let titleSet = false;

  const push = () => { if (current) sections.push(current); };
  const ensure = () => { if (!current) current = makeSection(1, 'Document'); };

  const meaningful = lines.map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < meaningful.length; i++) {
    const trimmed = meaningful[i];
    const normalized = trimmed
      .replace(/^[□☐]\s*/, '[checkbox] ')
      .replace(/^[■☑✓✔]\s*/, '[checkbox] ');

    if (normalized.startsWith('## ')) {
      push();
      current = makeSection(2, normalized.slice(3).trim());
    } else if (normalized.startsWith('# ')) {
      const heading = normalized.slice(2).trim();
      if (!titleSet) { title = heading; titleSet = true; }
      push();
      current = makeSection(1, heading);
    } else if (normalized.startsWith('- ')) {
      ensure();
      current!.content.push({ id: makeId('c'), kind: 'bullet', text: normalized.slice(2).trim() });
    } else {
      const marker = parseFieldMarker(normalized);
      if (marker) {
        ensure();
        current!.content.push({ id: makeId('c'), kind: 'field', field: marker });
      } else if (isAnswerPrompt(normalized) && asCheckbox(meaningful[i + 1] ?? '') === null) {
        ensure();
        current!.content.push({ id: makeId('c'), kind: 'field', field: newField('textarea', normalized) });
      } else {
        ensure();
        current!.content.push({ id: makeId('c'), kind: 'text', text: normalized });
      }
    }
  }

  push();
  if (sections.length === 0) sections.push(makeSection(1, 'Document'));
  return { title, author: '', sections };
}
