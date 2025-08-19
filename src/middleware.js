import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const AUTH_PATHS = ['/auth/login', '/auth/register'];
const PUBLIC_PATHS = ['/landing', '/pricing']; // Add landing page and pricing as public paths

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow static files and API routes to pass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check for both NextAuth session and manual auth token
  const nextAuthSession = req.cookies.get('next-auth.session-token')?.value || 
                         req.cookies.get('__Secure-next-auth.session-token')?.value;
  const manualToken = req.cookies.get('auth_token')?.value;
  const hasAuth = nextAuthSession || manualToken;

  // If visiting auth pages while authenticated, redirect to home
  if (AUTH_PATHS.some(p => pathname.startsWith(p))) {
    if (hasAuth) {
      const home = req.nextUrl.clone();
      home.pathname = '/';
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  // Allow access to public paths without authentication
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect all other app routes
  if (!hasAuth) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api|public).*)'],
};