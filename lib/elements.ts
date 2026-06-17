import { Section, DocTable, TableCell, ContentItem } from '@/types/document';

// Short unique id for inserted sections/items/fields.
const rid = () => Math.random().toString(36).slice(2, 9);
const sid = (p: string) => `el-${p}-${rid()}`;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A full-page month calendar for the given year/month (month is 0-based).
// workWeek = true gives a Mon–Fri (5-column) calendar; otherwise a full Sun–Sat week.
// Cells carry the date number + a fillable note area; blank days stay empty.
export function calendarElement(year: number, month: number, workWeek = false): Section[] {
  const dim = new Date(year, month + 1, 0).getDate();
  const headers = workWeek ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : DAY_HEADERS;
  const cols = headers.length;
  const weekStartDow = workWeek ? 1 : 0;                   // Monday vs Sunday
  const colOf = (dow: number) => (workWeek ? dow - 1 : dow);
  const toCell = (c: number | null): TableCell =>
    c == null ? { text: '' } : { text: String(c), field: { id: `d${c}`, label: '', type: 'textarea', required: false } };

  const rows: TableCell[][] = [];
  let week: (number | null)[] = new Array(cols).fill(null);
  let anyInWeek = false;
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(year, month, d).getDay();         // 0=Sun .. 6=Sat
    if (workWeek && (dow === 0 || dow === 6)) continue;     // skip weekends
    if (dow === weekStartDow && anyInWeek) {
      rows.push(week.map(toCell));
      week = new Array(cols).fill(null);
      anyInWeek = false;
    }
    week[colOf(dow)] = d;
    anyInWeek = true;
  }
  if (anyInWeek) rows.push(week.map(toCell));

  const table: DocTable = { id: sid('cal'), headers, rows, fullPage: true, labelSize: 9 };
  return [{
    id: sid('calendar'), level: 1, title: `${MONTHS[month]} ${year}`, headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'table', table }],
  }];
}

// A full page of ruled lines people can type on (text wraps onto the lines).
export function notesElement(title = 'Notes'): Section[] {
  return [{
    id: sid('notes'), level: 1, title, headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'lines' } as ContentItem],
  }];
}

// 90-day action plan: three phases × goals/actions/success, filling the page.
export function ninetyDayElement(): Section[] {
  const phases = ['First 30 Days', 'Days 31–60', 'Days 61–90'];
  const rows: TableCell[][] = phases.map((p, i) => ([
    { text: p },
    { field: { id: `goals${i}`, label: '', type: 'textarea', required: false } },
    { field: { id: `actions${i}`, label: '', type: 'textarea', required: false } },
    { field: { id: `success${i}`, label: '', type: 'textarea', required: false } },
  ]));
  const table: DocTable = {
    id: sid('ninety'), headers: ['Phase', 'Goals & Focus', 'Key Actions', 'What Success Looks Like'],
    rows, fullPage: true,
  };
  return [{
    id: sid('ninetyday'), level: 1, title: '90-Day Action Plan', headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'table', table }],
  }];
}

// SWOT: a 2×2 grid of labelled, fillable quadrants filling the page.
export function swotElement(): Section[] {
  const cell = (label: string, id: string): TableCell => ({ text: label, field: { id, label: '', type: 'textarea', required: false } });
  const table: DocTable = {
    id: sid('swot'), headers: [], labelSize: 12, fullPage: true,
    rows: [
      [cell('STRENGTHS', 'strengths'), cell('WEAKNESSES', 'weaknesses')],
      [cell('OPPORTUNITIES', 'opportunities'), cell('THREATS', 'threats')],
    ],
  };
  return [{
    id: sid('swotsec'), level: 1, title: 'SWOT Analysis', headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'table', table }],
  }];
}

