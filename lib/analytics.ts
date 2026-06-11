import 'server-only';
import { Redis } from '@upstash/redis';

// Lazily build a Redis client from whatever env the Vercel/Upstash integration set.
// If it isn't configured yet, every function is a safe no-op so the app still works.
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

export function analyticsConfigured(): boolean {
  return !!getRedis();
}

export interface ClientEvent {
  type: 'login' | 'download';
  ts: number;        // epoch ms
  title?: string;    // workbook title for downloads
}

export interface ClientStats {
  clientId: string;
  logins: number;
  downloads: number;
  lastSeen: number | null;
  recent: ClientEvent[];
}

async function record(clientId: string, ev: ClientEvent) {
  const r = getRedis();
  if (!r) return;
  try {
    await Promise.all([
      r.incr(`stats:${clientId}:${ev.type}s`),
      r.set(`stats:${clientId}:lastSeen`, ev.ts),
      r.lpush(`events:${clientId}`, JSON.stringify(ev)),
      r.ltrim(`events:${clientId}`, 0, 199),
    ]);
  } catch {
    // analytics must never break the user flow
  }
}

export function recordLogin(clientId: string) {
  return record(clientId, { type: 'login', ts: Date.now() });
}

export function recordDownload(clientId: string, title?: string) {
  return record(clientId, { type: 'download', ts: Date.now(), title });
}

export async function getStats(clientIds: string[]): Promise<ClientStats[]> {
  const r = getRedis();
  if (!r) return [];
  const out: ClientStats[] = [];
  for (const clientId of clientIds) {
    try {
      const [logins, downloads, lastSeen, recentRaw] = await Promise.all([
        r.get<number>(`stats:${clientId}:logins`),
        r.get<number>(`stats:${clientId}:downloads`),
        r.get<number>(`stats:${clientId}:lastSeen`),
        r.lrange(`events:${clientId}`, 0, 19),
      ]);
      const recent: ClientEvent[] = (recentRaw ?? []).map((e) =>
        typeof e === 'string' ? (JSON.parse(e) as ClientEvent) : (e as ClientEvent)
      );
      out.push({
        clientId,
        logins: Number(logins ?? 0),
        downloads: Number(downloads ?? 0),
        lastSeen: lastSeen ? Number(lastSeen) : null,
        recent,
      });
    } catch {
      out.push({ clientId, logins: 0, downloads: 0, lastSeen: null, recent: [] });
    }
  }
  return out;
}
