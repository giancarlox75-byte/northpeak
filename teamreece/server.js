// server.js — Team Reece: campaign site + form backend + admin dashboard.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import db, { usePostgres, storageReady, TABLES } from './src/db.js';
import { makeSessionCookie, clearSessionCookie, checkLogin, requireAuth, getSession, sameOrigin } from './src/auth.js';
import { notify, confirm, sendNewsletter, mailEnabled } from './src/mail.js';
import * as V from './views/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => { req.body ??= {}; next(); });
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

if (storageReady) await db.init();
else console.error('⚠ No DATABASE_URL set on Vercel: form entries cannot be saved. Attach a Neon Postgres database.');

const siteUrl = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

/* =========================================================================
   Helpers
   ========================================================================= */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const cleanEmail = (v) => clean(v, 200).toLowerCase();
const list = (v, max = 400) => clean(Array.isArray(v) ? v.join('; ') : v, max);

// Small in-memory rate limiter: `max` requests per minute per IP per bucket.
const hits = new Map();
const rateLimit = (bucket, max = 8) => (req, res, next) => {
  const key = `${bucket}:${req.ip}`, t = Date.now();
  const rec = hits.get(key) || { n: 0, start: t };
  if (t - rec.start > 60_000) { rec.n = 0; rec.start = t; }
  rec.n++; hits.set(key, rec);
  if (hits.size > 5000) for (const [k, r] of hits) if (t - r.start > 60_000) hits.delete(k);
  if (rec.n > max) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  next();
};

// Every public form posts JSON through this wrapper: honeypot, storage check, error handling.
const handle = (fn) => async (req, res) => {
  if (req.body?.website) return res.json({ ok: true }); // honeypot: hidden field only bots fill in
  if (!storageReady) return res.status(503).json({ error: 'Sign-ups are temporarily unavailable. Please email us instead.' });
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json({ ok: true, ...(out || {}) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
};
const bad = (message) => Object.assign(new Error(message), { status: 400 });

/* =========================================================================
   Public API
   ========================================================================= */
app.get('/api/health', (req, res) => res.json({ ok: true, storage: usePostgres ? 'postgres' : storageReady ? 'file' : 'none', email: mailEnabled() }));

// Volunteer sign-up (3-step Join form)
app.post('/api/volunteer', rateLimit('volunteer', 5), handle(async (req) => {
  const b = req.body;
  const v = {
    first: clean(b.first, 80), last: clean(b.last, 80), email: cleanEmail(b.email), phone: clean(b.phone, 40),
    zip: clean(b.zip, 10), region: clean(b.region, 40), help: list(b.help), availability: list(b.when),
    message: clean(b.message, 3000),
  };
  if (!v.first || !v.last) throw bad('Please enter your first and last name.');
  if (!EMAIL_RE.test(v.email)) throw bad('Please enter a valid email address.');
  if (!/^\d{5}$/.test(v.zip)) throw bad('Please enter a 5-digit ZIP code.');
  await db.addVolunteer(v);
  if (b.updates !== false && b.updates !== 'false') await db.subscribe({ email: v.email, first: v.first, zip: v.zip, source: 'volunteer' });
  notify(`New volunteer: ${v.first} ${v.last}`, [
    `Name: ${v.first} ${v.last}`, `Email: ${v.email}`, v.phone && `Phone: ${v.phone}`, `ZIP: ${v.zip}`, `Region: ${v.region || '-'}`,
    `Wants to help with: ${v.help || '-'}`, `Available: ${v.availability || '-'}`, v.message && `\nMessage:\n${v.message}`,
  ], v.email);
  confirm(v.email, 'Welcome to Team Reece!', `Hi ${v.first},\n\nThank you for joining Team Reece. Someone from the team will reach out soon about how you can help.\n\nThe movement starts here.\n— Kevin Reece`);
}));

// Comments, questions, invitations, press inquiries
const TOPICS = ['Comment', 'Question', 'Event invitation', 'Press / media', 'Volunteer question', 'Other'];
app.post('/api/contact', rateLimit('contact', 5), handle(async (req) => {
  const b = req.body;
  const m = {
    name: clean(b.name, 120), email: cleanEmail(b.email), phone: clean(b.phone, 40), zip: clean(b.zip, 10),
    topic: TOPICS.includes(b.topic) ? b.topic : 'Other', message: clean(b.message, 5000),
  };
  if (!m.name) throw bad('Please enter your name.');
  if (!EMAIL_RE.test(m.email)) throw bad('Please enter a valid email address.');
  if (m.message.length < 2) throw bad('Please write a message.');
  await db.addMessage(m);
  if (b.updates === true || b.updates === 'true') await db.subscribe({ email: m.email, first: m.name.split(' ')[0], zip: m.zip, source: 'contact' });
  notify(`${m.topic} from ${m.name}`, [`From: ${m.name} <${m.email}>`, m.phone && `Phone: ${m.phone}`, m.zip && `ZIP: ${m.zip}`, `Topic: ${m.topic}`, `\n${m.message}`], m.email);
  confirm(m.email, 'We got your message', `Hi ${m.name.split(' ')[0]},\n\nThanks for reaching out to Team Reece. We read every message, and we'll get back to you soon.\n\n— Team Reece`);
}));

// Newsletter sign-up
app.post('/api/newsletter', rateLimit('newsletter', 6), handle(async (req) => {
  const email = cleanEmail(req.body.email);
  if (!EMAIL_RE.test(email)) throw bad('Please enter a valid email address.');
  const { isNew, token } = await db.subscribe({ email, first: clean(req.body.first, 80), zip: clean(req.body.zip, 10), source: clean(req.body.source, 40) || 'newsletter' });
  if (isNew) {
    notify(`New subscriber: ${email}`, [`Email: ${email}`, `Source: ${req.body.source || 'newsletter'}`]);
    confirm(email, "You're subscribed to Team Reece updates", `Thanks for signing up! You'll get campaign news, events, and ways to get involved.\n\nUnsubscribe any time: ${siteUrl(req)}/unsubscribe?t=${token}`);
  }
  return { already: !isNew };
}));

// Event RSVP
app.post('/api/rsvp', rateLimit('rsvp', 8), handle(async (req) => {
  const b = req.body;
  const r = {
    event_key: clean(b.event_key, 200), event_title: clean(b.event_title, 200), event_date: clean(b.event_date, 40),
    name: clean(b.name, 120), email: cleanEmail(b.email), guests: Math.min(10, Math.max(0, parseInt(b.guests, 10) || 0)),
  };
  if (!r.event_key || !r.event_title) throw bad('Missing event.');
  if (!r.name) throw bad('Please enter your name.');
  if (!EMAIL_RE.test(r.email)) throw bad('Please enter a valid email address.');
  const isNew = await db.addRsvp(r);
  if (isNew) notify(`RSVP: ${r.event_title}`, [`${r.name} <${r.email}>${r.guests ? ` +${r.guests}` : ''}`, `Event: ${r.event_title} (${r.event_date})`], r.email);
  if (b.updates === true || b.updates === 'true') await db.subscribe({ email: r.email, first: r.name.split(' ')[0], source: 'rsvp' });
  return { updated: !isNew };
}));

// "What matters most" priorities poll
const ID_RE = /^[a-z]{2,24}$/;
app.post('/api/priorities', rateLimit('vote', 3), handle(async (req) => {
  const picks = Array.isArray(req.body.picks) ? req.body.picks.map(String) : [];
  if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every((p) => ID_RE.test(p))) throw bad('Pick exactly three different issues.');
  await db.addVote(picks);
  return db.tally();
}));
app.get('/api/priorities', async (req, res) => {
  if (!storageReady) return res.json({ scores: {}, voters: 0 });
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await db.tally()); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not load results.' }); }
});

