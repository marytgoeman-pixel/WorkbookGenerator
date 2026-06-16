import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { DocumentModel, Section, ContentItem, FormField, FieldType, DocTable, TableCell } from '@/types/document';

let counter = 0;
function uid(prefix: string) {
  counter++;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

// Shape the model returns (flat, union-free so it maps cleanly to a JSON schema)
interface AiCell {
  text: string;          // static cell text (e.g. "#1"), or the field's label
  fieldType: '' | FieldType; // non-empty => the cell is a fillable field
  options: string[];     // dropdown options
}
interface AiItem {
  kind: 'text' | 'bullet' | 'field' | 'table';
  text: string;          // text/bullet content, or the field's label
  color: string;         // text/bullet color: '' (default), a hex like '#E04927', or a name
  fieldType: '' | FieldType; // only when kind === 'field'
  options: string[];     // only for dropdown fields
  tableHeaders: string[];          // only when kind === 'table'
  tableRows: { cells: AiCell[] }[]; // only when kind === 'table'
}

// Remove any stray HTML tags the model might emit inside text
function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
interface AiSection {
  title: string;
  level: 1 | 2;
  callout: boolean;
  items: AiItem[];
}
interface AiDoc {
  title: string;
  sections: AiSection[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          level: { type: 'integer', enum: [1, 2] },
          callout: { type: 'boolean' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: ['text', 'bullet', 'field', 'table'] },
                text: { type: 'string' },
                color: { type: 'string' },
                fieldType: { type: 'string', enum: ['', 'text', 'textarea', 'checkbox', 'dropdown'] },
                options: { type: 'array', items: { type: 'string' } },
                tableHeaders: { type: 'array', items: { type: 'string' } },
                tableRows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      cells: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            text: { type: 'string' },
                            fieldType: { type: 'string', enum: ['', 'text', 'textarea', 'checkbox', 'dropdown'] },
                            options: { type: 'array', items: { type: 'string' } },
                          },
                          required: ['text', 'fieldType', 'options'],
                        },
                      },
                    },
                    required: ['cells'],
                  },
                },
              },
              required: ['kind', 'text', 'color', 'fieldType', 'options', 'tableHeaders', 'tableRows'],
            },
          },
        },
        required: ['title', 'level', 'callout', 'items'],
      },
    },
  },
  required: ['title', 'sections'],
};

const SYSTEM = `You convert a real-estate coaching worksheet into a clean, structured interactive workbook.

You receive the worksheet as HTML (converted from a Word document). Produce JSON matching the schema.

Rules:
- The document "title" is the SHORT main title only (e.g. "Real Estate Relationship Building"). Do NOT append the subtitle/tagline to it — keep the title under ~8 words.
- Group content under section headings. Use level 1 for major sections, level 2 for sub-sections. Headings are NEVER bulleted — never prefix a heading with a bullet, dash, or number.
- If a major section has an introductory tagline/subtitle line, keep it as the first "text" item under that section (don't make it a heading).
- Set "callout": true for a section that is a short read-only insight, principle, or "big idea" the learner should absorb (no fillable fields) — it renders in a highlighted brand box. Set "callout": false for normal working sections that contain fields. Keep callouts short (1–4 lines).
- Each section has an ordered "items" array — KEEP DOCUMENT ORDER so prompts, their options, and their answer spaces stay together.
- Item kinds:
  - "text": a paragraph or instruction the learner reads. Put the sentence in "text"; fieldType "" and options [].
  - "bullet": a bullet list entry. Put the text in "text"; fieldType "" and options [].
  - "field": an interactive fillable element. Put the prompt/label in "text" and set fieldType:
      - "checkbox" for an option the learner ticks (e.g. a "□ Yes" line, multiple-choice options).
      - "textarea" for an open-ended written answer (e.g. after "Why?", "What did you notice?", reflections, or any prompt followed by blank writing space).
      - "text" for a short single-line answer (name, one value).
      - "dropdown" for a rating on a numeric scale; put the choices in "options" (e.g. ["1".."10"]).
    For non-table items leave tableHeaders [] and tableRows [].
  - "table": ANY tabular/grid layout — use this, never flatten a grid into stacked fields.
    Put column names in "tableHeaders". Each entry in "tableRows" is { "cells": [...] } with one cell per column, in order.
    Each cell has: "text" (static label like "#1", or "" if it's a blank input), "fieldType" ("" for a static text cell, or "dropdown"/"text"/"checkbox" for a fillable cell), and "options" (dropdown choices, else []).
    Example — "Contact | Presence (1-10) | Pressure (1-10)" with rows #1..#5 becomes ONE table item: headers ["Contact","Presence (1-10)","Pressure (1-10)"], and each row = { cells: [ {text:"#1",fieldType:"",options:[]}, {text:"",fieldType:"dropdown",options:["1".."10"]}, {text:"",fieldType:"dropdown",options:["1".."10"]} ] }.
    For table items leave the top-level text "", fieldType "", options [].
- Convert "□"/checkbox glyphs to checkbox fields. Convert numbered choice questions to a text prompt followed by their checkbox options.
- IMPORTANT: illustrative examples are read-only "text" items, NOT fields. Lines that show sample messages or comparisons (e.g. 'Pressure: "..."', 'Presence: "..."', anything in quotes given as an example to read) must be "text", never a textarea or input. Only create a field where the learner is explicitly asked to write, rate, or check something.
- Do not put a field between two example lines. Only add an answer box after a genuine question/prompt directed at the learner.
- If a section asks the learner to total or score their answers (e.g. "Your Score"), keep the scoring guidance as text, and add ONE short single-line "text" field labeled "Your Score:" so they can record the number.
- Do not invent content. Keep the learner's wording and original capitalization. Make it clean and well-grouped so the user only needs minor edits.
- EDITORIAL POLISH — avoid widows, orphans, and runts (these are typographic faults the layout tries to prevent, so help it):
  - A "widow" is a lone last line of a paragraph; an "orphan" is a heading or first line stranded by itself; a "runt" is a final line that is just one short word.
  - Write each "text" item as one or more COMPLETE sentences. Never leave a stray one- or two-word fragment as its own item.
  - Never create a heading that has no content beneath it — every heading must be immediately followed by its related text/fields.
  - Keep a prompt and its answer field adjacent and in order so they never get separated.
- COLORING TEXT: to color a text or bullet line, set its "color" to a hex like "#E04927" or a common name ("red", "green", "blue", "orange"). For everything else leave color "". NEVER put HTML tags (e.g. <span>) or markdown in "text" — text is plain words only.
- Output ONLY the JSON.`;

