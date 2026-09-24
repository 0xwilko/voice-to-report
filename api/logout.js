// Voice to Report - sign-out endpoint. Clears the session cookie and returns to the sign-in page.
import { clearCookie } from '../lib/session.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearCookie());
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', '/login.html');
  res.end();
}
