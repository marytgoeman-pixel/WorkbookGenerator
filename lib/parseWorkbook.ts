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
