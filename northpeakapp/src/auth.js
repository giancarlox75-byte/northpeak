// src/auth.js — minimal, dependency-light session auth.
// Signed cookie (HMAC-SHA256) holds the username + expiry. No DB session table needed.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as cookie from 'cookie';
import db from './db.js';

const COOKIE = 'np_session';
const MAXAGE = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET missing or too short — set it in your environment (32+ random chars).');
  }
  return s;
}

function sign(value) {
  const h = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  return `${value}.${h}`;
}

function verify(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = sign(value);
  // constant-time compare
  if (expected.length !== signed.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signed))) return null;
  const [username, exp] = value.split('|');
  if (!exp || Date.now() > Number(exp)) return null;
  return { username };
}

export function makeSessionCookie(username) {
  const value = `${username}|${Date.now() + MAXAGE * 1000}`;
  return cookie.serialize(COOKIE, sign(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAXAGE,
  });
}

export function clearSessionCookie() {
  return cookie.serialize(COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 0,
  });
}

export function getSession(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  return verify(cookies[COOKIE]);
}

export async function checkLogin(username, password) {
  const admin = await db.getAdmin(username);
  if (!admin) {
    // run a dummy hash to reduce timing oracle on username existence
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv');
    return false;
  }
  return bcrypt.compare(password, admin.password_hash);
}

export function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) {
    if (req.headers.accept?.includes('text/html')) return res.redirect('/admin/login');
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = s;
  next();
}
