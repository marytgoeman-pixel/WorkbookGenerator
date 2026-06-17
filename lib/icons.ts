// A small, searchable set of callout icons. Each is a single filled SVG path on a
// 24x24 viewBox so it renders both in the builder (<svg>) and in the PDF (drawSvgPath).
export interface IconDef { label: string; keywords: string; path: string; }

export const CALLOUT_ICONS: Record<string, IconDef> = {
  star:     { label: 'Star',        keywords: 'favorite important rating',   path: 'M12 2l2.9 6.26L22 9.27l-5 4.73L18.2 21 12 17.27 5.8 21 7 14l-5-4.73 7.1-1.01z' },
  heart:    { label: 'Heart',       keywords: 'love care like',              path: 'M12 21s-7.5-4.6-10-9.6C.6 8.5 2 5 5.5 5c2 0 3.5 1.2 4.5 2.6C11 6.2 12.5 5 14.5 5 18 5 19.4 8.5 22 11.4 19.5 16.4 12 21 12 21z' },
  check:    { label: 'Check',       keywords: 'done complete success tick',  path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.5-1.5 2.5 2.5 5.5-5.5 1.5 1.5z' },
  target:   { label: 'Target',      keywords: 'goal aim focus',              path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z' },
  bolt:     { label: 'Lightning',   keywords: 'energy fast power tip quick',  path: 'M13 2L4 14h6l-1 8 9-12h-6z' },
  flag:     { label: 'Flag',        keywords: 'milestone goal mark',         path: 'M5 2h2v20H5zM7 3h12l-2.5 4L19 11H7z' },
  diamond:  { label: 'Diamond',     keywords: 'value gem key',               path: 'M12 2l10 10-10 10L2 12z' },
  bulb:     { label: 'Idea',        keywords: 'lightbulb tip insight think', path: 'M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2zM9 19h6v2H9z' },
  bell:     { label: 'Bell',        keywords: 'reminder alert note',         path: 'M12 2a6 6 0 00-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 00-6-6zM9 19a3 3 0 006 0z' },
  pin:      { label: 'Pin',         keywords: 'location place map',          path: 'M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z' },
  gift:     { label: 'Gift',        keywords: 'bonus reward offer',          path: 'M20 7h-2.2A3 3 0 0012 4a3 3 0 00-5.8 3H4v4h16zM5 12v9h6v-9zm8 0v9h6v-9z' },
  trophy:   { label: 'Trophy',      keywords: 'win award success goal',      path: 'M7 3h10v3a5 5 0 01-10 0zM5 4H2v2a4 4 0 004 4V8a2 2 0 01-1-4zm14 0a2 2 0 01-1 4v2a4 4 0 004-4V4zM9 13h6l1 4H8zM7 19h10v2H7z' },
};

export const ICON_KEYS = Object.keys(CALLOUT_ICONS);
