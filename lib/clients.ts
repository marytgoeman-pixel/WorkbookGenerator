import 'server-only';
import { ClientBranding } from '@/types/document';

// A client account: credentials (server-only) plus the branding sent to the browser.
export interface ClientAccount {
  username: string;
  passwordHash: string; // bcrypt hash
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
      logoUrl: '/clients/jo/logo.png',
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
    },
  },
];

export function findClientByUsername(username: string): ClientAccount | undefined {
  return CLIENTS.find((c) => c.username.toLowerCase() === username.toLowerCase().trim());
}

export function getBrandingById(id: string): ClientBranding | undefined {
  return CLIENTS.find((c) => c.branding.id === id)?.branding;
}
