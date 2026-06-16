// server.js — Northpeak site + lead capture + admin dashboard
import 'dotenv/config';
import express from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import db, { usePostgres } from './src/db.js';
import {
  makeSessionCookie, clearSessionCookie, checkLogin, requireAuth, getSession,
} from './src/auth.js';
import { adminLayout, loginPage, leadsView, clientsView } from './views/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

await db.init();

/* ---------- tiny in-memory rate limiter for the public form ---------- */
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000, max = 5;
  const rec = hits.get(ip) || { count: 0, start: now };
  if (now - rec.start > windowMs) { rec.count = 0; rec.start = now; }
  rec.count++; hits.set(ip, rec);
  if (rec.count > max) return res.status(429).json({ error: 'Too many requests, try again shortly.' });
  next();
}

/* ---------- public: contact form ---------- */
app.post('/api/contact', rateLimit, async (req, res) => {
  try {
    const { name, email, company, message, website } = req.body;
    if (website) return res.json({ ok: true });           // honeypot: bots fill hidden field
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (String(message || '').length > 5000) return res.status(400).json({ error: 'Message too long.' });

    await db.createLead({
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      company: String(company || '').slice(0, 200),
      message: String(message || '').slice(0, 5000),
    });

    // Optional email notification (only if RESEND_API_KEY + NOTIFY_EMAIL are set)
    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      notify(name, email, company, message).catch((e) => console.error('notify failed', e));
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please email us directly.' });
  }
});

