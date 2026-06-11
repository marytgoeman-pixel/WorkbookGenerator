export type FieldType = 'text' | 'textarea' | 'checkbox' | 'dropdown';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // for dropdown fields (e.g. ["1".."10"])
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
}

export type Spacing = 'compact' | 'normal' | 'relaxed';

// Optional cover page rendered as page 1 of the PDF
export interface CoverSettings {
  enabled: boolean;
  imageId?: string;                          // references a COVER_IMAGES id in lib/covers.ts
  subtitle?: string;                         // optional line shown under the title on the cover
  imageAlign?: 'left' | 'center' | 'right';  // horizontal focus when the photo is wider than the page
}

export interface DocumentModel {
  title: string;
  author: string;
  sections: Section[];
  titleCase?: TextCase;        // case transform for the document title
  bodySpacing?: Spacing;       // extra vertical space between paragraphs/lines
  cover?: CoverSettings;       // optional branded cover page
}

export type TemplateId = 'classic' | 'modern' | 'workbook' | 'jomangum';

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

export interface AppState {
  document: DocumentModel | null;
  templateId: TemplateId;
  colorTheme: ColorTheme;
}
