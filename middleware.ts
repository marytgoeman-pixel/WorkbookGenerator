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

// Protect every page + API, EXCEPT the login page, the login/logout APIs, and any
// static file. The final `.*\..*` clause excludes anything with a file extension
// (.png, .jpg, .mjs, .ico, …) so public assets — like the login logo and background —
// are served WITHOUT a session. (Previously only files whose path happened to start
// with an allow-listed word loaded pre-login; the logo didn't, so it 307'd to /login.)
export const config = {
  matcher: ['/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
