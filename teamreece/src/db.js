// src/db.js — storage for Team Reece.
// Local/dev: a JSON file (no setup).  Production: Postgres when DATABASE_URL / POSTGRES_URL is set
// (Neon's serverless driver for *.neon.tech, the standard `pg` driver for any other Postgres).
// Both modes expose the same async API, so the rest of the app never changes.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const usePostgres = !!PG_URL;
// Vercel's filesystem is read-only, so the JSON fallback can't work there.
export const storageReady = usePostgres || !process.env.VERCEL;

// Allowed statuses per table. Anything not listed here can't be changed or deleted from the admin.
export const TABLES = {
  volunteers: ['new', 'contacted', 'interviewing', 'onboarded', 'active', 'inactive', 'archived'],
  messages: ['new', 'replied', 'archived'],
  subscribers: ['subscribed', 'unsubscribed'],
  rsvps: ['going', 'attended', 'no-show', 'cancelled'],
  events: ['published', 'draft', 'cancelled'],
  field_reports: ['received', 'verified'],
};
export const TEAMS = { hq: 'HQ Office', regional: 'Regional Leadership', organizer: 'Organizers' };

const MEMBER_FIELDS = ['first', 'last', 'email', 'phone', 'zip', 'team', 'role', 'region', 'county', 'help', 'availability', 'hours', 'experience', 'link', 'message', 'notes', 'status'];
const EVENT_FIELDS = ['title', 'type', 'starts_at', 'ends_at', 'location', 'region', 'description', 'capacity', 'status'];
const REPORT_FIELDS = ['name', 'email', 'region', 'event_key', 'event_title', 'report_date', 'doors', 'conversations', 'supporters', 'undecided', 'recruits', 'signs', 'notes'];

const token = () => crypto.randomBytes(18).toString('base64url');
const now = () => new Date().toISOString();
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

let impl;

