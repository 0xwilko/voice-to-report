// Voice to Report - sign-in endpoint.
// Checks username/password against APP_USERS, then sets a 30-day session cookie.
// Failed attempts are limited per device (IP) via Upstash: 5 failures locks for 15 minutes.
import { checkPassword, createToken, sessionCookie, getUsers } from '../lib/session.js';

const MAX_FAILS = 5;
const LOCK_SEC = 900;

async function redis(cmds) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    if (!r.ok) throw new Error('Redis HTTP ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data) || data.some(d => !d || d.error)) throw new Error('Redis command error');
    return data.map(d => d.result);
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (getUsers().size === 0) return res.status(503).json({ error: 'Sign-in not configured' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = 'v2r:login:' + ip;

  let fails = 0;
  try { const r = await redis([['GET', key]]); fails = Number(r[0] || 0); }
  catch (e) { console.error('Login limit store unavailable', e && e.message); }
  if (fails >= MAX_FAILS) return res.status(429).json({ error: 'Too many attempts' });

  const { username, password } = req.body || {};
  const name = checkPassword(username, password);

  if (!name) {
    try { await redis([['SET', key, '0', 'EX', String(LOCK_SEC), 'NX'], ['INCR', key]]); } catch (e) {}
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: 'Not recognised' });
  }

  try { await redis([['DEL', key]]); } catch (e) {}
  let token;
  try { token = await createToken(name); }
  catch (e) { return res.status(503).json({ error: 'Sign-in not configured' }); }

  res.setHeader('Set-Cookie', sessionCookie(token));
  return res.status(200).json({ ok: true, user: name });
}
