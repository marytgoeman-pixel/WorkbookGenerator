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
  type: 'login' | 'download' | 'ai';
  ts: number;        // epoch ms
  title?: string;    // workbook title for downloads
}

export interface ClientStats {
  clientId: string;
  logins: number;
  downloads: number;
  ais: number;        // AI auto-format calls ("AI credits used")
  lastSeen: number | null;
  recent: ClientEvent[];
}

function ym(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function record(clientId: string, ev: ClientEvent) {
  const r = getRedis();
  if (!r) return;
  try {
    const ops: Promise<unknown>[] = [
      r.incr(`stats:${clientId}:${ev.type}s`),
      r.set(`stats:${clientId}:lastSeen`, ev.ts),
      r.lpush(`events:${clientId}`, JSON.stringify(ev)),
      r.ltrim(`events:${clientId}`, 0, 199),
    ];
    // Per-month usage counters power the download cap + monthly admin reporting
    if (ev.type !== 'login') ops.push(r.incr(`usage:${clientId}:${ym(new Date(ev.ts))}:${ev.type}`));
    await Promise.all(ops);
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

export function recordAiUse(clientId: string) {
  return record(clientId, { type: 'ai', ts: Date.now() });
}

// Current calendar-month usage for one client (for the download cap + reporting).
// `lifetime` is the all-time download count — used to cap the free trial at 1 download
// for the whole trial (a lifetime cap that does not reset at the month boundary).
export async function getUsage(clientId: string): Promise<{ downloads: number; ai: number; month: string; lifetime: number }> {
  const r = getRedis();
  const month = ym();
  if (!r) return { downloads: 0, ai: 0, month, lifetime: 0 };
  try {
    const [d, a, life] = await Promise.all([
      r.get<number>(`usage:${clientId}:${month}:download`),
      r.get<number>(`usage:${clientId}:${month}:ai`),
      r.get<number>(`stats:${clientId}:downloads`),
    ]);
    return { downloads: Number(d ?? 0), ai: Number(a ?? 0), month, lifetime: Number(life ?? 0) };
  } catch {
    return { downloads: 0, ai: 0, month, lifetime: 0 };
  }
}

export async function getStats(clientIds: string[]): Promise<ClientStats[]> {
  const r = getRedis();
  if (!r) return [];
  const out: ClientStats[] = [];
  for (const clientId of clientIds) {
    try {
      const [logins, downloads, ais, lastSeen, recentRaw] = await Promise.all([
        r.get<number>(`stats:${clientId}:logins`),
        r.get<number>(`stats:${clientId}:downloads`),
        r.get<number>(`stats:${clientId}:ais`),
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
        ais: Number(ais ?? 0),
        lastSeen: lastSeen ? Number(lastSeen) : null,
        recent,
      });
    } catch {
      out.push({ clientId, logins: 0, downloads: 0, ais: 0, lastSeen: null, recent: [] });
    }
  }
  return out;
}
