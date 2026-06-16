'use client';
// Per-brand store for cover photos a client uploads themselves. Images are resized in
// the browser and kept in IndexedDB (one array per brand). Capped at MAX_USER_COVERS —
// the client must delete one to add another once full.

export interface UserCover {
  id: string;
  label: string;
  dataUrl: string; // resized JPEG data URL, used for both the picker thumb and the PDF cover
}

export const MAX_USER_COVERS = 20;

const DB_NAME = 'tlc-covers';
const STORE = 'covers';
const keyFor = (brandId?: string) => `covers:${brandId || 'default'}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Resize an uploaded image to fit within maxDim on its long edge, as a JPEG data URL.
function resizeToDataUrl(file: File, maxDim = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

export async function listUserCovers(brandId?: string): Promise<UserCover[]> {
  try { return (await idbGet<UserCover[]>(keyFor(brandId))) || []; } catch { return []; }
}

export async function deleteUserCover(brandId: string | undefined, id: string): Promise<UserCover[]> {
  const next = (await listUserCovers(brandId)).filter((c) => c.id !== id);
  await idbSet(keyFor(brandId), next);
  return next;
}

// Add a photo. Throws Error('LIMIT') when the brand already has MAX_USER_COVERS.
export async function addUserCover(brandId: string | undefined, file: File): Promise<{ list: UserCover[]; added: UserCover }> {
  const list = await listUserCovers(brandId);
  if (list.length >= MAX_USER_COVERS) throw new Error('LIMIT');
  const dataUrl = await resizeToDataUrl(file);
  const added: UserCover = {
    id: 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'My photo',
    dataUrl,
  };
  const next = [...list, added];
  await idbSet(keyFor(brandId), next);
  return { list: next, added };
}
