// server.js — Team Reece: campaign site + form backend + Campaign HQ admin.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import db, { usePostgres, storageReady, TABLES } from './src/db.js';
import { makeSessionCookie, clearSessionCookie, checkLogin, requireAuth, getSession, sameOrigin } from './src/auth.js';
import { notify, confirm, sendNewsletter, mailEnabled } from './src/mail.js';
import { REGIONS, REGION_BY_ID, COUNTY_TO_REGION } from './src/regions.js';
import { TRACK_BY_ID, roleName, EVENT_TYPES } from './src/team.js';
import { PLAYBOOK_IDS } from './src/playbook.js';
import { getCensus } from './src/census.js';
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
const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const cleanEmail = (v) => clean(v, 200).toLowerCase();
const list = (v, max = 400) => clean(Array.isArray(v) ? v.join('; ') : v, max);
const int = (v, max = 100000) => Math.min(max, Math.max(0, parseInt(v, 10) || 0));
const cleanUrl = (v) => { const s = clean(v, 300); return /^https?:\/\/\S+$/i.test(s) ? s : ''; };
const region = (v) => (REGION_BY_ID[v] ? v : '');
const county = (v, reg) => { const c = clean(v, 40); return COUNTY_TO_REGION[c] && (!reg || COUNTY_TO_REGION[c] === reg) ? c : ''; };
// Current Michigan wall-clock time as "YYYY-MM-DDTHH:MM" (event times are entered in Michigan local time)
const MI_TIME = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const nowLocal = () => MI_TIME.format(new Date()).replace(' ', 'T');

