'use client';
import { DocumentModel } from '@/types/document';

// Client-side accessor for saved workbooks. Primary store is the server (cloud DB),
// so workbooks persist across devices for as long as the client can log in. If the
// server reports the DB isn't configured (or is unreachable), we fall back to
// per-browser localStorage so nothing is lost in the meantime.
export interface SavedWorkbook {
  id: string;
  title: string;
  savedAt: number; // epoch ms
  doc: DocumentModel;
}

export interface SavedResult {
  items: SavedWorkbook[];
  cloud: boolean; // true when backed by the server DB (cross-device); false = this browser only
}

// ---- localStorage fallback (per-browser) ----
const keyFor = (clientId: string) => `wb_saved_${clientId}`;
function localRead(clientId: string): SavedWorkbook[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(clientId));
    const list = raw ? (JSON.parse(raw) as SavedWorkbook[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function localWrite(clientId: string, list: SavedWorkbook[]) {
  try {
    window.localStorage.setItem(keyFor(clientId), JSON.stringify(list));
  } catch {
    /* quota / unavailable */
  }
}

function newId(): string {
  return `wb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function listSaved(clientId: string): Promise<SavedResult> {
  try {
    const res = await fetch('/api/workbooks', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      if (d.configured) return { items: (d.workbooks ?? []) as SavedWorkbook[], cloud: true };
    }
  } catch {
    /* fall through to localStorage */
  }
  return { items: localRead(clientId).sort((a, b) => b.savedAt - a.savedAt), cloud: false };
}

export async function saveWorkbook(
  clientId: string,
  doc: DocumentModel,
  existingId?: string | null
): Promise<{ id: string; cloud: boolean }> {
  const w: SavedWorkbook = { id: existingId || newId(), title: (doc.title || 'Untitled').trim(), savedAt: Date.now(), doc };
  try {
    const res = await fetch('/api/workbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbook: w }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.configured) return { id: d.id || w.id, cloud: true };
    }
  } catch {
    /* fall through to localStorage */
  }
  const list = localRead(clientId);
  const idx = list.findIndex((x) => x.id === w.id);
  if (idx >= 0) list[idx] = w;
  else list.push(w);
  localWrite(clientId, list);
  return { id: w.id, cloud: false };
}

export async function deleteSaved(clientId: string, id: string): Promise<void> {
  try {
    const res = await fetch(`/api/workbooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      const d = await res.json();
      if (d.configured) return;
    }
  } catch {
    /* fall through */
  }
  localWrite(clientId, localRead(clientId).filter((x) => x.id !== id));
}
