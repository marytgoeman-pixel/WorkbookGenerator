import 'server-only';
import { Redis } from '@upstash/redis';
import { ClientBranding } from '@/types/document';

// Self-serve accounts, stored in Redis (the hardcoded clients in clients.ts are the
// managed/boutique ones). Safe no-ops when Redis isn't configured.
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

export interface Account {
  clientId: string;     // always prefixed "u_" so it can't collide with managed clients
  email: string;        // lowercase; also the login username
  passwordHash: string; // bcrypt
  verified: boolean;    // email confirmed
  boutique: boolean;    // requested done-for-you setup
  selfServe: true;      // marks the self-serve trial (watermarked) vs managed trial (clean)
  configured: boolean;  // finished the template builder at least once
  createdAt: number;
  branding: ClientBranding;
}

const norm = (email: string) => email.toLowerCase().trim();
const acctKey = (id: string) => `acct:${id}`;
const emailKey = (email: string) => `acctEmail:${norm(email)}`;
const verifyKey = (token: string) => `acctVerify:${token}`;

export async function getAccountById(clientId: string): Promise<Account | null> {
  const r = getRedis();
  if (!r || !clientId.startsWith('u_')) return null;
  try {
    const raw = await r.get(acctKey(clientId));
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Account | null;
  } catch {
    return null;
  }
}

export async function getAccountByEmail(email: string): Promise<Account | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const id = await r.get<string>(emailKey(email));
    return id ? getAccountById(id) : null;
  } catch {
    return null;
  }
}

export async function saveAccount(acct: Account): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(acctKey(acct.clientId), JSON.stringify(acct));
  await r.set(emailKey(acct.email), acct.clientId);
}

// Create an unverified account. Returns the account, or an error string (e.g. taken).
export async function createAccount(opts: {
  email: string;
  passwordHash: string;
  boutique: boolean;
  branding: ClientBranding;
}): Promise<{ account: Account } | { error: string }> {
  const r = getRedis();
  if (!r) return { error: 'Accounts are not available right now.' };
  const email = norm(opts.email);
  const existing = await getAccountByEmail(email);
  if (existing) return { error: 'An account with that email already exists. Try signing in.' };
  // Short, collision-resistant id (Math.random is fine here — not security-sensitive).
  const clientId = `u_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  const account: Account = {
    clientId,
    email,
    passwordHash: opts.passwordHash,
    verified: false,
    boutique: opts.boutique,
    selfServe: true,
    configured: false,
    createdAt: Date.now(),
    branding: { ...opts.branding, id: clientId },
  };
  await saveAccount(account);
  return { account };
}

export async function setAccountBranding(clientId: string, branding: ClientBranding): Promise<void> {
  const acct = await getAccountById(clientId);
  if (!acct) return;
  await saveAccount({ ...acct, branding: { ...branding, id: clientId } });
}

// --- Email verification tokens (24h TTL) ---
export async function createVerifyToken(clientId: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const token = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  await r.set(verifyKey(token), clientId, { ex: 60 * 60 * 24 });
  return token;
}

// --- Password reset tokens (1h TTL) ---
const resetKey = (token: string) => `acctReset:${token}`;

export async function createResetToken(clientId: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const token = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  await r.set(resetKey(token), clientId, { ex: 60 * 60 });
  return token;
}

// Set a new password from a valid reset token. Returns true on success.
export async function resetPassword(token: string, passwordHash: string): Promise<boolean> {
  const r = getRedis();
  if (!r || !token) return false;
  try {
    const clientId = await r.get<string>(resetKey(token));
    if (!clientId) return false;
    const acct = await getAccountById(clientId);
    if (!acct) return false;
    await saveAccount({ ...acct, passwordHash, verified: true }); // verifying via reset link also confirms the email
    await r.del(resetKey(token));
    return true;
  } catch {
    return false;
  }
}

// Consume a token → mark the account verified. Returns the account id on success.
export async function consumeVerifyToken(token: string): Promise<string | null> {
  const r = getRedis();
  if (!r || !token) return null;
  try {
    const clientId = await r.get<string>(verifyKey(token));
    if (!clientId) return null;
    const acct = await getAccountById(clientId);
    if (acct && !acct.verified) await saveAccount({ ...acct, verified: true });
    await r.del(verifyKey(token));
    return clientId;
  } catch {
    return null;
  }
}
