// src/usage.js — per-client usage metering with monthly caps.
// A "conversation" = a unique session in a calendar month (not each message),
// which matches the pricing model ("up to N conversations/month").
//
// Local: JSON file. Production: Postgres table. Same async API.

import fs from 'fs';
import path from 'path';

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// default monthly conversation caps by plan tier
export const TIER_CAPS = {
  essential: 300,
  professional: 800,
  custom: 100000, // effectively unlimited; quote per scope
  trial: 50,
};

export function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

let impl;

if (PG_URL) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(PG_URL);
  impl = {
    async init() {
      // one row per client+month; sessions stored to dedupe conversations
      await sql`CREATE TABLE IF NOT EXISTS usage (
        client_id TEXT, month TEXT, conversations INT DEFAULT 0,
        messages INT DEFAULT 0, sessions JSONB DEFAULT '[]'::jsonb,
        PRIMARY KEY (client_id, month))`;
    },
    async record(client_id, sessionId) {
      const month = monthKey();
      const rows = await sql`SELECT conversations, messages, sessions FROM usage WHERE client_id=${client_id} AND month=${month}`;
      let conversations = 0, messages = 0, sessions = [];
      if (rows[0]) { conversations = rows[0].conversations; messages = rows[0].messages; sessions = rows[0].sessions || []; }
      const isNew = sessionId && !sessions.includes(sessionId);
      if (isNew) { sessions.push(sessionId); conversations += 1; }
      messages += 1;
      await sql`INSERT INTO usage (client_id,month,conversations,messages,sessions)
        VALUES (${client_id},${month},${conversations},${messages},${JSON.stringify(sessions)})
        ON CONFLICT (client_id,month) DO UPDATE SET
          conversations=${conversations}, messages=${messages}, sessions=${JSON.stringify(sessions)}`;
      return { conversations, messages, isNewConversation: isNew };
    },
    async getMonth(client_id, month = monthKey()) {
      const rows = await sql`SELECT conversations, messages FROM usage WHERE client_id=${client_id} AND month=${month}`;
      return rows[0] ? { conversations: rows[0].conversations, messages: rows[0].messages } : { conversations: 0, messages: 0 };
    },
    async hasSession(client_id, sessionId, month = monthKey()) {
      const rows = await sql`SELECT sessions FROM usage WHERE client_id=${client_id} AND month=${month}`;
      const sessions = rows[0]?.sessions || [];
      return sessions.includes(sessionId);
    },
  };
} else {
  const FILE = process.env.USAGE_FILE || path.join(process.cwd(), 'usage.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d));
  impl = {
    async init() { if (!fs.existsSync(FILE)) save({}); },
    async record(client_id, sessionId) {
      const d = load();
      const month = monthKey();
      const key = `${client_id}|${month}`;
      const rec = d[key] || { conversations: 0, messages: 0, sessions: [] };
      const isNew = sessionId && !rec.sessions.includes(sessionId);
      if (isNew) { rec.sessions.push(sessionId); rec.conversations += 1; }
      rec.messages += 1;
      d[key] = rec; save(d);
      return { conversations: rec.conversations, messages: rec.messages, isNewConversation: isNew };
    },
    async getMonth(client_id, month = monthKey()) {
      const rec = load()[`${client_id}|${month}`];
      return rec ? { conversations: rec.conversations, messages: rec.messages } : { conversations: 0, messages: 0 };
    },
    async hasSession(client_id, sessionId, month = monthKey()) {
      const rec = load()[`${client_id}|${month}`];
      return rec ? rec.sessions.includes(sessionId) : false;
    },
  };
}

// cap for a client = explicit override, else tier default, else essential
export function capFor(client) {
  if (client && client.monthly_cap && Number(client.monthly_cap) > 0) return Number(client.monthly_cap);
  const tier = (client && client.tier) || 'essential';
  return TIER_CAPS[tier] ?? TIER_CAPS.essential;
}

export default impl;
