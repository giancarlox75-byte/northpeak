// End-to-end tests for the Team Reece backend.  Run: npm test
// Set TEST_DATABASE_URL to run the same suite against a real Postgres database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { REGIONS } from '../src/regions.js';

const DATA = path.join(os.tmpdir(), `teamreece-test-${process.pid}.json`);
const PG = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.DATA_FILE = DATA;
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret';
process.env.SETUP_KEY = 'setup-key-123';
delete process.env.POSTGRES_URL; delete process.env.RESEND_API_KEY;
if (PG) process.env.DATABASE_URL = PG; else delete process.env.DATABASE_URL;

let server, census, base, cookie = '', pool;
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const form = (p, body, extra = {}) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Origin: base, ...extra }, body: new URLSearchParams(body) });
const get = (p) => fetch(base + p, { redirect: 'manual', headers: { Cookie: cookie } });
async function rows(table) {
  if (!PG) return JSON.parse(fs.readFileSync(DATA, 'utf8'))[table];
  return (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
}
const future = (days, hh = '10:00') => { const d = new Date(Date.now() + days * 864e5); return `${d.toISOString().slice(0, 10)}T${hh}`; };

before(async () => {
  if (PG) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: PG });
    for (const t of ['volunteers', 'messages', 'subscribers', 'rsvps', 'votes', 'newsletters', 'events', 'field_reports', 'kv', 'admins']) await pool.query(`DROP TABLE IF EXISTS ${t}`);
  }
  // Stand-in for the Census API: one row per county, population = 1000 + index (test data only)
  const names = REGIONS.flatMap((r) => r.counties).sort();
  census = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([['NAME', 'P1_001N', 'state', 'county'], ...names.map((n, i) => [`${n} County, Michigan`, String(1000 + i), '26', String(i * 2 + 1).padStart(3, '0')])]));
  });
  await new Promise((r) => census.listen(0, r));
  process.env.CENSUS_URL = `http://127.0.0.1:${census.address().port}/data/2020/dec/pl`;
  const { default: app } = await import('../server.js');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); server.close(); census.close(); fs.rmSync(DATA, { force: true }); if (pool) await pool.end(); });

test('site, privacy page and generated data are served', async () => {
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/privacy')).status, 200);
  assert.equal((await get('/data/michigan-map.js')).status, 200);
  assert.equal((await get('/data/team.js')).status, 200);
  assert.equal((await get('/nope')).status, 404);
  assert.equal((await (await get('/api/health')).json()).storage, PG ? 'postgres' : 'file');
});

test('regions cover all 83 counties exactly once', () => {
  const all = REGIONS.flatMap((r) => r.counties);
  assert.equal(REGIONS.length, 10);
  assert.equal(all.length, 83);
  assert.equal(new Set(all).size, 83);
});

test('census endpoint sums counties into regions', async () => {
  const c = await (await get('/api/census')).json();
  assert.equal(Object.keys(c.counties).length, 83);
  const regionTotal = Object.values(c.regions).reduce((a, b) => a + b, 0);
  assert.equal(regionTotal, c.total);
  assert.match(c.source.label, /2020 Census/);
});

test('organizer sign-up saves with team, region and county, and subscribes', async () => {
  assert.equal((await post('/api/volunteer', { first: 'A', last: 'B', email: 'nope', zip: '48503' })).status, 400);
  const r = await post('/api/volunteer', { team: 'organizer', roles: ['canvasser', 'phone-bank', 'bogus'], first: 'Ann', last: 'Lee', email: 'Ann@Example.com', zip: '48503', region: 'east', county: 'Genesee', when: ['Weekends'], updates: true });
  assert.equal(r.status, 200);
  const v = (await rows('volunteers'))[0];
  assert.equal(v.email, 'ann@example.com'); assert.equal(v.team, 'organizer'); assert.equal(v.role, 'canvasser; phone-bank');
  assert.equal(v.help, 'Door Knocking (Canvassing); Phone & Text Banking'); assert.equal(v.county, 'Genesee');
  assert.equal((await rows('subscribers'))[0].source, 'organizer');
});

