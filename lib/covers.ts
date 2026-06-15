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

// The cover-image set a given client should choose from.
export function coverImagesFor(brandId: string | undefined): CoverImage[] {
  // Sell It and the TLC demo use the sleek architecture set; Jo keeps her real-estate set.
  return brandId === 'sellit' || brandId === 'thelearningcreative' ? SELLIT_COVER_IMAGES : COVER_IMAGES;
}

export function coverById(id: string | undefined): CoverImage | undefined {
  if (!id) return undefined;
  return COVER_IMAGES.find((c) => c.id === id) || SELLIT_COVER_IMAGES.find((c) => c.id === id);
}
