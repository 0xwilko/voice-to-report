// Voice to Report - blocks every page and API call until the user is signed in.
// Runs on Vercel Routing Middleware before any file or function is served.
import { verifyToken, getCookie, COOKIE_NAME } from './lib/session.js';

export const config = {
  // Everything except the sign-in page, sign-in/out endpoints and harmless app assets.
  matcher: ['/((?!login\\.html|api/login|api/logout|icon\\.svg|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|manifest\\.webmanifest|service-worker\\.js|favicon\\.ico).*)']
};

export default async function middleware(request) {
  const user = await verifyToken(getCookie(request.headers.get('cookie'), COOKIE_NAME));
  if (user) {
    // Signed in: continue to the requested page or function.
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  return new Response(null, { status: 302, headers: { 'Location': '/login.html', 'Cache-Control': 'no-store' } });
}
