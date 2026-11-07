// End-to-end tests for the Team Reece backend (JSON-file storage).  Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DATA = path.join(os.tmpdir(), `teamreece-test-${process.pid}.json`);
process.env.NODE_ENV = 'test';
process.env.DATA_FILE = DATA;
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
process.env.SETUP_KEY = 'setup-key-123';
delete process.env.POSTGRES_URL; delete process.env.RESEND_API_KEY;
// Set TEST_DATABASE_URL to run the same suite against a real Postgres database.
const PG = process.env.TEST_DATABASE_URL;
if (PG) process.env.DATABASE_URL = PG; else delete process.env.DATABASE_URL;

let server, base, cookie = '';
const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const form = (p, body) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Origin: base }, body: new URLSearchParams(body) });
const get = (p) => fetch(base + p, { redirect: 'manual', headers: { Cookie: cookie } });
let pool;
async function rows(table) {
  if (!PG) return JSON.parse(fs.readFileSync(DATA, 'utf8'))[table];
  return (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
}

before(async () => {
  if (PG) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: PG });
    for (const t of ['volunteers', 'messages', 'subscribers', 'rsvps', 'votes', 'newsletters', 'admins']) await pool.query(`DROP TABLE IF EXISTS ${t}`);
  }
  const { default: app } = await import('../server.js');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); server.close(); fs.rmSync(DATA, { force: true }); if (pool) await pool.end(); });

test('site and privacy page are served', async () => {
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/privacy')).status, 200);
  assert.equal((await get('/nope')).status, 404);
  assert.equal((await (await get('/api/health')).json()).storage, PG ? 'postgres' : 'file');
});

test('volunteer sign-up saves and subscribes', async () => {
  const bad = await post('/api/volunteer', { first: 'A', last: 'B', email: 'nope', zip: '48503' });
  assert.equal(bad.status, 400);
  const r = await post('/api/volunteer', { first: 'Ann', last: 'Lee', email: 'Ann@Example.com', zip: '48503', region: 'bay', help: ['Door knocking', 'Social media'], when: ['Weekends'], message: 'Hi', updates: true });
  assert.equal(r.status, 200);
  const vols = await rows('volunteers'), subs = await rows('subscribers');
  assert.equal(vols.length, 1);
  assert.equal(vols[0].email, 'ann@example.com');
  assert.equal(vols[0].help, 'Door knocking; Social media');
  assert.equal(subs[0].source, 'volunteer');
});

test('honeypot silently drops bots', async () => {
  const r = await post('/api/contact', { name: 'Bot', email: 'b@b.co', message: 'spam', website: 'http://spam' });
  assert.equal(r.status, 200);
  assert.equal((await rows('messages')).length, 0);
});

test('contact message saves', async () => {
  assert.equal((await post('/api/contact', { name: 'Joe', email: 'joe@x.co', message: '' })).status, 400);
  const r = await post('/api/contact', { name: 'Joe Smith', email: 'joe@x.co', topic: 'Event invitation', message: 'Come to our block party!', zip: '49008' });
  assert.equal(r.status, 200);
  assert.equal((await rows('messages'))[0].topic, 'Event invitation');
});

test('newsletter subscribe is idempotent, unsubscribe works', async () => {
  const a = await (await post('/api/newsletter', { email: 'news@x.co' })).json();
  const b = await (await post('/api/newsletter', { email: 'NEWS@x.co' })).json();
  assert.equal(a.already, false); assert.equal(b.already, true);
  const sub = (await rows('subscribers')).find((s) => s.email === 'news@x.co');
  assert.equal((await get(`/unsubscribe?t=${sub.token}`)).status, 200);
  assert.equal((await rows('subscribers')).find((s) => s.email === 'news@x.co').status, 'subscribed', 'GET must not unsubscribe');
  const u = await fetch(`${base}/unsubscribe?t=${sub.token}`, { method: 'POST' });
  assert.match(await u.text(), /unsubscribed/);
  assert.equal((await rows('subscribers')).find((s) => s.email === 'news@x.co').status, 'unsubscribed');
});

test('RSVP dedupes per event + email', async () => {
  const ev = { event_key: 'Kickoff2026', event_title: 'Kickoff', event_date: '2026-12-06T18:00', name: 'Ann', email: 'ann@example.com', guests: 2 };
  assert.equal((await (await post('/api/rsvp', ev)).json()).updated, false);
  assert.equal((await (await post('/api/rsvp', { ...ev, guests: 3 })).json()).updated, true);
  assert.equal((await rows('rsvps')).length, 1); assert.equal((await rows('rsvps'))[0].guests, 3);
});

test('priorities poll validates and tallies', async () => {
  assert.equal((await post('/api/priorities', { picks: ['ai', 'ai', 'jobs'] })).status, 400);
  const t = await (await post('/api/priorities', { picks: ['ai', 'housing', 'schools'] })).json();
  assert.equal(t.voters, 1); assert.equal(t.scores.ai, 3); assert.equal(t.scores.schools, 1);
  assert.equal((await (await get('/api/priorities')).json()).scores.housing, 2);
});

test('admin: protected, setup, login, views, status, CSV', async () => {
  assert.equal((await get('/admin')).status, 401);
  assert.equal((await get('/setup?key=wrong')).status, 403);
  const s = await form('/setup', { key: 'setup-key-123', user: 'kevin', pass: 'longpassword1' });
  assert.match(await s.text(), /created/);
  const badLogin = await form('/admin/login', { username: 'kevin', password: 'wrong-password' });
  assert.match(await badLogin.text(), /Invalid/);
  const login = await form('/admin/login', { username: 'kevin', password: 'longpassword1' });
  assert.equal(login.status, 302);
  cookie = login.headers.get('set-cookie').split(';')[0];
  for (const p of ['/admin', '/admin/messages', '/admin/volunteers', '/admin/newsletter', '/admin/rsvps', '/admin/priorities']) {
    const r = await get(p); assert.equal(r.status, 200, p);
  }
  assert.match(await (await get('/admin/messages')).text(), /block party/);
  const id = (await rows('messages'))[0].id;
  await form(`/admin/messages/${id}/status`, { status: 'replied' });
  assert.equal((await rows('messages'))[0].status, 'replied');
  const csv = await (await get('/admin/export/volunteers.csv')).text();
  assert.match(csv, /ann@example.com/);
  assert.equal((await get('/admin/export/admins.csv')).status, 404, 'admins table must never export');
  // cross-site post is blocked
  const xs = await fetch(`${base}/admin/messages/${id}/delete`, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://evil.example' } });
  assert.equal(xs.status, 403);
  await form(`/admin/messages/${id}/delete`, {});
  assert.equal((await rows('messages')).length, 0);
});

test('newsletter send without email configured explains why', async () => {
  const r = await form('/admin/newsletter/send', { subject: 'Hi', body: 'Update', confirm: 'SEND' });
  assert.match(decodeURIComponent(r.headers.get('location')), /Email is not set up/);
});

test('CSV escapes spreadsheet formulas', async () => {
  await post('/api/contact', { name: '=HYPERLINK("x")', email: 'f@x.co', message: 'test' });
  const csv = await (await get('/admin/export/messages.csv')).text();
  assert.match(csv, /"'=HYPERLINK/);
});
