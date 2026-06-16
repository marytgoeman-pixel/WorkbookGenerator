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