if (usePostgres) {
  let q;
  if (/\.neon\.tech|neon\.build/.test(PG_URL)) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(PG_URL);
    q = (text, params = []) => (sql.query ? sql.query(text, params) : sql(text, params));
  } else {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: PG_URL, max: 5, ssl: /sslmode=require/.test(PG_URL) ? { rejectUnauthorized: false } : undefined });
    q = async (text, params = []) => (await pool.query(text, params)).rows;
  }
  const one = async (text, params) => (await q(text, params))[0];
  const n = async (text, params) => (await one(text, params)).n;
  // Build "UPDATE t SET a=$1, b=$2 WHERE id=$3" from a whitelisted field object
  const update = (table, id, fields) => {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    return q(`UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1}`, [...keys.map((k) => fields[k]), Number(id)]);
  };

  impl = {
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY, first TEXT, last TEXT, email TEXT, phone TEXT, zip TEXT, region TEXT,
        help TEXT, availability TEXT, message TEXT, status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now())`);
      for (const c of ['team', 'role', 'county', 'hours', 'experience', 'link', 'notes']) await q(`ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS ${c} TEXT`);
      await q(`UPDATE volunteers SET team='organizer' WHERE team IS NULL`);
      await q(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, name TEXT, email TEXT, phone TEXT, zip TEXT, topic TEXT, message TEXT,
        status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY, email TEXT UNIQUE, first TEXT, zip TEXT, source TEXT, token TEXT UNIQUE,
        status TEXT DEFAULT 'subscribed', created_at TIMESTAMPTZ DEFAULT now(), unsubscribed_at TIMESTAMPTZ)`);
      await q(`CREATE TABLE IF NOT EXISTS rsvps (
        id SERIAL PRIMARY KEY, event_key TEXT, event_title TEXT, event_date TEXT, name TEXT, email TEXT,
        guests INT DEFAULT 0, status TEXT DEFAULT 'going', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (event_key, email))`);
      await q(`CREATE TABLE IF NOT EXISTS votes (id SERIAL PRIMARY KEY, pick1 TEXT, pick2 TEXT, pick3 TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS newsletters (
        id SERIAL PRIMARY KEY, subject TEXT, body TEXT, sent_count INT, failed_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY, title TEXT, type TEXT, starts_at TEXT, ends_at TEXT, location TEXT, region TEXT,
        description TEXT, capacity INT, status TEXT DEFAULT 'published', created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS field_reports (
        id SERIAL PRIMARY KEY, name TEXT, email TEXT, region TEXT, event_key TEXT, event_title TEXT, report_date TEXT,
        doors INT DEFAULT 0, conversations INT DEFAULT 0, supporters INT DEFAULT 0, undecided INT DEFAULT 0,
        recruits INT DEFAULT 0, signs INT DEFAULT 0, notes TEXT, status TEXT DEFAULT 'received', created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)`);
    },

    async addMember(v) {
      const f = pick({ status: 'new', ...v }, MEMBER_FIELDS), keys = Object.keys(f);
      await q(`INSERT INTO volunteers (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map((k) => f[k]));
    },
    getMember: (id) => one(`SELECT * FROM volunteers WHERE id=$1`, [Number(id)]),
    updateMember: (id, f) => update('volunteers', id, pick(f, MEMBER_FIELDS)),

    addMessage: (m) => q(`INSERT INTO messages (name,email,phone,zip,topic,message) VALUES ($1,$2,$3,$4,$5,$6)`, [m.name, m.email, m.phone, m.zip, m.topic, m.message]),

    async subscribe({ email, first = '', zip = '', source = 'site' }) {
      const ex = await one(`SELECT * FROM subscribers WHERE email=$1`, [email]);
      if (ex) {
        if (ex.status !== 'subscribed') await q(`UPDATE subscribers SET status='subscribed', unsubscribed_at=NULL WHERE id=$1`, [ex.id]);
        if (first && !ex.first) await q(`UPDATE subscribers SET first=$1 WHERE id=$2`, [first, ex.id]);
        return { isNew: ex.status !== 'subscribed', token: ex.token };
      }
      const t = token();
      await q(`INSERT INTO subscribers (email,first,zip,source,token) VALUES ($1,$2,$3,$4,$5)`, [email, first, zip, source, t]);
      return { isNew: true, token: t };
    },
    unsubscribe: async (t) => (await one(`UPDATE subscribers SET status='unsubscribed', unsubscribed_at=now() WHERE token=$1 RETURNING email`, [t]))?.email || null,
    activeSubscribers: () => q(`SELECT * FROM subscribers WHERE status='subscribed' ORDER BY created_at`),

    async addRsvp(r) {
      const ex = await one(`SELECT id FROM rsvps WHERE event_key=$1 AND email=$2`, [r.event_key, r.email]);
      if (ex) { await q(`UPDATE rsvps SET name=$1, guests=$2, status='going' WHERE id=$3`, [r.name, r.guests, ex.id]); return false; }
      await q(`INSERT INTO rsvps (event_key,event_title,event_date,name,email,guests) VALUES ($1,$2,$3,$4,$5,$6)`, [r.event_key, r.event_title, r.event_date, r.name, r.email, r.guests]);
      return true;
    },
    async rsvpCounts() {
      const rows = await q(`SELECT event_key, (COUNT(*) + COALESCE(SUM(guests),0))::int AS n FROM rsvps WHERE status NOT IN ('cancelled') GROUP BY event_key`);
      return Object.fromEntries(rows.map((r) => [r.event_key, r.n]));
    },
    rsvpFor: async (key, email) => one(`SELECT * FROM rsvps WHERE event_key=$1 AND email=$2`, [key, email]),

    addVote: (p) => q(`INSERT INTO votes (pick1,pick2,pick3) VALUES ($1,$2,$3)`, p),
    async tally() {
      const rows = await q(`SELECT pick, SUM(pts)::int AS score FROM (
          SELECT pick1 AS pick, 3 AS pts FROM votes UNION ALL SELECT pick2, 2 FROM votes UNION ALL SELECT pick3, 1 FROM votes) t GROUP BY pick`);
      return { scores: Object.fromEntries(rows.map((r) => [r.pick, r.score])), voters: await n(`SELECT COUNT(*)::int AS n FROM votes`) };
    },

    addEvent: async (e) => {
      const f = pick(e, EVENT_FIELDS), keys = Object.keys(f);
      return (await one(`INSERT INTO events (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, keys.map((k) => f[k]))).id;
    },
    getEvent: (id) => one(`SELECT * FROM events WHERE id=$1`, [Number(id)]),
    updateEvent: (id, e) => update('events', id, pick(e, EVENT_FIELDS)),
    listEvents: () => q(`SELECT * FROM events ORDER BY starts_at`),

    addReport: (r) => {
      const f = pick(r, REPORT_FIELDS), keys = Object.keys(f);
      return q(`INSERT INTO field_reports (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map((k) => f[k]));
    },

    async kvGet(key, fallback = null) { const r = await one(`SELECT value FROM kv WHERE key=$1`, [key]); return r ? r.value : fallback; },
    kvSet: (key, value) => q(`INSERT INTO kv (key,value,updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()`, [key, JSON.stringify(value)]),

    list: (table) => { if (!TABLES[table]) throw new Error('bad table'); return q(`SELECT * FROM ${table} ORDER BY created_at DESC`); },
    setStatus: (table, id, status) => {
      if (!TABLES[table]?.includes(status)) throw new Error('bad status');
      return q(`UPDATE ${table} SET status=$1 WHERE id=$2`, [status, Number(id)]);
    },
    remove: (table, id) => { if (!TABLES[table]) throw new Error('bad table'); return q(`DELETE FROM ${table} WHERE id=$1`, [Number(id)]); },

    logNewsletter: (x) => q(`INSERT INTO newsletters (subject,body,sent_count,failed_count) VALUES ($1,$2,$3,$4)`, [x.subject, x.body, x.sent_count, x.failed_count]),
    listNewsletters: () => q(`SELECT * FROM newsletters ORDER BY created_at DESC`),

    async counts() {
      return {
        volunteers: await n(`SELECT COUNT(*)::int n FROM volunteers WHERE status NOT IN ('archived','inactive')`),
        volunteersWeek: await n(`SELECT COUNT(*)::int n FROM volunteers WHERE created_at > now() - interval '7 days'`),
        applicants: await n(`SELECT COUNT(*)::int n FROM volunteers WHERE team IN ('hq','regional') AND status IN ('new','contacted','interviewing')`),
        messagesNew: await n(`SELECT COUNT(*)::int n FROM messages WHERE status='new'`),
        messages: await n(`SELECT COUNT(*)::int n FROM messages`),
        subscribers: await n(`SELECT COUNT(*)::int n FROM subscribers WHERE status='subscribed'`),
        subscribersWeek: await n(`SELECT COUNT(*)::int n FROM subscribers WHERE status='subscribed' AND created_at > now() - interval '7 days'`),
        rsvps: await n(`SELECT COUNT(*)::int n FROM rsvps WHERE status<>'cancelled'`),
        votes: await n(`SELECT COUNT(*)::int n FROM votes`),
        doors: await n(`SELECT COALESCE(SUM(doors),0)::int n FROM field_reports`),
      };
    },

    getAdmin: (u) => one(`SELECT * FROM admins WHERE username=$1`, [u]),
    createAdmin: (u, h) => q(`INSERT INTO admins (username,password_hash) VALUES ($1,$2) ON CONFLICT (username) DO UPDATE SET password_hash=$2`, [u, h]),
  };
} else {
  /* ---------------- JSON file (local development) ---------------- */
  const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
  const COLS = ['volunteers', 'messages', 'subscribers', 'rsvps', 'votes', 'newsletters', 'events', 'field_reports', 'admins'];
  const blank = () => ({ ...Object.fromEntries(COLS.map((c) => [c, []])), kv: {}, seq: Object.fromEntries(COLS.map((c) => [c, 0])) });
  const load = () => { try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); const b = blank(); return { ...b, ...d, seq: { ...b.seq, ...d.seq } }; } catch { return blank(); } };
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  const insert = (col, row) => { const d = load(); d.seq[col] = (d.seq[col] || 0) + 1; const id = d.seq[col]; d[col].push({ id, ...row, created_at: now() }); save(d); return id; };
  const find = (col, id) => load()[col].find((r) => r.id === Number(id));
  const patch = (col, id, f) => { const d = load(); const x = d[col].find((r) => r.id === Number(id)); if (x) { Object.assign(x, f); save(d); } };
  const desc = (arr) => arr.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString();
  const num = (v) => Number(v) || 0;

  impl = {
    async init() {
      if (!fs.existsSync(FILE)) return save(blank());
      const d = load(); let changed = false;
      d.volunteers.forEach((v) => { if (!v.team) { v.team = 'organizer'; changed = true; } });
      if (changed) save(d);
    },
    addMember: async (v) => insert('volunteers', pick({ status: 'new', ...v }, MEMBER_FIELDS)),
    getMember: async (id) => find('volunteers', id),
    updateMember: async (id, f) => patch('volunteers', id, pick(f, MEMBER_FIELDS)),
    addMessage: async (m) => insert('messages', { ...m, status: 'new' }),
    async subscribe({ email, first = '', zip = '', source = 'site' }) {
      const d = load(); const ex = d.subscribers.find((s) => s.email === email);
      if (ex) {
        const isNew = ex.status !== 'subscribed';
        ex.status = 'subscribed'; ex.unsubscribed_at = null; if (first && !ex.first) ex.first = first; save(d);
        return { isNew, token: ex.token };
      }
      const t = token(); insert('subscribers', { email, first, zip, source, token: t, status: 'subscribed', unsubscribed_at: null });
      return { isNew: true, token: t };
    },
    async unsubscribe(t) {
      const d = load(); const ex = d.subscribers.find((s) => s.token === t);
      if (!ex) return null; ex.status = 'unsubscribed'; ex.unsubscribed_at = now(); save(d); return ex.email;
    },
    activeSubscribers: async () => load().subscribers.filter((s) => s.status === 'subscribed'),
    async addRsvp(r) {
      const d = load(); const ex = d.rsvps.find((x) => x.event_key === r.event_key && x.email === r.email);
      if (ex) { Object.assign(ex, { name: r.name, guests: r.guests, status: 'going' }); save(d); return false; }
      insert('rsvps', { ...r, status: 'going' }); return true;
    },
    async rsvpCounts() {
      const out = {};
      load().rsvps.filter((r) => r.status !== 'cancelled').forEach((r) => (out[r.event_key] = (out[r.event_key] || 0) + 1 + num(r.guests)));
      return out;
    },
    rsvpFor: async (key, email) => load().rsvps.find((r) => r.event_key === key && r.email === email),
    addVote: async ([pick1, pick2, pick3]) => insert('votes', { pick1, pick2, pick3 }),
    async tally() {
      const votes = load().votes, scores = {};
      for (const v of votes) [[v.pick1, 3], [v.pick2, 2], [v.pick3, 1]].forEach(([k, p]) => (scores[k] = (scores[k] || 0) + p));
      return { scores, voters: votes.length };
    },
    addEvent: async (e) => insert('events', { status: 'published', ...pick(e, EVENT_FIELDS) }),
    getEvent: async (id) => find('events', id),
    updateEvent: async (id, e) => patch('events', id, pick(e, EVENT_FIELDS)),
    listEvents: async () => load().events.slice().sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    addReport: async (r) => insert('field_reports', { status: 'received', ...pick(r, REPORT_FIELDS) }),
    kvGet: async (key, fallback = null) => (key in load().kv ? load().kv[key] : fallback),
    kvSet: async (key, value) => { const d = load(); d.kv[key] = value; save(d); },
    list: async (table) => { if (!TABLES[table]) throw new Error('bad table'); return desc(load()[table]); },
    async setStatus(table, id, status) { if (!TABLES[table]?.includes(status)) throw new Error('bad status'); patch(table, id, { status }); },
    async remove(table, id) { if (!TABLES[table]) throw new Error('bad table'); const d = load(); d[table] = d[table].filter((r) => r.id !== Number(id)); save(d); },
    logNewsletter: async (x) => insert('newsletters', x),
    listNewsletters: async () => desc(load().newsletters),
    async counts() {
      const d = load(), w = weekAgo();
      const subs = d.subscribers.filter((s) => s.status === 'subscribed');
      return {
        volunteers: d.volunteers.filter((v) => !['archived', 'inactive'].includes(v.status)).length,
        volunteersWeek: d.volunteers.filter((v) => v.created_at > w).length,
        applicants: d.volunteers.filter((v) => ['hq', 'regional'].includes(v.team) && ['new', 'contacted', 'interviewing'].includes(v.status)).length,
        messagesNew: d.messages.filter((m) => m.status === 'new').length, messages: d.messages.length,
        subscribers: subs.length, subscribersWeek: subs.filter((s) => s.created_at > w).length,
        rsvps: d.rsvps.filter((r) => r.status !== 'cancelled').length, votes: d.votes.length,
        doors: d.field_reports.reduce((a, r) => a + num(r.doors), 0),
      };
    },
    getAdmin: async (u) => load().admins.find((a) => a.username === u),
    async createAdmin(u, h) { const d = load(); const ex = d.admins.find((a) => a.username === u); if (ex) { ex.password_hash = h; save(d); } else insert('admins', { username: u, password_hash: h }); },
  };
}

export default impl;
