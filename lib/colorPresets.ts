import { ColorTheme } from '@/types/document';

export interface ColorPreset {
  name: string;
  theme: ColorTheme;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'Navy & Gold',
    theme: { primary: '#1A3A5C', secondary: '#C9A84C', background: '#FFFFFF' },
  },
  {
    name: 'Forest Green',
    theme: { primary: '#2D6A4F', secondary: '#74C69D', background: '#FFFFFF' },
  },
  {
    name: 'Slate & Coral',
    theme: { primary: '#4A5568', secondary: '#E07A5F', background: '#FAFAFA' },
  },
  {
    name: 'Purple & Cream',
    theme: { primary: '#6B46C1', secondary: '#D4A5A5', background: '#FFFAF0' },
  },
  {
    name: 'Monochrome',
    theme: { primary: '#1A1A1A', secondary: '#555555', background: '#FFFFFF' },
  },
];
