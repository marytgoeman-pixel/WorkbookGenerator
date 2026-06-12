'use client';
import { DocumentModel } from '@/types/document';

// Past workbooks are saved in the browser (localStorage), scoped per client account,
// so each client can come back and edit a workbook they downloaded earlier.
export interface SavedWorkbook {
  id: string;
  title: string;
  savedAt: number; // epoch ms
  doc: DocumentModel;
}

const keyFor = (clientId: string) => `wb_saved_${clientId}`;

function read(clientId: string): SavedWorkbook[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(clientId));
    const list = raw ? (JSON.parse(raw) as SavedWorkbook[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(clientId: string, list: SavedWorkbook[]) {
  try {
    window.localStorage.setItem(keyFor(clientId), JSON.stringify(list));
  } catch {
    /* quota or unavailable — saving is best-effort */
  }
}

export function listSaved(clientId: string): SavedWorkbook[] {
  return read(clientId).sort((a, b) => b.savedAt - a.savedAt);
}

export function getSaved(clientId: string, id: string): SavedWorkbook | undefined {
  return read(clientId).find((w) => w.id === id);
}

// Save (or update, when `existingId` matches) a workbook. Returns the saved id.
export function saveWorkbook(clientId: string, doc: DocumentModel, existingId?: string | null): string {
  const list = read(clientId);
  const now = Date.now();
  const title = (doc.title || 'Untitled').trim();
  if (existingId) {
    const idx = list.findIndex((w) => w.id === existingId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], title, savedAt: now, doc };
      write(clientId, list);
      return existingId;
    }
  }
  const id = `wb_${now}_${Math.random().toString(36).slice(2, 7)}`;
  list.push({ id, title, savedAt: now, doc });
  write(clientId, list);
  return id;
}

export function deleteSaved(clientId: string, id: string) {
  write(clientId, read(clientId).filter((w) => w.id !== id));
}