async function notify(name, email, company, message) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Northpeak <onboarding@resend.dev>',
      to: process.env.NOTIFY_EMAIL,
      subject: `New lead: ${name}${company ? ' — ' + company : ''}`,
      text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || '-'}\n\n${message || '(no message)'}`,
    }),
  });
}

/* ---------- admin auth ---------- */
app.get('/admin/login', (req, res) => {
  if (getSession(req)) return res.redirect('/admin');
  res.type('html').send(loginPage());
});
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const ok = await checkLogin(username || '', password || '');
  if (!ok) return res.type('html').send(loginPage('Invalid username or password.'));
  res.setHeader('Set-Cookie', makeSessionCookie(username));
  res.redirect('/admin');
});
app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.redirect('/admin/login');
});

/* ---------- one-time admin setup (browser link) ----------
   Visit once:  /setup?key=SETUP_KEY&user=YOURNAME&pass=YOURPASSWORD
   - Requires SETUP_KEY env var to match (so strangers can't use it).
   - Refuses to run if an admin already exists, unless ?force=1 is passed
     AND the key matches (lets you reset your own password).            */
app.get('/setup', async (req, res) => {
  res.type('html');
  const expected = process.env.SETUP_KEY;
  const { key, user, pass, force } = req.query;

  const page = (msg, ok) => `<!doctype html><meta charset="utf-8">
    <body style="font-family:system-ui;background:#0b1014;color:#e9eef0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <div style="max-width:460px;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#0f161c">
    <h2 style="margin:0 0 12px;color:${ok ? '#5fd4d6' : '#ff8a8a'}">${msg}</h2>
    ${ok ? '<p style="color:#7c8a93">You can now <a href="/admin/login" style="color:#5fd4d6">log in</a>. For security, remove the SETUP_KEY environment variable in Vercel when you are done.</p>' : '<p style="color:#7c8a93">Check the link and try again.</p>'}
    </div></body>`;

  if (!expected) return res.send(page('Setup is disabled. Set a SETUP_KEY environment variable first.', false));
  if (!key || key !== expected) return res.status(403).send(page('Invalid setup key.', false));
  if (!user || !pass) return res.send(page('Add &user= and &pass= to the link.', false));
  if (String(pass).length < 10) return res.send(page('Password must be at least 10 characters.', false));

  try {
    const existing = await db.getAdmin(String(user));
    if (existing && force !== '1') {
      return res.send(page('An admin with that username already exists. Add &force=1 to reset its password.', false));
    }
    const hash = await bcrypt.hash(String(pass), 12);
    await db.createAdmin(String(user), hash);
    return res.send(page(`Admin "${String(user)}" created. ✓`, true));
  } catch (e) {
    console.error('setup failed', e);
    return res.status(500).send(page('Setup failed — is the database connected?', false));
  }
});

/* ---------- admin dashboard ---------- */
app.get('/admin', requireAuth, async (req, res) => {
  const leads = await db.listLeads();
  res.type('html').send(adminLayout('Leads', leadsView(leads), req.user, 'leads'));
});
app.post('/admin/leads/:id/status', requireAuth, async (req, res) => {
  await db.setLeadStatus(req.params.id, req.body.status);
  res.redirect('/admin');
});
app.get('/admin/clients', requireAuth, async (req, res) => {
  const clients = await db.listClients();
  // attach this month's usage to each client
  for (const c of clients) {
    const u = await usage.getMonth(c.client_id);
    c._usage = u.conversations;
    c._cap = capFor(c);
  }
  res.type('html').send(adminLayout('Clients', clientsView(clients), req.user, 'clients'));
});
app.post('/admin/clients', requireAuth, async (req, res) => {
  const b = req.body;
  await db.upsertClient({
    client_id: String(b.client_id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: b.name || '', greeting: b.greeting || '',
    accent: b.accent || '#5fd4d6', knowledge_url: b.knowledge_url || '',
    active: b.active === 'on' || b.active === true,
    tier: b.tier || 'essential',
    monthly_cap: Number(b.monthly_cap) || 0,
  });
  res.redirect('/admin/clients');
});
app.post('/admin/clients/:id/delete', requireAuth, async (req, res) => {
  await db.deleteClient(req.params.id);
  res.redirect('/admin/clients');
});

/* ---------- AI assistant: ingest (admin) + chat (public) ---------- */
import { kb } from './src/db.js';
import { buildKnowledge, retrieve } from './src/knowledge.js';
import { chat as aiChat, provider } from './src/ai.js';
import usage, { capFor } from './src/usage.js';

await kb.init();
await usage.init();

// Admin: scrape a client's site and build their knowledge base
app.post('/admin/clients/:id/ingest', requireAuth, async (req, res) => {
  try {
    const clients = await db.listClients();
    const client = clients.find((c) => c.client_id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found.' });
    const url = client.knowledge_url;
    if (!url) return res.status(400).json({ error: 'This client has no knowledge URL set.' });
    const built = await buildKnowledge(url);
    await kb.save(client.client_id, built);
    res.json({ ok: true, pages: built.pages, chunks: built.chunks.length, mode: built.mode });
  } catch (e) {
    console.error('ingest failed', e);
    res.status(500).json({ error: e.message || 'Ingest failed.' });
  }
});

// Public: the widget asks questions here
app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    if (provider === 'none') return res.status(503).json({ error: 'Assistant not configured.' });
    const { client_id, message, session_id, history } = req.body;
    if (!client_id || !message) return res.status(400).json({ error: 'Missing client_id or message.' });
    if (String(message).length > 1000) return res.status(400).json({ error: 'Message too long.' });

    const clients = await db.listClients();
    const client = clients.find((c) => c.client_id === client_id && c.active);
    if (!client) return res.status(404).json({ error: 'Unknown or inactive client.' });

    // ---- usage cap enforcement (protects your API bill) ----
    const cap = capFor(client);
    const sid = (session_id && String(session_id).slice(0, 60)) || null;
    const seen = sid ? await usage.hasSession(client_id, sid) : false;
    const current = await usage.getMonth(client_id);
    if (current.conversations >= cap && !seen) {
      return res.status(429).json({
        error: "This assistant has reached its monthly conversation limit. Please contact us directly and we'll be glad to help.",
        capped: true,
      });
    }

    const knowledge = await kb.get(client_id);
    if (!knowledge) return res.status(503).json({ error: 'Assistant is still being set up.' });

    const hits = await retrieve(message, knowledge, 4);
    const context = hits.map((h, i) => `[Source ${i + 1}: ${h.source}]\n${h.text}`).join('\n\n');

    // build a compact conversation transcript (memory)
    const turns = Array.isArray(history) ? history.slice(-10) : [];
    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'Visitor' : 'Assistant'}: ${String(t.text || '').slice(0, 500)}`)
      .join('\n');

    const bizName = client.name || client_id;
    const system =
