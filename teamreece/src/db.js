// src/db.js — storage for Team Reece.
// Local/dev: a JSON file (no setup).  Production: Postgres (Neon) when DATABASE_URL / POSTGRES_URL is set.
// Both modes expose the same async API, so the rest of the app never changes.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const usePostgres = !!PG_URL;
// Vercel's filesystem is read-only, so the JSON fallback can't work there.
export const storageReady = usePostgres || !process.env.VERCEL;

// Tables the admin may change status on / delete from. Never interpolate anything else.
export const TABLES = {
  volunteers: ['new', 'contacted', 'active', 'archived'],
  messages: ['new', 'replied', 'archived'],
  subscribers: ['subscribed', 'unsubscribed'],
  rsvps: ['going', 'attended', 'cancelled'],
};

const token = () => crypto.randomBytes(18).toString('base64url');
const now = () => new Date().toISOString();

let impl;

if (usePostgres) {
  // Neon: serverless HTTP driver (ideal on Vercel). Any other Postgres: the standard `pg` driver.
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

  impl = {
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY, first TEXT, last TEXT, email TEXT, phone TEXT, zip TEXT, region TEXT,
        help TEXT, availability TEXT, message TEXT, status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, name TEXT, email TEXT, phone TEXT, zip TEXT, topic TEXT, message TEXT,
        status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY, email TEXT UNIQUE, first TEXT, zip TEXT, source TEXT, token TEXT UNIQUE,
        status TEXT DEFAULT 'subscribed', created_at TIMESTAMPTZ DEFAULT now(), unsubscribed_at TIMESTAMPTZ)`);
      await q(`CREATE TABLE IF NOT EXISTS rsvps (
        id SERIAL PRIMARY KEY, event_key TEXT, event_title TEXT, event_date TEXT, name TEXT, email TEXT,
        guests INT DEFAULT 0, status TEXT DEFAULT 'going', created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (event_key, email))`);
      await q(`CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY, pick1 TEXT, pick2 TEXT, pick3 TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS newsletters (
        id SERIAL PRIMARY KEY, subject TEXT, body TEXT, sent_count INT, failed_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)`);
    },

    addVolunteer: (v) => q(`INSERT INTO volunteers (first,last,email,phone,zip,region,help,availability,message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [v.first, v.last, v.email, v.phone, v.zip, v.region, v.help, v.availability, v.message]),
    addMessage: (m) => q(`INSERT INTO messages (name,email,phone,zip,topic,message) VALUES ($1,$2,$3,$4,$5,$6)`,
      [m.name, m.email, m.phone, m.zip, m.topic, m.message]),

    async subscribe({ email, first = '', zip = '', source = 'site' }) {
      const ex = (await q(`SELECT * FROM subscribers WHERE email=$1`, [email]))[0];
      if (ex) {
        if (ex.status !== 'subscribed') await q(`UPDATE subscribers SET status='subscribed', unsubscribed_at=NULL WHERE id=$1`, [ex.id]);
        if (first && !ex.first) await q(`UPDATE subscribers SET first=$1 WHERE id=$2`, [first, ex.id]);
        return { isNew: ex.status !== 'subscribed', token: ex.token };
      }
      const t = token();
      await q(`INSERT INTO subscribers (email,first,zip,source,token) VALUES ($1,$2,$3,$4,$5)`, [email, first, zip, source, t]);
      return { isNew: true, token: t };
    },
    async unsubscribe(t) {
      const r = await q(`UPDATE subscribers SET status='unsubscribed', unsubscribed_at=now() WHERE token=$1 RETURNING email`, [t]);
      return r[0]?.email || null;
    },
    activeSubscribers: () => q(`SELECT * FROM subscribers WHERE status='subscribed' ORDER BY created_at`),

    async addRsvp(r) {
      const ex = (await q(`SELECT id FROM rsvps WHERE event_key=$1 AND email=$2`, [r.event_key, r.email]))[0];
      if (ex) { await q(`UPDATE rsvps SET name=$1, guests=$2, status='going' WHERE id=$3`, [r.name, r.guests, ex.id]); return false; }
      await q(`INSERT INTO rsvps (event_key,event_title,event_date,name,email,guests) VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.event_key, r.event_title, r.event_date, r.name, r.email, r.guests]);
      return true;
    },

    addVote: (p) => q(`INSERT INTO votes (pick1,pick2,pick3) VALUES ($1,$2,$3)`, p),
    async tally() {
      const rows = await q(`SELECT pick, SUM(pts)::int AS score FROM (
          SELECT pick1 AS pick, 3 AS pts FROM votes UNION ALL
          SELECT pick2, 2 FROM votes UNION ALL SELECT pick3, 1 FROM votes) t GROUP BY pick`);
      const voters = (await q(`SELECT COUNT(*)::int AS n FROM votes`))[0].n;
      return { scores: Object.fromEntries(rows.map((r) => [r.pick, r.score])), voters };
    },

    list: (table) => { if (!TABLES[table]) throw new Error('bad table'); return q(`SELECT * FROM ${table} ORDER BY created_at DESC`); },
    setStatus: (table, id, status) => {
      if (!TABLES[table]?.includes(status)) throw new Error('bad status');
      return q(`UPDATE ${table} SET status=$1 WHERE id=$2`, [status, Number(id)]);
    },
    remove: (table, id) => { if (!TABLES[table]) throw new Error('bad table'); return q(`DELETE FROM ${table} WHERE id=$1`, [Number(id)]); },

    logNewsletter: (n) => q(`INSERT INTO newsletters (subject,body,sent_count,failed_count) VALUES ($1,$2,$3,$4)`,
      [n.subject, n.body, n.sent_count, n.failed_count]),
    listNewsletters: () => q(`SELECT * FROM newsletters ORDER BY created_at DESC`),

    async counts() {
      const one = async (s) => (await q(s))[0].n;
      return {
        volunteers: await one(`SELECT COUNT(*)::int n FROM volunteers`),
        volunteersWeek: await one(`SELECT COUNT(*)::int n FROM volunteers WHERE created_at > now() - interval '7 days'`),
        messagesNew: await one(`SELECT COUNT(*)::int n FROM messages WHERE status='new'`),
        messages: await one(`SELECT COUNT(*)::int n FROM messages`),
        subscribers: await one(`SELECT COUNT(*)::int n FROM subscribers WHERE status='subscribed'`),
        subscribersWeek: await one(`SELECT COUNT(*)::int n FROM subscribers WHERE status='subscribed' AND created_at > now() - interval '7 days'`),
        rsvps: await one(`SELECT COUNT(*)::int n FROM rsvps WHERE status<>'cancelled'`),
        votes: await one(`SELECT COUNT(*)::int n FROM votes`),
      };
    },

    getAdmin: async (u) => (await q(`SELECT * FROM admins WHERE username=$1`, [u]))[0],
    createAdmin: (u, h) => q(`INSERT INTO admins (username,password_hash) VALUES ($1,$2)
      ON CONFLICT (username) DO UPDATE SET password_hash=$2`, [u, h]),
    adminCount: async () => (await q(`SELECT COUNT(*)::int n FROM admins`))[0].n,
  };
} else {
  /* ---------------- JSON file (local development) ---------------- */
  const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
  const COLS = ['volunteers', 'messages', 'subscribers', 'rsvps', 'votes', 'newsletters', 'admins'];
  const blank = () => ({ ...Object.fromEntries(COLS.map((c) => [c, []])), seq: Object.fromEntries(COLS.map((c) => [c, 0])) });
  const load = () => { try { return { ...blank(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { return blank(); } };
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  const insert = (col, row) => { const d = load(); d.seq[col] = (d.seq[col] || 0) + 1; d[col].push({ id: d.seq[col], ...row, created_at: now() }); save(d); };
  const desc = (arr) => arr.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString();

  impl = {
    async init() { if (!fs.existsSync(FILE)) save(blank()); },
    addVolunteer: async (v) => insert('volunteers', { ...v, status: 'new' }),
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
    addVote: async ([pick1, pick2, pick3]) => insert('votes', { pick1, pick2, pick3 }),
    async tally() {
      const votes = load().votes, scores = {};
      for (const v of votes) [[v.pick1, 3], [v.pick2, 2], [v.pick3, 1]].forEach(([k, p]) => (scores[k] = (scores[k] || 0) + p));
      return { scores, voters: votes.length };
    },
    list: async (table) => { if (!TABLES[table]) throw new Error('bad table'); return desc(load()[table]); },
    async setStatus(table, id, status) {
      if (!TABLES[table]?.includes(status)) throw new Error('bad status');
      const d = load(); const x = d[table].find((r) => r.id === Number(id)); if (x) { x.status = status; save(d); }
    },
    async remove(table, id) {
      if (!TABLES[table]) throw new Error('bad table');
      const d = load(); d[table] = d[table].filter((r) => r.id !== Number(id)); save(d);
    },
    logNewsletter: async (n) => insert('newsletters', n),
    listNewsletters: async () => desc(load().newsletters),
    async counts() {
      const d = load(), w = weekAgo();
      const subs = d.subscribers.filter((s) => s.status === 'subscribed');
      return {
        volunteers: d.volunteers.length, volunteersWeek: d.volunteers.filter((v) => v.created_at > w).length,
        messagesNew: d.messages.filter((m) => m.status === 'new').length, messages: d.messages.length,
        subscribers: subs.length, subscribersWeek: subs.filter((s) => s.created_at > w).length,
        rsvps: d.rsvps.filter((r) => r.status !== 'cancelled').length, votes: d.votes.length,
      };
    },
    getAdmin: async (u) => load().admins.find((a) => a.username === u),
    async createAdmin(u, h) {
      const d = load(); const ex = d.admins.find((a) => a.username === u);
      if (ex) { ex.password_hash = h; save(d); } else insert('admins', { username: u, password_hash: h });
    },
    adminCount: async () => load().admins.length,
  };
}

export default impl;
