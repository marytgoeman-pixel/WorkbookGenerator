import 'server-only';
import { Redis } from '@upstash/redis';

// Server-side store for client-uploaded cover photos (Upstash Redis), so a client's
// cover gallery follows them across browsers/devices for as long as they can log in.
// If Redis isn't configured, every function is a safe no-op and `storageConfigured()`
// returns false (the client then falls back to per-browser IndexedDB).
let redis: Redis | null = null;
let initialized = false;

function getRedis(): Redis | null {
  if (initialized) return redis;
  initialized = true;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function coverStorageConfigured(): boolean {
  return !!getRedis();
}

export interface CoverRecord {
  id: string;
  label: string;
  dataUrl: string; // resized JPEG data URL
}

export const MAX_COVERS = 20;
const key = (clientId: string) => `covers:${clientId}`;

function parse(v: unknown): CoverRecord | null {
  try {
    const c = typeof v === 'string' ? (JSON.parse(v) as CoverRecord) : (v as CoverRecord);
    return c && c.id && c.dataUrl ? c : null;
  } catch {
    return null;
  }
}

export async function listCovers(clientId: string): Promise<CoverRecord[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const all = await r.hgetall<Record<string, unknown>>(key(clientId));
    if (!all) return [];
    return Object.values(all).map(parse).filter((c): c is CoverRecord => !!c);
  } catch {
    return [];
  }
}

// Returns false (and stores nothing) when the gallery is already full of OTHER covers.
export async function saveCover(clientId: string, cover: CoverRecord): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const existing = await listCovers(clientId);
    const isNew = !existing.some((c) => c.id === cover.id);
    if (isNew && existing.length >= MAX_COVERS) return false;
    await r.hset(key(clientId), { [cover.id]: JSON.stringify(cover) });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCover(clientId: string, id: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.hdel(key(clientId), id);
  } catch {
    /* ignore */
  }
}