test('HQ and regional applications are validated', async () => {
  const base = { first: 'Maria', last: 'Lopez', email: 'maria@example.com', phone: '2695550100', zip: '49008' };
  assert.equal((await post('/api/volunteer', { ...base, team: 'hq', experience: 'Lots of experience running campaigns.' })).status, 400, 'role required');
  assert.equal((await post('/api/volunteer', { ...base, team: 'regional', roles: ['regional-director'], experience: 'Lots of experience running campaigns.' })).status, 400, 'region required');
  assert.equal((await post('/api/volunteer', { ...base, team: 'hq', roles: ['communications'], experience: 'short' })).status, 400, 'experience required');
  const ok = await (await post('/api/volunteer', { ...base, team: 'regional', roles: ['regional-director'], region: 'southwest', county: 'Wayne', experience: 'Organized students at WMU for three years.', hours: '10–20', link: 'javascript:alert(1)' })).json();
  assert.equal(ok.application, true);
  const m = (await rows('volunteers')).find((x) => x.email === 'maria@example.com');
  assert.equal(m.team, 'regional'); assert.equal(m.region, 'southwest');
  assert.equal(m.county, '', 'county must belong to the region'); assert.equal(m.link, '', 'only http(s) links are stored');
});

test('honeypot silently drops bots', async () => {
  assert.equal((await post('/api/contact', { name: 'Bot', email: 'b@b.co', message: 'spam', website: 'http://spam' })).status, 200);
  assert.equal((await rows('messages')).length, 0);
});

test('contact message saves', async () => {
  assert.equal((await post('/api/contact', { name: 'Joe', email: 'joe@x.co', message: '' })).status, 400);
  assert.equal((await post('/api/contact', { name: 'Joe Smith', email: 'joe@x.co', topic: 'Event invitation', message: 'Come to our block party!', zip: '49008' })).status, 200);
  assert.equal((await rows('messages'))[0].topic, 'Event invitation');
});

test('newsletter subscribe is idempotent, unsubscribe works', async () => {
  const a = await (await post('/api/newsletter', { email: 'news@x.co' })).json();
  const b = await (await post('/api/newsletter', { email: 'NEWS@x.co' })).json();
  assert.equal(a.already, false); assert.equal(b.already, true);
  const sub = (await rows('subscribers')).find((s) => s.email === 'news@x.co');
  assert.equal((await get(`/unsubscribe?t=${sub.token}`)).status, 200);
  assert.equal((await rows('subscribers')).find((s) => s.email === 'news@x.co').status, 'subscribed', 'GET must not unsubscribe');
  assert.match(await (await fetch(`${base}/unsubscribe?t=${sub.token}`, { method: 'POST' })).text(), /unsubscribed/);
  assert.equal((await rows('subscribers')).find((s) => s.email === 'news@x.co').status, 'unsubscribed');
});

test('priorities poll validates and tallies', async () => {
  assert.equal((await post('/api/priorities', { picks: ['ai', 'ai', 'jobs'] })).status, 400);
  const t = await (await post('/api/priorities', { picks: ['ai', 'housing', 'schools'] })).json();
  assert.equal(t.voters, 1); assert.equal(t.scores.ai, 3); assert.equal(t.scores.schools, 1);
});

test('admin: protected, setup, login', async () => {
  assert.equal((await get('/admin')).status, 401);
  assert.equal((await get('/setup?key=wrong')).status, 403);
  assert.match(await (await form('/setup', { key: 'setup-key-123', user: 'kevin', pass: 'longpassword1' })).text(), /created/);
  assert.match(await (await form('/admin/login', { username: 'kevin', password: 'wrong-password' })).text(), /Invalid/);
  const login = await form('/admin/login', { username: 'kevin', password: 'longpassword1' });
  assert.equal(login.status, 302);
  cookie = login.headers.get('set-cookie').split(';')[0];
  for (const p of ['/admin', '/admin/messages', '/admin/team', '/admin/events', '/admin/field', '/admin/newsletter', '/admin/playbook', '/admin/priorities']) {
    assert.equal((await get(p)).status, 200, p);
  }
});

