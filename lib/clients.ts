import 'server-only';
import { ClientBranding } from '@/types/document';

// A client account: credentials (server-only) plus the branding sent to the browser.
export interface ClientAccount {
  username: string;
  passwordHash: string; // bcrypt hash
  isAdmin?: boolean;    // admin sees the analytics dashboard, not a workbook workspace
  branding: ClientBranding;
}

// First client: Jo Mangum.
// Default password: JoMangum2025!  (change by replacing the hash — see README note)
export const CLIENTS: ClientAccount[] = [
  {
    username: 'jo',
    passwordHash: '$2b$10$rKa0hG7CCB2adBEqUM8eOuKv4Usz9/dkZ.dqfl7mZpy2.XwKv8GAq',
    branding: {
      id: 'jomangum',
      displayName: 'Jo',
      templateId: 'jomangum',
      tagline: 'Clear · Candid · Sustainable Growth for Real Estate Professionals',
      logoUrl: '/clients/jo/logonew.png',
      social: [
        { type: 'website', url: 'https://jomangum.com/' },
        { type: 'linkedin', url: 'https://www.linkedin.com/in/jomangum/' },
        { type: 'youtube', url: 'https://www.youtube.com/@JoMangum' },
      ],
      colors: {
        header: '#1B5E7C',     // brand primary (teal blue)
        title: '#E04927',      // brand secondary (orange-red)
        subtitle: '#1B5E7C',   // brand primary
        accent: '#F8BC24',     // brand secondary (gold)
        calloutBg: '#1B5E7C',
        calloutBorder: '#F8BC24',
        grayBox: '#F0F0F0',
      },
      // On the 7-day free trial — starts on next login (ensureTrialStart).
      plan: { name: 'Trial', downloadsPerMonth: 1, trial: true },
    },
  },
  {
    // Second client: Sell It (The Growth Accelerator).
    // Default password: SellIt2025!  (change by replacing the hash)
    username: 'sellit',
    passwordHash: '$2b$10$QUFb/mc9aIABisNpFYgMHu95RHGn7/0zdjNvB7E5aVNNhFPwUVTaa',
    branding: {
      id: 'sellit',
      displayName: 'Sell It',
      templateId: 'sellit',
      tagline: 'THE GROWTH ACCELERATOR',
      logoUrl: '/clients/sellit/sellitlogocolor.png',
      social: [],
      colors: {
        header: '#3F69FF',     // Sell It Blue — cover title, table headers, callout band
        title: '#0A263A',      // Ink — big interior page titles
        subtitle: '#3F69FF',   // Sell It Blue — section labels / prompts
        accent: '#3F69FF',     // Sell It Blue — bullets, field borders
        calloutBg: '#3F69FF',
        calloutBorder: '#3F69FF',
        grayBox: '#E6EBFF',    // light periwinkle — fillable field background
      },
      // TEMP: comp/unlimited for now (also in COMP_ACCOUNTS) — no cap, no watermark, no trial.
      // To revert: plan: { name: 'Trial', downloadsPerMonth: 1, trial: true } and drop from COMP_ACCOUNTS.
      plan: { name: 'Enterprise', downloadsPerMonth: null },
    },
  },
  {
    // Demo account: The Learning Creative (your own brand — for showing prospects).
    // Default password: LearningCreative2025!  (change by replacing the hash)
    username: 'tlc',
    passwordHash: '$2b$10$4W5ovBK8tH2U6YEE9pguy.687xgCkCNV3FiLU.t4q.7DP01bAY1f.',
    branding: {
      id: 'thelearningcreative',
      displayName: 'The Learning Creative',
      templateId: 'tlc',
      tagline: 'Custom Learning Experiences',
      logoUrl: '/clients/tlc/logo.png',
      social: [{ type: 'website', url: 'https://thelearningcreative.com' }],
      colors: {
        header: '#163446',     // brand navy — top bar, cover band, H1 titles
        title: '#163446',      // brand navy — main page titles
        subtitle: '#009346',   // dark green — section labels / byline (readable on white)
        accent: '#009346',     // dark green — bullets, field borders (crisp on white)
        calloutBg: '#163446',
        calloutBorder: '#8DC63D', // light green — pops on the navy callout box
        grayBox: '#F0F7E6',    // pale lime tint for fillable-field backgrounds
      },
      // Internal/comp account — full access (see COMP_ACCOUNTS in app/page.tsx).
      plan: { name: 'Enterprise', downloadsPerMonth: null },
    },
  },
  {
    // Trial demo: a fresh client on the 7-day free trial. Mark any real onboarded
    // client the same way (plan.trial = true) and their trial starts on first login.
    // Default password: TrialDemo2025!  (change by replacing the hash)
    username: 'trial',
    passwordHash: '$2b$10$PXP9jU8DwuKksckEYzuPoO2a5fBS6S1a0BHinhn/AmndH3novvxTi',
    branding: {
      id: 'trialdemo',
      displayName: 'Trial Account',
      templateId: 'tlc',
      tagline: 'Custom Learning Experiences',
      logoUrl: '/clients/tlc/logo.png',
      social: [{ type: 'website', url: 'https://thelearningcreative.com' }],
      colors: {
        header: '#163446', title: '#163446', subtitle: '#009346', accent: '#009346',
        calloutBg: '#163446', calloutBorder: '#8DC63D', grayBox: '#F0F7E6',
      },
      // Internal/comp account — full access (see COMP_ACCOUNTS in app/page.tsx).
      plan: { name: 'Enterprise', downloadsPerMonth: null },
    },
  },
  {
    // Voyageur University (John Arms) — fractional-leadership education.
    // Default password: Voyageur2026!  (change by replacing the hash)
    // Comp/unlimited account (see COMP_ACCOUNTS in app/page.tsx): no download cap, no watermark.
    username: 'voyageur',
    passwordHash: '$2b$10$kaMkdz62rXRvz.RvFNumxuLqJY2hFzFnfEHIaAoMIAbDK6i9nfnwS',
    branding: {
      id: 'voyageur',
      displayName: 'Voyageur University',
      templateId: 'tlc',
      tagline: 'You’re not stuck. The model is.',
      // Wide logo — keep the tagline out of the interior chrome entirely (it still shows on the
      // cover). The cover uses a slate base with the full-color logo (logocover.png).
      taglinePosition: 'none',
      coverColor: '#1E1E1E',
      logoUrl: '/clients/voyageur/logo.png',
      social: [
        { type: 'website', url: 'https://voyageur-university.com/' },
        { type: 'linkedin', url: 'https://www.linkedin.com/in/johnarms/' },
        { type: 'youtube', url: 'https://www.youtube.com/@voyageuru9914' },
      ],
      colors: {
        header: '#015424',      // brand green — top bar, cover band, H1 titles
        title: '#015424',       // brand green — main page titles
        subtitle: '#015424',    // brand green — section labels (crisp on white)
        accent: '#E19703',      // brand gold — bullets, field borders, accents
        calloutBg: '#015424',   // green callout box
        calloutBorder: '#E19703', // gold border pops on the green callout
        grayBox: '#EAF3EC',     // pale green tint for fillable-field backgrounds
      },
      // Comp account — full access, unlimited downloads, no watermark.
      plan: { name: 'Enterprise', downloadsPerMonth: null },
    },
  },
  {
    // Admin account — sees the analytics dashboard, not a workbook workspace.
    // Password is stored only as a bcrypt hash (changed 2026-06). To change it, generate
    // a new hash: node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD',10))"
    username: 'admin',
    passwordHash: '$2b$10$26r53luIhRHUCgGLFAr9WeMj.k.HrHTOYqUtNVxXoSN1.b41bl6WC',
    isAdmin: true,
    branding: {
      id: 'admin', displayName: 'Admin', templateId: 'classic', tagline: '', logoUrl: '', social: [],
      colors: { header: '#1B5E7C', title: '#E04927', subtitle: '#1B5E7C', accent: '#F8BC24', calloutBg: '#1B5E7C', calloutBorder: '#F8BC24', grayBox: '#F0F0F0' },
    },
  },
];

export function findClientByUsername(username: string): ClientAccount | undefined {
  return CLIENTS.find((c) => c.username.toLowerCase() === username.toLowerCase().trim());
}

export function getBrandingById(id: string): ClientBranding | undefined {
  return CLIENTS.find((c) => c.branding.id === id)?.branding;
}

// Non-admin client ids, used by the analytics dashboard
export function clientIds(): string[] {
  return CLIENTS.filter((c) => !c.isAdmin).map((c) => c.branding.id);
}

export function displayNameForId(id: string): string {
  return CLIENTS.find((c) => c.branding.id === id)?.branding.displayName ?? id;
}
