import 'server-only';
import { Redis } from '@upstash/redis';
import { ClientBranding } from '@/types/document';

// Template overrides for MANAGED clients (the hardcoded ones in clients.ts). When a
// managed client edits their template in the builder, the changed fields are stored here
// and merged on top of their base branding. Self-serve accounts store edits in accounts.ts.
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

export type BrandingOverride = Partial<Pick<ClientBranding,
  'displayName' | 'tagline' | 'logoUrl' | 'colors' | 'font' | 'coverStyle' | 'footerStyle' | 'logoPosition' | 'calloutStyle' | 'calloutIcon' | 'coverLogoScale' | 'coverLogoAlign' | 'coverLogoWhite' | 'logoUrlWhite'>>;

const key = (clientId: string) => `brandover:${clientId}`;

export async function getBrandingOverride(clientId: string): Promise<BrandingOverride | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key(clientId));
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as BrandingOverride | null;
  } catch {
    return null;
  }
}

export async function setBrandingOverride(clientId: string, ov: BrandingOverride): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.set(key(clientId), JSON.stringify(ov)); } catch { /* ignore */ }
}

export async function clearBrandingOverride(clientId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.del(key(clientId)); } catch { /* ignore */ }
}

// Merge an override onto base branding (colors merge deeply).
export function mergeBranding(base: ClientBranding, ov: BrandingOverride | null): ClientBranding {
  if (!ov) return base;
  return { ...base, ...ov, colors: { ...base.colors, ...(ov.colors ?? {}) } };
}