test('team: org chart shows a regional director once onboarded', async () => {
  const m = (await rows('volunteers')).find((x) => x.email === 'maria@example.com');
  assert.doesNotMatch(await (await get('/admin/team')).text(), /Maria Lopez<\/a><\/td>/);
  await form(`/admin/team/${m.id}`, { team: 'regional', role: 'regional-director', region: 'southwest', county: 'Kalamazoo', status: 'onboarded', notes: 'Great interview' });
  const updated = (await rows('volunteers')).find((x) => x.id === m.id);
  assert.equal(updated.status, 'onboarded'); assert.equal(updated.county, 'Kalamazoo'); assert.equal(updated.notes, 'Great interview');
  assert.match(await (await get('/admin/team')).text(), /Maria Lopez<\/a><\/td>/);
  assert.equal((await get(`/admin/team/${m.id}`)).status, 200);
});

test('events: create shift, public listing, capacity enforced', async () => {
  const bad = await form('/admin/events', { title: '', starts_at: 'x' });
  assert.match(decodeURIComponent(bad.headers.get('location')), /Add a title/);
  const res = await form('/admin/events', { title: 'Saturday Canvass', type: 'Canvass', region: 'east', starts_at: future(5), ends_at: future(5, '13:00'), location: 'Flint, MI', capacity: '3', status: 'published' });
  const id = /events\/(\d+)/.exec(res.headers.get('location'))[1];
  await form('/admin/events', { title: 'Hidden draft', type: 'Other', starts_at: future(6), status: 'draft' });
  await form('/admin/events', { title: 'Last month', type: 'Rally', starts_at: '2020-01-01T10:00', status: 'published' });
  const { events } = await (await get('/api/events')).json();
  assert.deepEqual(events.map((e) => e.title), ['Saturday Canvass'], 'only upcoming published events');
  assert.equal(events[0].spots_left, 3);
  const key = `ev:${id}`;
  assert.equal((await post('/api/rsvp', { event_key: 'ev:9999', name: 'A', email: 'a@x.co' })).status, 404);
  assert.equal((await (await post('/api/rsvp', { event_key: key, name: 'Ann', email: 'ann@example.com', guests: 1 })).json()).updated, false);
  assert.equal((await (await post('/api/rsvp', { event_key: key, name: 'Ann', email: 'ann@example.com', guests: 2 })).json()).updated, true, 'same person updates, not double counts');
  assert.equal((await post('/api/rsvp', { event_key: key, name: 'Bo', email: 'bo@x.co' })).status, 409, 'full');
  assert.equal((await (await get('/api/events')).json()).events[0].spots_left, 0);
  assert.equal((await rows('rsvps'))[0].event_title, 'Saturday Canvass', 'title comes from the server, not the client');
  assert.match(await (await get(`/admin/events/${id}`)).text(), /Ann/);
});

test('field: portal closed until code set, then reports count toward goals', async () => {
  assert.match(await (await get('/team')).text(), /isn't open yet/);
  await form('/admin/field/settings', { team_code: 'flint-strong-26', goal_east: '5000' });
  const wrong = await form('/team', { code: 'nope', name: 'Sam', email: 'sam@x.co', region: 'east', doors: '10' });
  assert.match(await wrong.text(), /not right/);
  const ok = await form('/team', { code: 'FLINT-STRONG-26 ', name: 'Sam', email: 'sam@x.co', region: 'east', doors: '64', conversations: '21', supporters: '12' });
  assert.match(await ok.text(), /Report filed/);
  const r = (await rows('field_reports'))[0];
  assert.equal(Number(r.doors), 64); assert.equal(r.region, 'east');
  assert.match(await (await get('/admin/field')).text(), /1% of 5,000/);
});

test('playbook: toggle a step', async () => {
  await form('/admin/playbook/committee', { done: '1' });
  assert.match(await (await get('/admin/playbook')).text(), /Done .* by kevin/);
  assert.equal((await form('/admin/playbook/not-a-step', { done: '1' })).status, 404);
});

test('admin actions: status, CSV, delete, cross-site blocked', async () => {
  const id = (await rows('messages'))[0].id;
  await form(`/admin/messages/${id}/status`, { status: 'replied' });
  assert.equal((await rows('messages'))[0].status, 'replied');
  assert.match(await (await get('/admin/export/volunteers.csv?team=regional')).text(), /maria@example.com/);
  assert.doesNotMatch(await (await get('/admin/export/volunteers.csv?team=organizer')).text(), /maria@example.com/);
  assert.equal((await get('/admin/export/admins.csv')).status, 404, 'admins table must never export');
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
  assert.match(await (await get('/admin/export/messages.csv')).text(), /"'=HYPERLINK/);
});
