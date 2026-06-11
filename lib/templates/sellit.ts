export const sellitTemplate = {
  id: 'sellit' as const,
  name: 'Sell It',
  description: 'Branded template: Aeonik headings, Inter body, Sell It blue, eyebrow + logo header.',
  pageWidth: 612,
  pageHeight: 792,
  // Top margin clears the eyebrow + logo header row; bottom clears the page-number footer
  marginTop: 88,
  marginBottom: 58,
  marginLeft: 56,
  marginRight: 56,
  titleSize: 24,
  headingSize: 21,      // big interior page titles (ink, Aeonik)
  subheadingSize: 12,   // blue uppercase section labels
  bodySize: 12,
  lineHeight: 16,
  sectionSpacing: 16,
  paragraphSpacing: 6,
  fieldHeight: 24,
  textareaHeight: 52,
  bulletIndent: 8,
  headerBarHeight: 0,
  twoColumn: false,
  notesColumnWidth: 0,
  // Branded chrome (no top bar; slim footer)
  topBarHeight: 0,
  footerHeight: 40,
};