// Small in-memory rate limiter: `max` requests per minute per IP per bucket.
const hits = new Map();
const RL_SCALE = process.env.NODE_ENV === 'test' ? 50 : 1; // the test suite sends many requests per minute
const rateLimit = (bucket, max = 8) => (req, res, next) => {
  const limit = max * RL_SCALE;
  const key = `${bucket}:${req.ip}`, t = Date.now();
  const rec = hits.get(key) || { n: 0, start: t };
  if (t - rec.start > 60_000) { rec.n = 0; rec.start = t; }
  rec.n++; hits.set(key, rec);
  if (hits.size > 5000) for (const [k, r] of hits) if (t - r.start > 60_000) hits.delete(k);
  if (rec.n > limit) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
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
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

// Public view of an event (with spots left)
const publicEvent = (e, counts) => {
  const taken = counts[`ev:${e.id}`] || 0, cap = Number(e.capacity) || 0;
  return { key: `ev:${e.id}`, id: e.id, title: e.title, type: e.type, date: e.starts_at, end: e.ends_at, place: e.location,
    region: e.region, desc: e.description, capacity: cap || null, spots_left: cap ? Math.max(0, cap - taken) : null };
};

/* =========================================================================
   Public API
   ========================================================================= */
app.get('/api/health', (req, res) => res.json({ ok: true, storage: usePostgres ? 'postgres' : storageReady ? 'file' : 'none', email: mailEnabled() }));

// Join the Team: HQ Office / Regional Leadership applications, Organizer sign-ups
app.post('/api/volunteer', rateLimit('volunteer', 5), handle(async (req) => {
  const b = req.body;
  const team = TRACK_BY_ID[b.team] ? b.team : 'organizer';
  const track = TRACK_BY_ID[team];
  const roles = (Array.isArray(b.roles) ? b.roles : [b.role]).map(String).filter((r) => track.roles.some((x) => x.id === r));
  const reg = region(b.region);
  const v = {
    first: clean(b.first, 80), last: clean(b.last, 80), email: cleanEmail(b.email), phone: clean(b.phone, 40),
    zip: clean(b.zip, 10), team, role: roles.join('; '), region: reg, county: county(b.county, reg),
    help: roles.map((r) => roleName(team, r)).join('; '), availability: list(b.when), hours: clean(b.hours, 40),
    experience: clean(b.experience, 3000), link: cleanUrl(b.link), message: clean(b.message, 3000),
  };
  if (!v.first || !v.last) throw bad('Please enter your first and last name.');
  if (!EMAIL_RE.test(v.email)) throw bad('Please enter a valid email address.');
  if (!/^\d{5}$/.test(v.zip)) throw bad('Please enter a 5-digit ZIP code.');
  if (track.application && !roles.length) throw bad('Please choose the role you are applying for.');
  if (team === 'regional' && !reg) throw bad('Please choose the region you want to lead.');
  if (track.application && v.experience.length < 20) throw bad('Please tell us a little about your experience (a few sentences).');
  await db.addMember(v);
  if (b.updates !== false && b.updates !== 'false') await db.subscribe({ email: v.email, first: v.first, zip: v.zip, source: team });
  const label = track.application ? `New ${track.name} application` : 'New organizer';
  notify(`${label}: ${v.first} ${v.last}`, [
    `Team: ${track.name}`, `Role(s): ${v.help || '-'}`, `Name: ${v.first} ${v.last}`, `Email: ${v.email}`, v.phone && `Phone: ${v.phone}`,
    `ZIP: ${v.zip}`, `Region: ${REGION_BY_ID[v.region]?.name || '-'}${v.county ? ` (${v.county} County)` : ''}`, v.hours && `Hours/week: ${v.hours}`,
    v.availability && `Available: ${v.availability}`, v.link && `Link: ${v.link}`, v.experience && `\nExperience:\n${v.experience}`, v.message && `\nNote:\n${v.message}`,
  ], v.email);
  confirm(v.email, track.application ? 'We received your application' : 'Welcome to Team Reece!', track.application
    ? `Hi ${v.first},\n\nThank you for applying to join Team Reece's ${track.name}. Kevin's team reviews every application and will reach out to set up a conversation.\n\n— Team Reece`
    : `Hi ${v.first},\n\nWelcome to Team Reece! Your regional team will reach out soon with your first shift.\n\nThe movement starts here.\n— Kevin Reece`);
  return { application: track.application };
}));

// Comments, questions, invitations, press inquiries
const TOPICS = ['Comment', 'Question', 'Event invitation', 'Press / media', 'Volunteer question', 'Other'];
app.post('/api/contact', rateLimit('contact', 5), handle(async (req) => {
  const b = req.body;
  const m = { name: clean(b.name, 120), email: cleanEmail(b.email), phone: clean(b.phone, 40), zip: clean(b.zip, 10),
    topic: TOPICS.includes(b.topic) ? b.topic : 'Other', message: clean(b.message, 5000) };
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

// Upcoming public events and shifts (managed in Campaign HQ → Events)
app.get('/api/events', async (req, res) => {
  if (!storageReady) return res.json({ events: [] });
  const [events, counts] = await Promise.all([db.listEvents(), db.rsvpCounts()]);
  const cutoff = nowLocal();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ events: events.filter((e) => e.status === 'published' && (e.ends_at || e.starts_at) >= cutoff).map((e) => publicEvent(e, counts)) });
});

// Event RSVP / shift sign-up
app.post('/api/rsvp', rateLimit('rsvp', 8), handle(async (req) => {
  const b = req.body;
  const r = { event_key: clean(b.event_key, 200), name: clean(b.name, 120), email: cleanEmail(b.email), guests: int(b.guests, 10) };
  if (!r.name) throw bad('Please enter your name.');
  if (!EMAIL_RE.test(r.email)) throw bad('Please enter a valid email address.');
  const m = /^ev:(\d+)$/.exec(r.event_key);
  const ev = m && (await db.getEvent(m[1]));
  if (!ev || ev.status !== 'published') throw bad('That event is no longer available.', 404);
  r.event_title = ev.title; r.event_date = ev.starts_at;
  if (ev.capacity) {
    const taken = (await db.rsvpCounts())[r.event_key] || 0;
    const mine = await db.rsvpFor(r.event_key, r.email);
    const already = mine && mine.status !== 'cancelled' ? 1 + (Number(mine.guests) || 0) : 0;
    if (taken - already + 1 + r.guests > ev.capacity) throw bad(taken - already >= ev.capacity ? 'Sorry, this shift is full.' : `Only ${ev.capacity - (taken - already)} spot(s) left.`, 409);
  }
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
  res.setHeader('Cache-Control', 'no-store');
  res.json(await db.tally());
});

// 2020 Census population by county and region (live from the Census Bureau, cached 30 days)
app.get('/api/census', async (req, res) => {
  try {
    const data = await getCensus();
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (e) {
    console.error('census unavailable:', e.message);
    res.status(503).json({ error: 'Census data is temporarily unavailable.' });
  }
});

// Unsubscribe. GET shows a confirm button (email scanners that pre-open links won't unsubscribe people);
// POST does it, which also supports one-click "List-Unsubscribe" from mail apps.
app.get('/unsubscribe', (req, res) => res.type('html').send(V.unsubscribePage(clean(req.query.t, 100))));
app.post('/unsubscribe', rateLimit('unsub', 10), async (req, res) => {
  const t = clean(req.query.t || req.body.t, 100);
  const email = t && storageReady ? await db.unsubscribe(t).catch(() => null) : null;
  res.type('html').send(V.unsubscribePage(t, email ? 'done' : 'missing'));
});

/* =========================================================================
   Organizer portal (/team): organizers file canvass results with the team access code
   ========================================================================= */
const codeOk = (given, expected) => {
  if (!expected || !given) return false;
  const a = crypto.createHash('sha256').update(String(given).trim().toLowerCase()).digest();
  const b = crypto.createHash('sha256').update(String(expected).trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(a, b);
};
const recentShifts = async () => {
  const events = await db.listEvents();
  const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10), to = nowLocal();
  return events.filter((e) => e.status !== 'draft' && e.starts_at >= from && e.starts_at <= to).reverse();
};
app.get('/team', async (req, res) => {
  const code = await db.kvGet('team_code');
  res.type('html').send(V.teamPortal({ enabled: !!code, shifts: await recentShifts(), regions: REGIONS }));
});
app.post('/team', rateLimit('report', 10), async (req, res) => {
  const b = req.body, code = await db.kvGet('team_code');
  const render = (state) => res.type('html').send(V.teamPortal({ enabled: !!code, shifts: [], regions: REGIONS, ...state }));
  if (b.website) return render({ done: true });
  if (!codeOk(b.code, code)) return render({ error: 'That team access code is not right. Ask your Regional Director for the current code.', form: b });
  const shiftEv = /^ev:(\d+)$/.test(b.event_key) ? await db.getEvent(b.event_key.slice(3)) : null;
  const r = {
    name: clean(b.name, 120), email: cleanEmail(b.email), region: region(b.region) || shiftEv?.region || '',
    event_key: shiftEv ? `ev:${shiftEv.id}` : '', event_title: shiftEv?.title || '', report_date: /^\d{4}-\d{2}-\d{2}$/.test(b.report_date) ? b.report_date : nowLocal().slice(0, 10),
    doors: int(b.doors), conversations: int(b.conversations), supporters: int(b.supporters), undecided: int(b.undecided),
    recruits: int(b.recruits), signs: int(b.signs), notes: clean(b.notes, 3000),
  };
  if (!r.name || !EMAIL_RE.test(r.email)) return render({ error: 'Please enter your name and a valid email.', form: b, shifts: await recentShifts() });
  if (!r.region) return render({ error: 'Please choose the region you worked in.', form: b, shifts: await recentShifts() });
  await db.addReport(r);
  render({ done: true, report: r });
});

/* =========================================================================
   Campaign HQ (admin)
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

const render = async (req, res, title, active, body) => {
  const c = await db.counts();
  res.type('html').send(V.layout(title, active, body, req.user, { messages: c.messagesNew, team: c.applicants }));
};
const back = (req, res, fallback = '/admin') => res.redirect(req.get('referer') || fallback);

app.get('/admin', requireAuth, async (req, res) => {
  const [counts, tally, messages, members, events, rsvpCounts, playbook] = await Promise.all([
    db.counts(), db.tally(), db.list('messages'), db.list('volunteers'), db.listEvents(), db.rsvpCounts(), db.kvGet('playbook', {})]);
  const upcoming = events.filter((e) => e.status === 'published' && e.starts_at >= nowLocal()).slice(0, 4).map((e) => ({ ...e, going: rsvpCounts[`ev:${e.id}`] || 0 }));
  const done = PLAYBOOK_IDS.filter((id) => playbook[id]).length;
  return render(req, res, 'Overview', 'overview', V.overview({ counts, tally, messages: messages.slice(0, 5), members: members.slice(0, 5), upcoming,
    playbook: { done, total: PLAYBOOK_IDS.length }, mail: mailEnabled(), postgres: usePostgres }));
});
app.get('/admin/messages', requireAuth, async (req, res) => render(req, res, 'Messages', 'messages', V.messages(await db.list('messages'))));
app.get('/admin/newsletter', requireAuth, async (req, res) => {
  const [subs, sent] = await Promise.all([db.list('subscribers'), db.listNewsletters()]);
  return render(req, res, 'Newsletter', 'newsletter', V.newsletter(subs, sent, mailEnabled(), req.query));
});
app.get('/admin/priorities', requireAuth, async (req, res) => render(req, res, 'Priorities', 'overview', V.priorities(await db.tally())));

// ---- Team: org chart, roster, member detail
app.get('/admin/team', requireAuth, async (req, res) => {
  const members = await db.list('volunteers');
  const f = { team: TRACK_BY_ID[req.query.team] ? req.query.team : '', region: region(req.query.region), status: TABLES.volunteers.includes(req.query.status) ? req.query.status : '' };
  return render(req, res, 'Team', 'team', V.team(members, f));
});
app.get('/admin/team/:id', requireAuth, async (req, res) => {
  const m = await db.getMember(req.params.id);
  if (!m) return res.redirect('/admin/team');
  return render(req, res, `${m.first} ${m.last}`, 'team', V.member(m, req.query.saved));
});
app.post('/admin/team/:id', requireAuth, async (req, res) => {
  const b = req.body, team = TRACK_BY_ID[b.team] ? b.team : 'organizer', reg = region(b.region);
  const roles = (Array.isArray(b.role) ? b.role : [b.role]).filter((r) => TRACK_BY_ID[team].roles.some((x) => x.id === r));
  await db.updateMember(req.params.id, {
    team, role: roles.join('; '), help: roles.map((r) => roleName(team, r)).join('; '), region: reg, county: county(b.county, reg),
    status: TABLES.volunteers.includes(b.status) ? b.status : 'new', notes: clean(b.notes, 5000), phone: clean(b.phone, 40),
  });
  res.redirect(`/admin/team/${Number(req.params.id)}?saved=1`);
});

// ---- Events & shifts
const eventFrom = (b) => {
  const e = { title: clean(b.title, 160), type: EVENT_TYPES.includes(b.type) ? b.type : 'Other', starts_at: clean(b.starts_at, 16), ends_at: clean(b.ends_at, 16),
    location: clean(b.location, 200), region: region(b.region), description: clean(b.description, 2000), capacity: int(b.capacity, 100000) || null,
    status: TABLES.events.includes(b.status) ? b.status : 'published' };
  if (!e.title || !DT_RE.test(e.starts_at)) return null;
  if (e.ends_at && (!DT_RE.test(e.ends_at) || e.ends_at < e.starts_at)) e.ends_at = '';
  return e;
};
app.get('/admin/events', requireAuth, async (req, res) => {
  const [events, rsvps] = await Promise.all([db.listEvents(), db.list('rsvps')]);
  return render(req, res, 'Events', 'events', V.events(events, rsvps, nowLocal(), req.query));
});
app.post('/admin/events', requireAuth, async (req, res) => {
  const e = eventFrom(req.body);
  if (!e) return res.redirect('/admin/events?err=' + encodeURIComponent('Add a title and a start date and time.'));
  const id = await db.addEvent(e);
  res.redirect(`/admin/events/${id}?saved=1`);
});
app.get('/admin/events/:id', requireAuth, async (req, res) => {
  const e = await db.getEvent(req.params.id);
  if (!e) return res.redirect('/admin/events');
  const rsvps = (await db.list('rsvps')).filter((r) => r.event_key === `ev:${e.id}`);
  return render(req, res, e.title, 'events', V.eventDetail(e, rsvps, req.query));
});
app.post('/admin/events/:id', requireAuth, async (req, res) => {
  const e = eventFrom(req.body);
  if (!e) return res.redirect(`/admin/events/${Number(req.params.id)}?err=` + encodeURIComponent('Add a title and a start date and time.'));
  await db.updateEvent(req.params.id, e);
  res.redirect(`/admin/events/${Number(req.params.id)}?saved=1`);
});

// ---- Field: canvass results, goals, organizer access code
app.get('/admin/field', requireAuth, async (req, res) => {
  const [reports, goals, code] = await Promise.all([db.list('field_reports'), db.kvGet('field_goals', {}), db.kvGet('team_code')]);
  return render(req, res, 'Field', 'field', V.field(reports, goals, code, siteUrl(req), req.query));
});
app.post('/admin/field/settings', requireAuth, async (req, res) => {
  const code = clean(req.body.team_code, 40);
  if (code && code.length < 6) return res.redirect('/admin/field?err=' + encodeURIComponent('Use an access code of at least 6 characters.'));
  await db.kvSet('team_code', code || null);
  const goals = {};
  for (const r of REGIONS) { const g = int(req.body[`goal_${r.id}`], 10_000_000); if (g) goals[r.id] = g; }
  await db.kvSet('field_goals', goals);
  res.redirect('/admin/field?saved=1');
});

// ---- Playbook (launch checklist)
app.get('/admin/playbook', requireAuth, async (req, res) => render(req, res, 'Playbook', 'playbook', V.playbook(await db.kvGet('playbook', {}))));
app.post('/admin/playbook/:id', requireAuth, async (req, res) => {
  if (!PLAYBOOK_IDS.includes(req.params.id)) return res.sendStatus(404);
  const state = await db.kvGet('playbook', {});
  if (req.body.done === '1') state[req.params.id] = { at: new Date().toISOString(), by: req.user.username }; else delete state[req.params.id];
  await db.kvSet('playbook', state);
  res.redirect(`/admin/playbook#${req.params.id}`);
});

// ---- Shared: status, delete, CSV, newsletter send
app.post('/admin/:table/:id/status', requireAuth, async (req, res) => {
  if (!TABLES[req.params.table]) return res.sendStatus(404);
  await db.setStatus(req.params.table, req.params.id, req.body.status).catch(() => {});
  back(req, res);
});
app.post('/admin/:table/:id/delete', requireAuth, async (req, res) => {
  if (!TABLES[req.params.table]) return res.sendStatus(404);
  await db.remove(req.params.table, req.params.id);
  const t = req.params.table;
  res.redirect(req.body.next && /^\/admin(\/[a-z]+)?$/.test(req.body.next) ? req.body.next : req.get('referer') || `/admin/${t === 'volunteers' ? 'team' : t}`);
});

app.get('/admin/export/:table.csv', requireAuth, async (req, res) => {
  const t = req.params.table;
  if (!TABLES[t]) return res.sendStatus(404);
  let rows = await db.list(t);
  if (t === 'volunteers' && TRACK_BY_ID[req.query.team]) rows = rows.filter((r) => r.team === req.query.team);
  if (t === 'rsvps' && req.query.event) rows = rows.filter((r) => r.event_key === String(req.query.event));
  const cols = rows.length ? [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c !== 'token') : ['id'];
  const cell = (v) => {
    let s = v instanceof Date ? v.toISOString() : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="team-reece-${t}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n'));
});

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