function toFieldType(t: string): FieldType {
  return t === 'textarea' || t === 'checkbox' || t === 'dropdown' || t === 'text' ? (t as FieldType) : 'text';
}

function mapToDocument(ai: AiDoc): DocumentModel {
  const sections: Section[] = (ai.sections || []).map((s): Section => {
    const content: ContentItem[] = (s.items || []).map((it): ContentItem => {
      if (it.kind === 'field') {
        const type = toFieldType(it.fieldType);
        const field: FormField = {
          id: uid('field'),
          label: it.text || '',
          type,
          required: false,
          ...(type === 'dropdown' && it.options?.length ? { options: it.options } : {}),
        };
        return { id: uid('c'), kind: 'field', field };
      }
      if (it.kind === 'table') {
        const headers = it.tableHeaders || [];
        const rows: TableCell[][] = (it.tableRows || []).map((r) =>
          (r.cells || []).map((c): TableCell => {
            const blank = !c.text || /^[_.\s]*$/.test(c.text);
            if (c.fieldType || blank) {
              const type = toFieldType(c.fieldType || 'text');
              return {
                text: '',
                field: {
                  id: uid('field'),
                  label: '',
                  type,
                  required: false,
                  ...(type === 'dropdown' && c.options?.length ? { options: c.options } : {}),
                },
              };
            }
            return { text: c.text };
          })
        );
        const table: DocTable = { id: uid('table'), headers, rows };
        return { id: uid('c'), kind: 'table', table };
      }
      const color = (it.color || '').trim();
      if (it.kind === 'bullet') return { id: uid('c'), kind: 'bullet', text: stripHtml(it.text), ...(color ? { color } : {}) };
      return { id: uid('c'), kind: 'text', text: stripHtml(it.text), ...(color ? { color } : {}) };
    });
    return { id: uid('section'), level: s.level === 2 ? 2 : 1, title: stripHtml(s.title) || 'Section', content, callout: !!s.callout };
  });

  if (sections.length === 0) sections.push({ id: uid('section'), level: 1, title: 'Document', content: [] });
  return { title: ai.title || 'Untitled Document', author: '', sections };
}

