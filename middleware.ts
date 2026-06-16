import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Protect every page + API, EXCEPT the login page, the login/logout APIs, the Stripe
// webhook (authenticated by Stripe's signature, not a session cookie), and any static
// file. The final `.*\..*` clause excludes anything with a file extension (.png, .jpg,
// .mjs, .ico, …) so public assets — like the login logo and background — are served
// WITHOUT a session.
export const config = {
  matcher: ['/((?!login|try|api/login|api/logout|api/inquiry|api/stripe/webhook|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
