import 'server-only';
import { Redis } from '@upstash/redis';
import { PLANS, PlanDef, PlanId, isPlanId } from './plans';

// Stores a per-client plan OVERRIDE (set by a successful Stripe payment via the webhook).
// The client's effective plan = this override if present, else the default in clients.ts.
// Safe no-op when Redis isn't configured.
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

const key = (clientId: string) => `plan:${clientId}`;

export async function getStoredPlan(clientId: string): Promise<PlanDef | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get<string>(key(clientId));
    return isPlanId(v) ? PLANS[v] : null;
  } catch {
    return null;
  }
}

export async function setStoredPlan(clientId: string, planId: PlanId): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key(clientId), planId);
  } catch {
    /* never break billing flow */
  }
}

// --- Stripe customer id (so a subscriber can open the billing portal) ---
const custKey = (clientId: string) => `customer:${clientId}`;

export async function getStoredCustomer(clientId: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get<string>(custKey(clientId));
    return v || null;
  } catch {
    return null;
  }
}

export async function setStoredCustomer(clientId: string, customerId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(custKey(clientId), customerId);
  } catch {
    /* ignore */
  }
}

// Wipe any paid-plan override + stored Stripe customer for a client (admin reset),
// so they fall back to their base plan / trial.
export async function clearStoredPlan(clientId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await Promise.all([r.del(key(clientId)), r.del(custKey(clientId))]); } catch { /* ignore */ }
}

// --- Trial tracking: records when a client's 7-day trial started (first login) ---
const trialKey = (clientId: string) => `trial:${clientId}`;

// Reset a client's trial clock so the 7 days restart on their next login (admin reset).
export async function clearTrialStart(clientId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.del(trialKey(clientId)); } catch { /* ignore */ }
}

// Returns the trial start (epoch ms), setting it to now on first call. When Redis
// isn't configured, returns now each time (so dev/local trials read as freshly started).
export async function ensureTrialStart(clientId: string): Promise<number> {
  const r = getRedis();
  if (!r) return Date.now();
  try {
    const existing = await r.get<number>(trialKey(clientId));
    if (existing) return Number(existing);
    const now = Date.now();
    await r.set(trialKey(clientId), now);
    return now;
  } catch {
    return Date.now();
  }
}
