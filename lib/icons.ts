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
  shield:   { label: 'Shield',      keywords: 'safe secure protect trust',   path: 'M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z' },
  clock:    { label: 'Clock',       keywords: 'time deadline schedule when',  path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 4v6.4l4 2.3-1 1.7-5-2.9V6z' },
  chat:     { label: 'Chat',        keywords: 'note comment discuss feedback', path: 'M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H9l-5 4V5a1 1 0 011-1z' },
  book:     { label: 'Book',        keywords: 'learn read lesson study',      path: 'M4 4a2 2 0 012-2h12v18H6a2 2 0 00-2 2zm3 1v12h9V5z' },
  rocket:   { label: 'Rocket',      keywords: 'launch start grow boost',      path: 'M12 2c3.5 2.2 5.5 6 5.5 10l-2.5 2h-6L6.5 12C6.5 8 8.5 4.2 12 2zm0 5a2 2 0 100 4 2 2 0 000-4zM8 18l-2 4 4-1zm8 0l2 4-4-1z' },
  pencil:   { label: 'Pencil',      keywords: 'write edit note draft',        path: 'M3 17.2V21h3.8L18 9.8 14.2 6zM20.7 7.3a1 1 0 000-1.4l-2.6-2.6a1 1 0 00-1.4 0l-1.6 1.6L19.1 8.9z' },
  chart:    { label: 'Chart',       keywords: 'results data growth metrics',  path: 'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z' },
  info:     { label: 'Info',        keywords: 'note information important',    path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v2h-2V7zm0 4v6h-2v-6z' },
  arrow:    { label: 'Arrow',       keywords: 'next go action step forward',   path: 'M4 11h11l-4-4 1.4-1.4L20 12l-7.6 7.4L11 18l4-4H4z' },
  plus:     { label: 'Plus',        keywords: 'add more new',                 path: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z' },
  thumb:    { label: 'Thumbs up',   keywords: 'approve like win yes',         path: 'M2 10h4v12H2zM8 22h9a2 2 0 002-1.6l1.9-7A2 2 0 0019 11h-6l1-4.2A2 2 0 0011 4L8 10z' },
  megaphone:{ label: 'Megaphone',   keywords: 'announce shout important news', path: 'M3 10v4l3 1v4h2v-3.3L19 21V3L8 9H6a3 3 0 00-3 1z' },
  sun:      { label: 'Sun',         keywords: 'day positive bright energy',    path: 'M12 7a5 5 0 100 10 5 5 0 000-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4 5.4l1.4-1.4 2.1 2.1L6.1 7.5zM16.4 17.9l1.4-1.4 2.1 2.1-1.4 1.4zM19.9 4l1.4 1.4-2.1 2.1-1.4-1.4zM5.5 16.5l1.4 1.4-2.1 2.1L3.4 18.6z' },
  key:      { label: 'Key',         keywords: 'access secret key point',      path: 'M14 2a6 6 0 00-5.7 7.9L2 16.2V22h5.8l.5-.5V19h2.3l1.3-1.3 1.6.1A6 6 0 1014 2zm3.5 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z' },
};

export const ICON_KEYS = Object.keys(CALLOUT_ICONS);
