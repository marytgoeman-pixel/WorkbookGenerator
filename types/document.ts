export type FieldType = 'text' | 'textarea' | 'checkbox' | 'dropdown';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];    // for dropdown fields (e.g. ["1".."10"])
  heightScale?: number;  // per-box height multiplier (default 1) for text/textarea answer boxes
}

// A cell is either static text or a fillable field
export interface TableCell {
  text: string;
  field?: FormField;
}

export interface DocTable {
  id: string;
  headers: string[];
  rows: TableCell[][];
}

export type HeadingStyle = 'accent' | 'brand' | 'plain' | 'title';
export type TextCase = 'none' | 'upper' | 'sentence' | 'title';

// A section's content is an ordered list so document order is preserved
// (e.g. prompt → checkboxes → answer box → next prompt …)
export type ContentItem =
  | { id: string; kind: 'text'; text: string; color?: string }   // color: hex (#E04927) or name
  | { id: string; kind: 'bullet'; text: string; color?: string }
  | { id: string; kind: 'field'; field: FormField }
  | { id: string; kind: 'table'; table: DocTable };

export interface Section {
  id: string;
  level: 1 | 2;
  title: string;
  content: ContentItem[];      // ordered content (text, bullets, fields, tables)
  headingStyle?: HeadingStyle; // how the section heading is drawn (default 'accent')
  headingCase?: TextCase;      // case transform for the heading (default 'none')
  callout?: boolean;           // render the body text inside a stylized brand box
  pageBreakBefore?: boolean;   // force this section to start on a new page
  spacing?: number;            // per-section spacing multiplier (default 1) for gaps between blocks
  lineSpacing?: number;        // per-section line-height multiplier (default 1) to tighten/loosen lines
  fieldScale?: number;         // per-section input-box height multiplier (default 1) — bigger/smaller answer boxes
}

export type Spacing = 'compact' | 'normal' | 'relaxed';

// Optional cover page rendered as page 1 of the PDF
export interface CoverSettings {
  enabled: boolean;
  imageId?: string;                          // references a COVER_IMAGES id in lib/covers.ts
  subtitle?: string;                         // session line (blue) — e.g. "Session 1 - June 11, 1PM ET"
  imageAlign?: 'left' | 'center' | 'right';   // horizontal focus when the photo is wider than the page
  imageAlignV?: 'top' | 'center' | 'bottom';  // vertical focus when the photo is taller than the page
  imageZoom?: number;                          // scale multiplier on the cover-fit image (1 = fill; <1 zooms out, >1 zooms in)
  header?: string;                           // Sell It top header / eyebrow text (default = brand tagline)
  workbookLabel?: string;                    // Sell It: word shown inline after the title (default "Workbook")
  descriptor?: string;                       // Sell It: gray descriptor line under the session line
}

export interface DocumentModel {
  title: string;
  author: string;
  sections: Section[];
  titleCase?: TextCase;        // case transform for the document title
  bodySpacing?: Spacing;       // extra vertical space between paragraphs/lines
  cover?: CoverSettings;       // optional branded cover page
  aboutPage?: boolean;         // append an "About Jo" page at the end (Jo only)
  legalPage?: boolean;         // append a legal/disclaimer page at the end (Jo only)
}

export type TemplateId = 'classic' | 'modern' | 'workbook' | 'jomangum' | 'sellit' | 'tlc';

export interface SocialLink {
  type: 'website' | 'linkedin' | 'youtube' | 'instagram' | 'facebook';
  url: string;
}

// Branding a client brings to their template (safe to expose to the browser)
export interface ClientBranding {
  id: string;
  displayName: string;        // shown as "Welcome {displayName}"
  templateId: TemplateId;
  tagline: string;            // footer center text
  logoUrl: string;            // path under /public, e.g. "/clients/jo/logo.png"
  social: SocialLink[];       // footer social icons (clickable in PDF)
  colors: {
    header: string;           // top bar color
    title: string;            // main title color
    subtitle: string;         // sub-heading color
    accent: string;           // bullets / dashed borders
    calloutBg: string;        // filled callout box
    calloutBorder: string;    // dashed border on callout
    grayBox: string;          // light gray answer box
  };
}

export interface ColorTheme {
  primary: string;
  secondary: string;
  background: string;
}

// Where a section's heading was drawn — lets the preview map a click back to the editor.
// page: 0-based page index; topFrac: 0 (page top) .. 1 (page bottom).
export interface SectionAnchor {
  sectionId: string;
  page: number;
  topFrac: number;
}

export interface AppState {
  document: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
}