`You are the friendly assistant for ${bizName}, embedded on their website. Your two jobs:
1) Answer visitor questions using ONLY the context below (drawn from ${bizName}'s own website). Be concise, warm, and on-brand. If the answer isn't in the context, say you're not certain and offer to have someone follow up — never invent details.
2) Turn interested visitors into leads. When a visitor shows buying interest (asks about services, pricing, availability, booking, "can you help with X", or wants to be contacted), naturally offer to have the team reach out, and collect: their name, the best phone or email, and a one-line reason for reaching out. Ask for missing pieces ONE at a time, conversationally — never dump a form on them. Don't be pushy; if they just want an answer, give it.

IMPORTANT — capturing a lead: As soon as you have at least a name AND (a phone OR email), include a hidden machine tag at the very END of your reply, on its own line, in EXACTLY this format:
[LEAD]{"name":"...","phone":"...","email":"...","reason":"..."}[/LEAD]
Use empty strings for anything not provided. The visitor will NOT see this tag. In the visible part of your reply, warmly confirm that someone will be in touch. Only emit the tag once per visitor, when you first have enough info.

This is not legal, medical, or financial advice; for those, encourage speaking directly with ${bizName}.

CONTEXT FROM ${bizName}'s WEBSITE:
${context}

${transcript ? `CONVERSATION SO FAR:\n${transcript}\n` : ''}`;

    let raw = await aiChat({ system, user: message, maxTokens: 500 });

    // ---- detect + extract a captured lead ----
    let leadCaptured = false;
    const m = raw.match(/\[LEAD\]([\s\S]*?)\[\/LEAD\]/);
    if (m) {
      raw = raw.replace(m[0], '').trim(); // hide the tag from the visitor
      try {
        const lead = JSON.parse(m[1]);
        const hasContact = (lead.name && (lead.phone || lead.email));
        if (hasContact) {
          await db.createLead({
            name: String(lead.name || '').slice(0, 200),
            email: String(lead.email || '').slice(0, 200),
            phone: String(lead.phone || '').slice(0, 60),
            company: bizName,
            message: String(lead.reason || '').slice(0, 1000),
            client_id,
            source: 'bot',
          });
          leadCaptured = true;
          // notify the business immediately (if email configured)
          if (process.env.RESEND_API_KEY && (client.notify_email || process.env.NOTIFY_EMAIL)) {
            notifyLead(client, lead).catch((e) => console.error('lead notify failed', e));
          }
        }
      } catch (e) { console.error('lead parse failed', e); }
    }

    await usage.record(client_id, sid);
    res.json({ ok: true, answer: raw, leadCaptured });
  } catch (e) {
    console.error('chat failed', e);
    res.status(500).json({ error: 'The assistant hit an error. Please try again.' });
  }
});

async function notifyLead(client, lead) {
  const to = client.notify_email || process.env.NOTIFY_EMAIL;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Northpeak <onboarding@resend.dev>',
      to,
      subject: `New website lead${lead.name ? ' — ' + lead.name : ''}`,
      text: `Your website assistant captured a new lead:\n\nName: ${lead.name || '-'}\nPhone: ${lead.phone || '-'}\nEmail: ${lead.email || '-'}\nReason: ${lead.reason || '-'}\n\nFollow up soon while they're warm.\n\n— Northpeak`,
    }),
  });
}

// Serve the embeddable widget loader
app.get('/embed.js', (req, res) => {
  res.type('application/javascript').sendFile(path.join(__dirname, 'widget', 'embed.js'));
});
app.get('/widget/:file', (req, res) => {
  res.sendFile(path.join(__dirname, 'widget', req.params.file));
});

/* ---------- static marketing site ---------- */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\nNorthpeak running → http://localhost:${PORT}`);
    console.log(`Admin → http://localhost:${PORT}/admin`);
    console.log(`Storage → ${usePostgres ? 'Neon Postgres (production)' : 'local JSON file (data.json)'}\n`);
  });
}

export default app;
