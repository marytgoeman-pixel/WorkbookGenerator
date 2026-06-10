export type FieldType = 'text' | 'textarea' | 'checkbox';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
}

export type HeadingStyle = 'accent' | 'brand' | 'plain';
export type TextCase = 'none' | 'upper' | 'sentence' | 'title';

export interface Section {
  id: string;
  level: 1 | 2;
  title: string;
  bodyLines: string[];
  bullets: string[];
  fields: FormField[];
  headingStyle?: HeadingStyle; // how the section heading is drawn (default 'accent')
  headingCase?: TextCase;      // case transform for the heading (default 'none')
  callout?: boolean;           // render the body text inside a stylized brand box
}

export interface DocumentModel {
  title: string;
  author: string;
  sections: Section[];
  titleCase?: TextCase;        // case transform for the document title
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
