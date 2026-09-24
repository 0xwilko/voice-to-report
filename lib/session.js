// Voice to Report - shared sign-in helpers (used by middleware.js and api/*).
// Web Crypto only, no packages.
// Users come from the APP_USERS environment variable:
//   username:password pairs separated by commas or new lines, e.g.
//   tim:FirstPassword,deb:SecondPassword
// Sessions are signed with SESSION_SECRET if set, otherwise KV_REST_API_TOKEN.
// Changing a user's password or removing them ends their sessions immediately.

export const COOKIE_NAME = 'v2r_session';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

export function getUsers() {
  const raw = (process.env.APP_USERS || '');
  const users = new Map();
  for (const part of raw.split(/[,\n\r]+/)) {
    const line = part.trim();
    const i = line.indexOf(':');
    if (i < 1) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    const pass = line.slice(i + 1).trim();
    if (name && pass) users.set(name, pass);
  }
  return users;
}

function secret() {
  return process.env.SESSION_SECRET || process.env.KV_REST_API_TOKEN || '';
}

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64urlText(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

async function fingerprint(name, pass) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(name + ':' + pass));
  return b64url(new Uint8Array(d)).slice(0, 16);
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns the normalised username if the details are correct, otherwise null.
export function checkPassword(username, password) {
  const name = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  const expected = getUsers().get(name);
  if (expected === undefined) { safeEqual(pass, pass); return null; }
  return safeEqual(pass, expected) ? name : null;
}

export async function createToken(name) {
  if (!secret()) throw new Error('No session secret');
  const pass = getUsers().get(name);
  if (pass === undefined) throw new Error('Unknown user');
  const body = JSON.stringify({ u: name, e: Date.now() + SESSION_DAYS * 86400000, f: await fingerprint(name, pass) });
  const payload = b64url(enc.encode(body));
  return payload + '.' + await hmac(payload);
}

// Returns the username for a valid, unexpired session, otherwise null.
export async function verifyToken(token) {
  try {
    if (!token || !secret()) return null;
    const parts = String(token).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    if (!safeEqual(parts[1], await hmac(parts[0]))) return null;
    const data = JSON.parse(fromB64urlText(parts[0]));
    if (!data || typeof data.u !== 'string' || typeof data.e !== 'number' || data.e < Date.now()) return null;
    const pass = getUsers().get(data.u);
    if (pass === undefined) return null;
    if (data.f !== await fingerprint(data.u, pass)) return null;
    return data.u;
  } catch (e) {
    return null;
  }
}

export function getCookie(header, name) {
  if (!header) return '';
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return ''; }
    }
  }
  return '';
}

export function sessionCookie(token) {
  return COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (SESSION_DAYS * 86400);
}

export function clearCookie() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
