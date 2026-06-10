import { DocumentModel, Section, FormField, FieldType } from '@/types/document';

let sectionCounter = 0;
let fieldCounter = 0;

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseField(line: string): FormField | null {
  const textMatch = line.match(/^\[field\]\s*(.*)/i);
  const textareaMatch = line.match(/^\[textarea\]\s*(.*)/i);
  const checkboxMatch = line.match(/^\[checkbox\]\s*(.*)/i);

  let type: FieldType | null = null;
  let label = '';

  if (textMatch) { type = 'text'; label = textMatch[1].trim(); }
  else if (textareaMatch) { type = 'textarea'; label = textareaMatch[1].trim(); }
  else if (checkboxMatch) { type = 'checkbox'; label = checkboxMatch[1].trim(); }

  if (!type) return null;

  fieldCounter++;
  return {
    id: makeId('field'),
    label: label || `Field ${fieldCounter}`,
    type,
    required: false,
  };
}

// Detect a Word-style checkbox glyph prefix and strip it
function asCheckbox(text: string): string | null {
  const m = text.match(/^\s*[□☐■☑✓✔□☐☑☒]\s*(.*)$/);
  return m ? m[1].trim() : null;
}

// An open-ended prompt that should become a write-in answer box
// (e.g. "Why?", "What makes you say that?", "Which statement feels most true?")
function isAnswerPrompt(text: string): boolean {
  return /\?\s*$/.test(text) && /^(why|how|what|which|explain|describe|list|share|your|tell)\b/i.test(text);
}

// Treat a manually-bolded paragraph as a heading only when it looks like one:
// fully bold, short, and not ending like a sentence or question. This avoids
// turning emphasized body lines ("Why?", "Pressure comes from agenda.") into headings.
function isBoldHeading(el: Element): boolean {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const bold = el.querySelectorAll('strong, b');
  if (bold.length === 0) return false;
  const boldText = Array.from(bold).map((b) => b.textContent || '').join('').trim();
  const fullyBold = boldText.length >= text.length - 2;
  if (!fullyBold) return false;

  const wordCount = text.split(' ').length;
  const endsLikeSentence = /[.?!,;]$/.test(text);
  return text.length <= 60 && wordCount <= 8 && !endsLikeSentence;
}

/**
 * Parse the HTML that mammoth produces from a Word document. Unlike raw-text
 * extraction, this preserves heading levels, lists, and bold "headings".
 */
export function parseWorkbookHtml(html: string): DocumentModel {
  sectionCounter = 0;
  fieldCounter = 0;

  const docEl = new DOMParser().parseFromString(html, 'text/html');
  const blocks = Array.from(docEl.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li'));

  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let title = 'Untitled Document';
  let titleSet = false;

  function pushSection() {
    if (currentSection) sections.push(currentSection);
  }
  function newSection(level: 1 | 2, sectionTitle: string): Section {
    sectionCounter++;
    return { id: makeId('section'), level, title: sectionTitle, bodyLines: [], bullets: [], fields: [] };
  }
  function ensureSection() {
    if (!currentSection) currentSection = newSection(1, 'Document');
  }
  function addCheckbox(label: string) {
    ensureSection();
    fieldCounter++;
    currentSection!.fields.push({
      id: makeId('field'),
      label: label || `Field ${fieldCounter}`,
      type: 'checkbox',
      required: false,
    });
  }

  function addTextarea(label: string) {
    ensureSection();
    fieldCounter++;
    currentSection!.fields.push({
      id: makeId('field'),
      label: label || `Field ${fieldCounter}`,
      type: 'textarea',
      required: false,
    });
  }

  // Text of the next meaningful block (skips empties and <p> inside <li>)
  function nextText(from: number): string {
    for (let j = from + 1; j < blocks.length; j++) {
      const e = blocks[j];
      if (e.tagName === 'P' && e.closest('li')) continue;
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    return '';
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const el = blocks[bi];
    // Skip <p> that live inside <li> (handled by the li itself)
    if (el.tagName === 'P' && el.closest('li')) continue;

    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const isHeading = /^h[1-6]$/.test(tag) || (tag === 'p' && isBoldHeading(el));

    if (isHeading) {
      const level: 1 | 2 = tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' ? 2 : 1;
      if (!titleSet) {
        title = text;
        titleSet = true;
      }
      pushSection();
      currentSection = newSection(level, text);
      continue;
    }

    // List item or paragraph
    const cb = asCheckbox(text);
    if (cb !== null) {
      addCheckbox(cb);
      continue;
    }

    // Explicit [field]/[textarea]/[checkbox] markers still work
    const field = parseField(text);
    if (field) {
      ensureSection();
      currentSection!.fields.push(field);
      continue;
    }

    // Auto: an open-ended prompt NOT followed by a checkbox becomes a write-in box
    if (isAnswerPrompt(text) && asCheckbox(nextText(bi)) === null) {
      addTextarea(text);
      continue;
    }

    ensureSection();
    if (tag === 'li') {
      currentSection!.bullets.push(text);
    } else {
      currentSection!.bodyLines.push(text);
    }
  }

  pushSection();
  if (sections.length === 0) sections.push(newSection(1, 'Document'));

  return { title, author: '', sections };
}

export function parseWorkbook(rawText: string): DocumentModel {
  sectionCounter = 0;
  fieldCounter = 0;

  // Normalize line endings
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let title = 'Untitled Document';
  let titleSet = false;

  function pushSection() {
    if (currentSection) sections.push(currentSection);
  }

  function newSection(level: 1 | 2, sectionTitle: string): Section {
    sectionCounter++;
    return {
      id: makeId('section'),
      level,
      title: sectionTitle,
      bodyLines: [],
      bullets: [],
      fields: [],
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue; // skip blank lines

    // Normalize Word-style checkbox symbols to [checkbox] markers
    const normalized = trimmed
      .replace(/^[□☐]\s*/, '[checkbox] ')
      .replace(/^[■☑✓✔]\s*/, '[checkbox] ');

    if (normalized.startsWith('## ')) {
      pushSection();
      currentSection = newSection(2, normalized.slice(3).trim());
    } else if (normalized.startsWith('# ')) {
      const heading = normalized.slice(2).trim();
      if (!titleSet) {
        title = heading;
        titleSet = true;
        pushSection();
        currentSection = newSection(1, heading);
      } else {
        pushSection();
        currentSection = newSection(1, heading);
      }
    } else if (normalized.startsWith('- ')) {
      if (!currentSection) { currentSection = newSection(1, 'Document'); }
      currentSection.bullets.push(normalized.slice(2).trim());
    } else {
      const field = parseField(normalized);
      if (field) {
        if (!currentSection) { currentSection = newSection(1, 'Document'); }
        currentSection.fields.push(field);
      } else {
        if (!currentSection) { currentSection = newSection(1, 'Document'); }
        currentSection.bodyLines.push(normalized);
      }
    }
  }

  pushSection();

  if (sections.length === 0) {
    sections.push(newSection(1, 'Document'));
  }

  return { title, author: '', sections };
}
