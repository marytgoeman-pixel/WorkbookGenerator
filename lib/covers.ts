// Curated cover-image options a client can choose for their workbook cover page.
// Images live in /public/covers (optimized from the originals in Jo's OneDrive).
export interface CoverImage {
  id: string;
  thumb: string; // small preview for the picker grid
  cover: string; // full image embedded on the PDF cover
  label: string; // shown as a tooltip / accessible label
}

export const COVER_IMAGES: CoverImage[] = [
  { id: 'cover-1', thumb: '/covers/thumb-1.jpg', cover: '/covers/cover-1.jpg', label: 'Modern living room' },
  { id: 'cover-2', thumb: '/covers/thumb-2.jpg', cover: '/covers/cover-2.jpg', label: 'Cozy reading nook' },
  { id: 'cover-3', thumb: '/covers/thumb-3.jpg', cover: '/covers/cover-3.jpg', label: 'Home with mountain view' },
  { id: 'cover-4', thumb: '/covers/thumb-4.jpg', cover: '/covers/cover-4.jpg', label: 'Luxury two-story home' },
  { id: 'cover-5', thumb: '/covers/thumb-5.jpg', cover: '/covers/cover-5.jpg', label: 'Suburban neighborhood' },
  { id: 'cover-6', thumb: '/covers/thumb-6.jpg', cover: '/covers/cover-6.jpg', label: 'Modern kitchen' },
  { id: 'cover-7', thumb: '/covers/thumb-7.jpg', cover: '/covers/cover-7.jpg', label: 'Real estate technology' },
  { id: 'cover-8', thumb: '/covers/thumb-8.jpg', cover: '/covers/cover-8.jpg', label: 'Modern townhomes' },
  { id: 'cover-9', thumb: '/covers/thumb-9.jpg', cover: '/covers/cover-9.jpg', label: 'Happy homebuyers' },
  { id: 'cover-10', thumb: '/covers/thumb-10.jpg', cover: '/covers/cover-10.jpg', label: 'Modern home at dusk' },
];

// Sell It's cover set — modern architecture / building imagery.
export const SELLIT_COVER_IMAGES: CoverImage[] = [
  { id: 'sellit-1', thumb: '/covers/sellit-thumb-1.jpg', cover: '/covers/sellit-1.jpg', label: 'Glass facade' },
  { id: 'sellit-2', thumb: '/covers/sellit-thumb-2.jpg', cover: '/covers/sellit-2.jpg', label: 'Blue glass facade with clouds' },
  { id: 'sellit-3', thumb: '/covers/sellit-thumb-3.jpg', cover: '/covers/sellit-3.jpg', label: 'Office tower (looking up)' },
  { id: 'sellit-4', thumb: '/covers/sellit-thumb-4.jpg', cover: '/covers/sellit-4.jpg', label: 'Building exterior wall' },
  { id: 'sellit-5', thumb: '/covers/sellit-thumb-5.jpg', cover: '/covers/sellit-5.jpg', label: 'Geometric facade closeup' },
  { id: 'sellit-6', thumb: '/covers/sellit-thumb-6.jpg', cover: '/covers/sellit-6.jpg', label: 'City sunburst' },
  { id: 'sellit-7', thumb: '/covers/sellit-thumb-7.jpg', cover: '/covers/sellit-7.jpg', label: 'City skyline' },
  { id: 'sellit-8', thumb: '/covers/sellit-thumb-8.jpg', cover: '/covers/sellit-8.jpg', label: 'Skyline at dusk' },
  { id: 'sellit-9', thumb: '/covers/sellit-thumb-9.jpg', cover: '/covers/sellit-9.jpg', label: 'Modern office interior' },
  { id: 'sellit-10', thumb: '/covers/sellit-thumb-10.jpg', cover: '/covers/sellit-10.jpg', label: 'Office with city view' },
  { id: 'sellit-11', thumb: '/covers/sellit-thumb-11.jpg', cover: '/covers/sellit-11.jpg', label: 'Curved glass building' },
];

