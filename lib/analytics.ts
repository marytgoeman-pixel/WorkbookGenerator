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
  loc?: string;      // approximate location "City, REGION, COUNTRY" (from edge geo headers)
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

export function recordLogin(clientId: string, loc?: string) {
  return record(clientId, { type: 'login', ts: Date.now(), loc });
}

export function recordDownload(clientId: string, title?: string, loc?: string) {
  return record(clientId, { type: 'download', ts: Date.now(), title, loc });
}

export function recordAiUse(clientId: string, loc?: string) {
  return record(clientId, { type: 'ai', ts: Date.now(), loc });
}

// --- Per-workbook download accounting ---
// A monthly "credit" is spent only the FIRST time a given saved workbook is downloaded.
// The workbook id then lives forever in a permanent `wbpaid` set, so edits and re-downloads
// of that same workbook are free (this month and every month after). A soft per-workbook
// re-download cap deters scripted abuse of the edit-in-place loophole.
const SOFT_REDOWNLOAD_CAP = 25;

export interface ChargeResult {
  allowed: boolean;          // false only when a re-download exceeds the soft monthly cap
  charged: boolean;          // true = a new workbook credit was spent
  workbooks: number;         // workbooks charged this calendar month (the cap counter)
  workbooksLifetime: number; // distinct workbooks ever charged (drives the trial cap)
  reDownloads: number;       // free re-downloads of THIS workbook this month
}

// Decide whether a download is a new workbook (spend a credit) or a free re-download, and
// update the ledger accordingly. The plan cap itself is enforced client-side (it knows the
// plan); this only does the per-workbook bookkeeping and reports the counts back.
export async function chargeWorkbookDownload(clientId: string, wbId: string | undefined): Promise<ChargeResult> {
  const r = getRedis();
  const month = ym();
  if (!r) return { allowed: true, charged: !!wbId, workbooks: 0, workbooksLifetime: 0, reDownloads: 0 };
  try {
    const paidKey = `wbpaid:${clientId}`;
    // No id (shouldn't happen — downloads auto-save first): allow, don't touch the ledger.
    if (!wbId) {
      const [wb, paid] = await Promise.all([r.get<number>(`usage:${clientId}:${month}:wb`), r.smembers(paidKey)]);
      return { allowed: true, charged: false, workbooks: Number(wb ?? 0), workbooksLifetime: Array.isArray(paid) ? paid.length : 0, reDownloads: 0 };
    }
    // SADD is the atomic gate: it returns 1 only for the FIRST caller to add this id, so two
    // concurrent first-downloads (two tabs/devices) can't both spend a credit.
    const added = await r.sadd(paidKey, wbId);
    if (added === 0) {
      // Already paid → free re-download (soft-capped per month to deter scripted abuse).
      const rc = await r.incr(`wbredl:${clientId}:${month}:${wbId}`);
      if (rc === 1) await r.expire(`wbredl:${clientId}:${month}:${wbId}`, 60 * 60 * 24 * 40);
      const [wb, paid] = await Promise.all([r.get<number>(`usage:${clientId}:${month}:wb`), r.smembers(paidKey)]);
      return { allowed: rc <= SOFT_REDOWNLOAD_CAP, charged: false, workbooks: Number(wb ?? 0), workbooksLifetime: Array.isArray(paid) ? paid.length : 0, reDownloads: rc };
    }
    // Newly added → genuinely new workbook → spend exactly one credit.
    const [wb, paid] = await Promise.all([r.incr(`usage:${clientId}:${month}:wb`), r.smembers(paidKey)]);
    return { allowed: true, charged: true, workbooks: Number(wb), workbooksLifetime: Array.isArray(paid) ? paid.length : 0, reDownloads: 0 };
  } catch {
    return { allowed: true, charged: !!wbId, workbooks: 0, workbooksLifetime: 0, reDownloads: 0 };
  }
}