// Stop / Start / Continue: three tall columns to fill in, filling the page.
export function stopStartContinueElement(): Section[] {
  const table: DocTable = {
    id: sid('ssc'), headers: ['STOP', 'START', 'CONTINUE'], fullPage: true,
    rows: [[
      { field: { id: 'stop', label: '', type: 'textarea', required: false } },
      { field: { id: 'start', label: '', type: 'textarea', required: false } },
      { field: { id: 'continue', label: '', type: 'textarea', required: false } },
    ]],
  };
  return [{
    id: sid('sscsec'), level: 1, title: 'Stop · Start · Continue', headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'table', table }],
  }];
}

// Case-study page: structured prompts with write-in boxes.
export function caseStudyElement(): Section[] {
  const field = (label: string, id: string, big = true): ContentItem => ({
    id: rid(), kind: 'field', field: { id, label, type: big ? 'textarea' : 'text', required: false, heightScale: big ? 1.5 : 1 },
  });
  return [{
    id: sid('casestudy'), level: 1, title: 'Case Study', headingStyle: 'accent', pageBreakBefore: true,
    content: [
      { id: rid(), kind: 'text', text: 'Capture a real example you can learn from and share.' },
      field('Client / context', 'context', false),
      field('The challenge', 'challenge'),
      field('Our approach', 'approach'),
      field('The result', 'result'),
      field('Lessons learned', 'lessons'),
    ],
  }];
}

// A short highlighted "big idea" / takeaway — renders as a brand callout panel.
export function tipBoxElement(): Section[] {
  return [{
    id: sid('tip'), level: 1, title: 'Key Takeaway', headingStyle: 'accent', callout: true,
    content: [{ id: rid(), kind: 'text', text: 'Add the one idea you want readers to remember from this section.' }],
  }];
}

// A checklist of action items the reader ticks off.
export function checklistElement(): Section[] {
  const item = (label: string): ContentItem => ({ id: rid(), kind: 'field', field: { id: rid(), label, type: 'checkbox', required: false } });
  return [{
    id: sid('checklist'), level: 1, title: 'Checklist', headingStyle: 'accent',
    content: [
      { id: rid(), kind: 'text', text: 'Tick each item as you complete it.' },
      item('First action item'), item('Second action item'), item('Third action item'), item('Fourth action item'),
    ],
  }];
}

// Pros & Cons: a two-column fillable table that fills the page.
export function prosConsElement(): Section[] {
  const cell = (id: string): TableCell => ({ field: { id, label: '', type: 'textarea', required: false } });
  const table: DocTable = {
    id: sid('proscons'), headers: ['Pros', 'Cons'], fullPage: true,
    rows: [[cell('pros'), cell('cons')]],
  };
  return [{
    id: sid('prosconssec'), level: 1, title: 'Pros & Cons', headingStyle: 'accent', pageBreakBefore: true,
    content: [{ id: rid(), kind: 'table', table }],
  }];
}

export interface ElementDef {
  key: string;
  label: string;
  icon: string;
  make: (opts?: { year: number; month: number }) => Section[];
}

// The palette shown in the editor. Calendar takes a year/month from the picker.
export const ELEMENTS: ElementDef[] = [
  { key: 'calendar', label: 'Calendar', icon: '📅', make: (o) => calendarElement(o!.year, o!.month) },
  { key: 'notes', label: 'Notes page', icon: '📝', make: () => notesElement() },
  { key: 'ninety', label: '90-day plan', icon: '🎯', make: () => ninetyDayElement() },
  { key: 'swot', label: 'SWOT grid', icon: '🔲', make: () => swotElement() },
  { key: 'ssc', label: 'Stop / Start / Continue', icon: '🔁', make: () => stopStartContinueElement() },
  { key: 'casestudy', label: 'Case study', icon: '📁', make: () => caseStudyElement() },
  { key: 'tip', label: 'Tip / takeaway', icon: '💡', make: () => tipBoxElement() },
  { key: 'checklist', label: 'Checklist', icon: '☑️', make: () => checklistElement() },
  { key: 'proscons', label: 'Pros & Cons', icon: '⚖️', make: () => prosConsElement() },
];