// The Learning Creative — hand-drawn botanical & geometric patterns in the brand palette.
export const TLC_COVER_IMAGES: CoverImage[] = [
  { id: 'tlc-1', thumb: '/covers/tlc-thumb-1.jpg', cover: '/covers/tlc-1.jpg', label: 'Botanical leaves — terracotta & sage' },
  { id: 'tlc-2', thumb: '/covers/tlc-thumb-2.jpg', cover: '/covers/tlc-2.jpg', label: 'Fine geometric lattice' },
  { id: 'tlc-3', thumb: '/covers/tlc-thumb-3.jpg', cover: '/covers/tlc-3.jpg', label: 'Diamond lattice — blush' },
  { id: 'tlc-4', thumb: '/covers/tlc-thumb-4.jpg', cover: '/covers/tlc-4.jpg', label: 'Ornamental trellis' },
  { id: 'tlc-5', thumb: '/covers/tlc-thumb-5.jpg', cover: '/covers/tlc-5.jpg', label: 'Delicate diamond grid' },
  { id: 'tlc-6', thumb: '/covers/tlc-thumb-6.jpg', cover: '/covers/tlc-6.jpg', label: 'Soft blue foliage' },
  { id: 'tlc-7', thumb: '/covers/tlc-thumb-7.jpg', cover: '/covers/tlc-7.jpg', label: 'Line-art leaves — green' },
  { id: 'tlc-8', thumb: '/covers/tlc-thumb-8.jpg', cover: '/covers/tlc-8.jpg', label: 'Ink leaf sprigs' },
  { id: 'tlc-9', thumb: '/covers/tlc-thumb-9.jpg', cover: '/covers/tlc-9.jpg', label: 'Autumn foliage — gold & rust' },
  { id: 'tlc-10', thumb: '/covers/tlc-thumb-10.jpg', cover: '/covers/tlc-10.jpg', label: 'Geometric star dot' },
];

// Voyageur University — business / workplace photography (fractional-leadership audience).
export const VOYAGEUR_COVER_IMAGES: CoverImage[] = [
  { id: 'voyageur-1', thumb: '/covers/voyageur-thumb-1.jpg', cover: '/covers/voyageur-1.jpg', label: 'Workspace flat-lay with charts' },
  { id: 'voyageur-2', thumb: '/covers/voyageur-thumb-2.jpg', cover: '/covers/voyageur-2.jpg', label: 'Coffee & notes flat-lay' },
  { id: 'voyageur-3', thumb: '/covers/voyageur-thumb-3.jpg', cover: '/covers/voyageur-3.jpg', label: 'Professional at her desk' },
  { id: 'voyageur-4', thumb: '/covers/voyageur-thumb-4.jpg', cover: '/covers/voyageur-4.jpg', label: 'Businesswoman with a tablet' },
  { id: 'voyageur-5', thumb: '/covers/voyageur-thumb-5.jpg', cover: '/covers/voyageur-5.jpg', label: 'Bright desk with laptop' },
  { id: 'voyageur-6', thumb: '/covers/voyageur-thumb-6.jpg', cover: '/covers/voyageur-6.jpg', label: 'Team collaboration' },
  { id: 'voyageur-7', thumb: '/covers/voyageur-thumb-7.jpg', cover: '/covers/voyageur-7.jpg', label: 'Working from a phone' },
  { id: 'voyageur-8', thumb: '/covers/voyageur-thumb-8.jpg', cover: '/covers/voyageur-8.jpg', label: 'Modern white home office' },
  { id: 'voyageur-9', thumb: '/covers/voyageur-thumb-9.jpg', cover: '/covers/voyageur-9.jpg', label: 'Open office workspace' },
  { id: 'voyageur-10', thumb: '/covers/voyageur-thumb-10.jpg', cover: '/covers/voyageur-10.jpg', label: 'Home office with plants' },
  { id: 'voyageur-11', thumb: '/covers/voyageur-thumb-11.jpg', cover: '/covers/voyageur-11.jpg', label: 'Desk with monitor & lamp' },
];

// The cover-image set a given client should choose from.
export function coverImagesFor(brandId: string | undefined): CoverImage[] {
  if (brandId === 'thelearningcreative') return TLC_COVER_IMAGES; // TLC uses its own botanical art
  if (brandId === 'sellit') return SELLIT_COVER_IMAGES;           // Sell It uses the architecture set
  if (brandId === 'voyageur') return VOYAGEUR_COVER_IMAGES;       // Voyageur uses business/workplace photos
  return COVER_IMAGES;                                            // Jo keeps her real-estate set
}

export function coverById(id: string | undefined): CoverImage | undefined {
  if (!id) return undefined;
  return COVER_IMAGES.find((c) => c.id === id)
    || SELLIT_COVER_IMAGES.find((c) => c.id === id)
    || TLC_COVER_IMAGES.find((c) => c.id === id)
    || VOYAGEUR_COVER_IMAGES.find((c) => c.id === id);
}
