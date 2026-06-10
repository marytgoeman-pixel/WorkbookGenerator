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

// Protect everything except the login page, login/logout APIs, and static assets
export const config = {
  matcher: ['/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico|clients|pdf.worker.min.mjs).*)'],
};