// Unsubscribe. GET shows a confirm button (so email scanners that pre-open links don't unsubscribe people);
// POST does it, which also supports one-click "List-Unsubscribe" from mail apps.
app.get('/unsubscribe', (req, res) => res.type('html').send(V.unsubscribePage(clean(req.query.t, 100))));
app.post('/unsubscribe', rateLimit('unsub', 10), async (req, res) => {
  const t = clean(req.query.t || req.body.t, 100);
  const email = t && storageReady ? await db.unsubscribe(t).catch(() => null) : null;
  res.type('html').send(V.unsubscribePage(t, email ? 'done' : 'missing'));
});

/* =========================================================================
   Admin
   ========================================================================= */
app.use('/admin', sameOrigin);

app.get('/admin/login', (req, res) => {
  if (getSession(req)) return res.redirect('/admin');
  res.type('html').send(V.loginPage());
});
app.post('/admin/login', rateLimit('login', 8), async (req, res) => {
  const { username, password } = req.body;
  if (!(await checkLogin(clean(username, 80), String(password || '')))) return res.type('html').send(V.loginPage('Invalid username or password.'));
  res.setHeader('Set-Cookie', makeSessionCookie(clean(username, 80)));
  res.redirect('/admin');
});
app.post('/admin/logout', (req, res) => { res.setHeader('Set-Cookie', clearSessionCookie()); res.redirect('/admin/login'); });

