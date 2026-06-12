import 'server-only';
import { Redis } from '@upstash/redis';
import { DocumentModel } from '@/types/document';

// Server-side store for saved workbooks (Upstash Redis), so a client's workbooks
// persist across browsers/devices for as long as they can log in. If Redis isn't
// configured, every function is a safe no-op and `storageConfigured()` returns false
// (the client then falls back to per-browser localStorage).
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

export function storageConfigured(): boolean {
  return !!getRedis();
}

export interface SavedWorkbook {
  id: string;
  title: string;
  savedAt: number; // epoch ms
  doc: DocumentModel;
}

const key = (clientId: string) => `workbooks:${clientId}`;
const MAX_PER_CLIENT = 200;

function parse(v: unknown): SavedWorkbook | null {
  try {
    return typeof v === 'string' ? (JSON.parse(v) as SavedWorkbook) : (v as SavedWorkbook);
  } catch {
    return null;
  }
}

export async function listWorkbooks(clientId: string): Promise<SavedWorkbook[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const all = await r.hgetall<Record<string, unknown>>(key(clientId));
    if (!all) return [];
    return Object.values(all)
      .map(parse)
      .filter((w): w is SavedWorkbook => !!w)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function saveWorkbook(clientId: string, w: SavedWorkbook): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.hset(key(clientId), { [w.id]: JSON.stringify(w) });
    // Soft cap: keep the most recent MAX_PER_CLIENT, drop the oldest beyond that
    const items = await listWorkbooks(clientId);
    if (items.length > MAX_PER_CLIENT) {
      const drop = items.slice(MAX_PER_CLIENT).map((x) => x.id);
      if (drop.length) await r.hdel(key(clientId), ...drop);
    }
  } catch {
    /* never break the user flow */
  }
}

export async function deleteWorkbook(clientId: string, id: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.hdel(key(clientId), id);
  } catch {
    /* ignore */
  }
}
