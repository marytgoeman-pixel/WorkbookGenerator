import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'wb_session';

// In production set AUTH_SECRET in the environment. This fallback keeps dev working.
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me-in-production'
);

export interface SessionPayload {
  username: string;
  clientId: string;
  displayName: string;
  isAdmin?: boolean;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      username: payload.username as string,
      clientId: payload.clientId as string,
      displayName: payload.displayName as string,
      isAdmin: payload.isAdmin as boolean | undefined,
    };
  } catch {
    return null;
  }
}