// Stream a structuring call and return the model's JSON text, retrying transient
// failures (rate limits, 5xx, dropped streams). The SDK doesn't auto-retry a stream
// that breaks mid-flight, so we retry the whole call — this is what makes a second
// upload reliable when the first happened to hit a busy moment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runStructuringStream(makeStream: () => any, label: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await makeStream().finalMessage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = (response.content as any[]).find((b) => b.type === 'text');
      if (!textBlock) throw new Error(`No ${label} returned`);
      return textBlock.text as string;
    } catch (e) {
      lastErr = e;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (e as any)?.status;
      // Retry only transient problems: network/stream drops (no status), timeouts,
      // rate limits, and server errors. Don't retry auth/bad-request (4xx).
      const retriable = status == null || status === 408 || status === 409 || status === 429 || status >= 500;
      if (!retriable || attempt === 3) break;
      await new Promise((r) => setTimeout(r, attempt * 1500)); // 1.5s then 3s backoff
    }
  }
  throw lastErr;
}

function parseAiJson(text: string): AiDoc {
  try {
    return JSON.parse(text) as AiDoc;
  } catch {
    // Truncated/!JSON output — usually a document too long/complex to fit the response.
    throw new Error('AI output was incomplete — the document may be too long or complex. Try trimming it.');
  }
}

export async function structureWithAI(html: string): Promise<DocumentModel> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  // Stream the request: it's a long (~30s) generation, and streaming keeps the
  // connection alive so serverless platforms don't drop it as idle.
  const text = await runStructuringStream(() => client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `Worksheet HTML:\n\n${html}` }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any), 'structured output');

  return mapToDocument(parseAiJson(text));
}

// Convert our DocumentModel back into the AI's flat shape, so the model can read
// the current workbook and revise it.
function docToAi(doc: DocumentModel): AiDoc {
  return {
    title: doc.title,
    sections: doc.sections.map((s) => ({
      title: s.title,
      level: s.level,
      callout: !!s.callout,
      items: s.content.map((it): AiItem => {
        if (it.kind === 'field') {
          return { kind: 'field', text: it.field.label, color: '', fieldType: it.field.type, options: it.field.options ?? [], tableHeaders: [], tableRows: [] };
        }
        if (it.kind === 'table') {
          return {
            kind: 'table', text: '', color: '', fieldType: '', options: [],
            tableHeaders: it.table.headers,
            tableRows: it.table.rows.map((r) => ({
              cells: r.map((c) => c.field
                ? { text: '', fieldType: c.field.type, options: c.field.options ?? [] }
                : { text: c.text ?? '', fieldType: '' as const, options: [] }),
            })),
          };
        }
        if (it.kind === 'lines') {
          // The AI flat schema has no "lines" kind; represent it as an empty text block.
          return { kind: 'text', text: '', color: '', fieldType: '', options: [], tableHeaders: [], tableRows: [] };
        }
        return { kind: it.kind, text: stripHtml(it.text), color: it.color ?? '', fieldType: '', options: [], tableHeaders: [], tableRows: [] };
      }),
    })),
  };
}

const REFINE_SYSTEM = `You are editing an EXISTING fillable workbook (given as JSON in the same schema you output).
Apply the user's instruction and return the COMPLETE revised workbook as JSON matching the schema.

Rules:
- Keep everything the user did not ask to change. Preserve wording, order, fields, and tables unless the instruction implies changing them.
- You can add, remove, reorder, or restyle sections and items, and add fillable fields, checkboxes, dropdowns, or tables.
- Headings are never bulleted. Illustrative examples stay as read-only text. Only add fields where the learner is asked to write, rate, or check.
- EDIT IN PLACE — do NOT duplicate. When asked to split, shorten, or move text onto its own line, modify the EXISTING item's text; never copy the same text into new items. (If the user wants a hard line break inside one heading or paragraph, put a literal newline "\\n" inside that item's text rather than creating a duplicate item.)
- EDITORIAL POLISH: avoid widows/orphans/runts — write complete sentences (no stray one- or two-word lines), never leave a heading with no content under it, and keep each prompt next to its answer field.
- For grid/calendar-style requests, use a "table" item: e.g. a monthly calendar = a table whose headers are the weekdays and whose cells are fillable "text" fields (or static day numbers). A tracker = a table with the right columns and fillable cells.
- COLORING TEXT: to color a line, set its "color" to a hex ("#E04927") or a name ("red","green","blue","orange"); leave "" otherwise. NEVER put HTML tags or markdown in "text". Preserve the original capitalization — do not uppercase words just to color them.
- Output ONLY the JSON for the full workbook.`;

export async function refineWithAI(doc: DocumentModel, instruction: string): Promise<DocumentModel> {
  const client = new Anthropic();
  const current = JSON.stringify(docToAi(doc));

  const text = await runStructuringStream(() => client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: REFINE_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `Current workbook JSON:\n\n${current}\n\nInstruction:\n${instruction}` }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any), 'revised output');

  return mapToDocument(parseAiJson(text));
}