// Current calendar-month usage for one client (for the download cap + reporting).
// `lifetime` is the all-time download count — used to cap the free trial at 1 download
// for the whole trial (a lifetime cap that does not reset at the month boundary).
export async function getUsage(clientId: string): Promise<{ downloads: number; ai: number; month: string; lifetime: number; workbooks: number; workbooksLifetime: number; paidIds: string[] }> {
  const r = getRedis();
  const month = ym();
  const empty = { downloads: 0, ai: 0, month, lifetime: 0, workbooks: 0, workbooksLifetime: 0, paidIds: [] as string[] };
  if (!r) return empty;
  try {
    const [d, a, life, wb, paid] = await Promise.all([
      r.get<number>(`usage:${clientId}:${month}:download`),
      r.get<number>(`usage:${clientId}:${month}:ai`),
      r.get<number>(`stats:${clientId}:downloads`),
      r.get<number>(`usage:${clientId}:${month}:wb`),
      r.smembers(`wbpaid:${clientId}`),
    ]);
    const paidIds = Array.isArray(paid) ? (paid as string[]) : [];
    return { downloads: Number(d ?? 0), ai: Number(a ?? 0), month, lifetime: Number(life ?? 0), workbooks: Number(wb ?? 0), workbooksLifetime: paidIds.length, paidIds };
  } catch {
    return empty;
  }
}

// Reset a client's download counters (lifetime + this month) so their trial download
// becomes available again — used by the admin "Reset trial" action for demos.
export async function resetDownloadCounts(clientId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await Promise.all([
      r.del(`stats:${clientId}:downloads`),
      r.del(`usage:${clientId}:${ym()}:download`),
      r.del(`usage:${clientId}:${ym()}:wb`),   // workbook credits this month
      r.del(`wbpaid:${clientId}`),             // the permanent paid-workbook ledger
    ]);
  } catch {
    /* ignore */
  }
}

// --- Public "Try Me" sandbox tracking (anonymous: time + approximate location only) ---
export interface TryEvent {
  event: 'open' | 'download';
  ts: number;
  loc?: string;   // approximate location from edge geo headers
  title?: string; // workbook title for downloads
}

export async function recordTry(event: 'open' | 'download', loc?: string, title?: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const ev: TryEvent = { event, ts: Date.now(), loc, title };
    await Promise.all([
      r.incr(`tryme:${event}s`),
      r.lpush('tryme:events', JSON.stringify(ev)),
      r.ltrim('tryme:events', 0, 199),
    ]);
  } catch {
    /* never break the public demo */
  }
}

export async function getTryStats(): Promise<{ opens: number; downloads: number; recent: TryEvent[] }> {
  const r = getRedis();
  if (!r) return { opens: 0, downloads: 0, recent: [] };
  try {
    const [opens, downloads, recentRaw] = await Promise.all([
      r.get<number>('tryme:opens'),
      r.get<number>('tryme:downloads'),
      r.lrange('tryme:events', 0, 49),
    ]);
    const recent: TryEvent[] = (recentRaw ?? []).map((e) => (typeof e === 'string' ? JSON.parse(e) : e) as TryEvent);
    return { opens: Number(opens ?? 0), downloads: Number(downloads ?? 0), recent };
  } catch {
    return { opens: 0, downloads: 0, recent: [] };
  }
}

// --- Session duration ("how long they stayed"), measured by a client heartbeat ---
export interface SessionRec { start: number; last: number; loc?: string; }

// Upsert a session: first ping records the start; later pings extend `last`. Scope is a
// clientId for logged-in accounts, or 'tryme' for the public demo. 14-day TTL.
export async function touchSession(scope: string, id: string, loc?: string): Promise<void> {
  const r = getRedis();
  if (!r || !id) return;
  try {
    const key = `wbs:${scope}:${id}`;
    const raw = await r.get(key);
    const existing = (typeof raw === 'string' ? JSON.parse(raw) : raw) as SessionRec | null;
    const now = Date.now();
    if (!existing) {
      await r.lpush(`wbslist:${scope}`, id);
      await r.ltrim(`wbslist:${scope}`, 0, 49);
    }
    const rec: SessionRec = { start: existing?.start ?? now, last: now, loc: loc || existing?.loc };
    await r.set(key, JSON.stringify(rec), { ex: 60 * 60 * 24 * 14 });
  } catch {
    /* never break the app over analytics */
  }
}

export async function getSessions(scope: string): Promise<SessionRec[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const ids = await r.lrange<string>(`wbslist:${scope}`, 0, 49);
    if (!ids || ids.length === 0) return [];
    const raw = (await r.mget(...ids.map((id) => `wbs:${scope}:${id}`))) as unknown[];
    return (raw || [])
      .map((v) => (typeof v === 'string' ? JSON.parse(v) : v) as SessionRec | null)
      .filter((v): v is SessionRec => !!v && typeof v.start === 'number')
      .sort((a, b) => b.start - a.start);
  } catch {
    return [];
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
