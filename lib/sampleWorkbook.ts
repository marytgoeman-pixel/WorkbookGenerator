import { DocumentModel, DocTable, TableCell } from '@/types/document';
import { coverImagesFor } from './covers';

// A 4-week planning calendar: day-of-week headers + 28 dated cells, each with a
// fillable note area so people can type right inside a day.
function planningCalendar(): DocTable {
  const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const rows: TableCell[][] = [];
  let day = 1;
  for (let w = 0; w < 4; w++) {
    const row: TableCell[] = [];
    for (let d = 0; d < 7; d++) {
      const n = day++;
      row.push({ text: String(n), field: { id: `cal-${n}`, label: '', type: 'textarea', required: false } });
    }
    rows.push(row);
  }
  return { id: 'practice-calendar', headers, rows };
}

// A ready-to-show interactive sample. Loaded for the signed-in brand so the cover,
// colors, and chrome all match that client. Every box below is fillable in the PDF.
export function buildSampleWorkbook(brandId?: string): DocumentModel {
  const coverImg = coverImagesFor(brandId)[0]?.id;
  return {
    title: 'Designing Learning That Sticks',
    author: '',
    titleCase: 'upper',
    cover: { enabled: true, imageId: coverImg, subtitle: 'A Hands-On Sample Workbook' },
    sections: [
      {
        id: 'welcome', level: 1, title: 'Welcome', headingStyle: 'accent',
        content: [
          { id: 'w1', kind: 'text', text: 'This short workbook is a working sample — every box below is fillable, so go ahead and type, check, and plan right inside the PDF. Use it to feel how an interactive workbook works for your own learners.' },
          { id: 'w2', kind: 'bullet', text: 'Answer the prompts in your own words.' },
          { id: 'w3', kind: 'bullet', text: 'Tick the boxes as you go.' },
          { id: 'w4', kind: 'bullet', text: 'Map your month right on the calendar.' },
          { id: 'w5', kind: 'field', field: { id: 'goal', label: 'What do you most want to walk away with?', type: 'textarea', required: false } },
        ],
      },
      {
        id: 'selfcheck', level: 1, title: 'Quick Self-Check', headingStyle: 'accent',
        content: [
          { id: 's0', kind: 'text', text: 'Check everything that is already true for the project you have in mind:' },
          { id: 's1', kind: 'field', field: { id: 'c-audience', label: 'I know exactly who my learner is.', type: 'checkbox', required: false } },
          { id: 's2', kind: 'field', field: { id: 'c-outcome', label: 'I can name the outcome they need.', type: 'checkbox', required: false } },
          { id: 's3', kind: 'field', field: { id: 'c-practice', label: 'I have planned a way for them to practice.', type: 'checkbox', required: false } },
          { id: 's4', kind: 'field', field: { id: 'c-feedback', label: 'I know how they will get feedback.', type: 'checkbox', required: false } },
          { id: 's5', kind: 'field', field: { id: 'confidence', label: 'How confident do you feel today? (1 = brand new, 10 = ready to teach it)', type: 'dropdown', required: false, options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] } },
        ],
      },
      {
        id: 'design', level: 1, title: 'Design Questions', headingStyle: 'accent',
        content: [
          { id: 'd1', kind: 'field', field: { id: 'learner', label: 'Who is your primary learner?', type: 'text', required: false } },
          { id: 'd2', kind: 'field', field: { id: 'cando', label: 'What should they be able to DO when they finish?', type: 'textarea', required: false } },
          { id: 'd3', kind: 'field', field: { id: 'activity', label: 'What is one activity that would let them practice that?', type: 'textarea', required: false } },
        ],
      },
      {
        id: 'plan', level: 1, title: 'Plan Your Month', headingStyle: 'accent', pageBreakBefore: true,
        content: [
          { id: 'p1', kind: 'text', text: 'Sketch out when you will build, test, and deliver each piece. Type your notes right inside any day.' },
          { id: 'p2', kind: 'table', table: planningCalendar() },
        ],
      },
      {
        id: 'principle', level: 1, title: 'Remember', headingStyle: 'accent', callout: true,
        content: [
          { id: 'k1', kind: 'text', text: 'People learn by doing, not by listening. Design for practice, feedback, and reflection — in that order — and the learning will stick.' },
        ],
      },
    ],
  };
}