// One-time setup from a browser: /setup?key=SETUP_KEY  (shows a form to create the admin login)
app.all('/setup', rateLimit('setup', 6), async (req, res) => {
  res.type('html');
  const expected = process.env.SETUP_KEY;
  const key = req.query.key || req.body.key;
  if (!expected) return res.send(V.setupPage({ error: 'Setup is turned off. Add a SETUP_KEY environment variable first.' }));
  if (key !== expected) return res.status(403).send(V.setupPage({ error: 'Invalid setup key.' }));
  if (req.method !== 'POST') return res.send(V.setupPage({ key }));
  const user = clean(req.body.user, 80), pass = String(req.body.pass || '');
  if (!user || pass.length < 10) return res.send(V.setupPage({ key, error: 'Choose a username and a password of at least 10 characters.' }));
  const existing = await db.getAdmin(user);
  if (existing && req.body.force !== '1') return res.send(V.setupPage({ key, error: 'That username exists. Tick "reset password" to change it.' }));
  await db.createAdmin(user, await bcrypt.hash(pass, 12));
  res.send(V.setupPage({ done: user }));
});

const page = (title, active, body) => async (req, res) => {
  const c = await db.counts();
  res.type('html').send(V.layout(title, active, body, req.user, { messages: c.messagesNew }));
};

app.get('/admin', requireAuth, async (req, res) => {
  const [counts, tally, messages, volunteers] = await Promise.all([db.counts(), db.tally(), db.list('messages'), db.list('volunteers')]);
  return page('Overview', 'overview', V.overview({ counts, tally, messages: messages.slice(0, 5), volunteers: volunteers.slice(0, 5), mail: mailEnabled(), postgres: usePostgres }))(req, res);
});
app.get('/admin/volunteers', requireAuth, async (req, res) => page('Volunteers', 'volunteers', V.volunteers(await db.list('volunteers')))(req, res));
app.get('/admin/messages', requireAuth, async (req, res) => page('Messages', 'messages', V.messages(await db.list('messages')))(req, res));
app.get('/admin/rsvps', requireAuth, async (req, res) => page('RSVPs', 'rsvps', V.rsvps(await db.list('rsvps')))(req, res));
app.get('/admin/newsletter', requireAuth, async (req, res) => {
  const [subs, sent] = await Promise.all([db.list('subscribers'), db.listNewsletters()]);
  return page('Newsletter', 'newsletter', V.newsletter(subs, sent, mailEnabled(), req.query))(req, res);
});
app.get('/admin/priorities', requireAuth, async (req, res) => page('Priorities', 'priorities', V.priorities(await db.tally()))(req, res));

app.post('/admin/:table/:id/status', requireAuth, async (req, res) => {
  if (!TABLES[req.params.table]) return res.sendStatus(404);
  await db.setStatus(req.params.table, req.params.id, req.body.status).catch(() => {});
  res.redirect(req.get('referer') || '/admin');
});
app.post('/admin/:table/:id/delete', requireAuth, async (req, res) => {
  if (!TABLES[req.params.table]) return res.sendStatus(404);
  await db.remove(req.params.table, req.params.id);
  res.redirect(req.get('referer') || '/admin');
});

// CSV export for any table
app.get('/admin/export/:table.csv', requireAuth, async (req, res) => {
  const t = req.params.table;
  if (!TABLES[t]) return res.sendStatus(404);
  const rows = await db.list(t);
  const cols = rows.length ? Object.keys(rows[0]).filter((c) => c !== 'token') : ['id'];
  const cell = (v) => {
    let s = v instanceof Date ? v.toISOString() : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="team-reece-${t}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n'));
});

// Send a newsletter to every active subscriber
app.post('/admin/newsletter/send', requireAuth, async (req, res) => {
  const subject = clean(req.body.subject, 200), body = clean(req.body.body, 20000);
  if (!subject || !body) return res.redirect('/admin/newsletter?err=' + encodeURIComponent('Add a subject and a message.'));
  if (req.body.confirm !== 'SEND') return res.redirect('/admin/newsletter?err=' + encodeURIComponent('Type SEND in the confirmation box to send.'));
  try {
    const subs = await db.activeSubscribers();
    if (!subs.length) return res.redirect('/admin/newsletter?err=' + encodeURIComponent('No active subscribers yet.'));
    const { sent, failed } = await sendNewsletter(subs, subject, body, siteUrl(req));
    await db.logNewsletter({ subject, body, sent_count: sent, failed_count: failed });
    res.redirect(`/admin/newsletter?ok=${sent}&failed=${failed}`);
  } catch (e) {
    res.redirect('/admin/newsletter?err=' + encodeURIComponent(e.message));
  }
});

/* =========================================================================
   Site
   ========================================================================= */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

export default app;
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Team Reece running at http://localhost:${port}  (admin: /admin, storage: ${usePostgres ? 'Postgres' : 'data.json'})`));
}
