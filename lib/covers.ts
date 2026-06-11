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

export function coverById(id: string | undefined): CoverImage | undefined {
  if (!id) return undefined;
  return COVER_IMAGES.find((c) => c.id === id);
}
