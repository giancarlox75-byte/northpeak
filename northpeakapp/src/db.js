// src/db.js — storage layer.
// Local/dev: a simple JSON file (zero native deps, "just runs").
// Production (Vercel): Postgres via @neondatabase/serverless when DATABASE_URL/POSTGRES_URL is set.
// Same async API in both modes so the rest of the app never changes.

import fs from 'fs';
import path from 'path';

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const usePostgres = !!PG_URL;

let impl;

if (usePostgres) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(PG_URL);

  async function init() {
    await sql`CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT, company TEXT, message TEXT,
      phone TEXT, client_id TEXT, source TEXT DEFAULT 'form',
      status TEXT DEFAULT 'new', created_at TIMESTAMPTZ DEFAULT now())`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'form'`;
    await sql`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY, client_id TEXT UNIQUE, name TEXT, greeting TEXT,
      accent TEXT DEFAULT '#5fd4d6', knowledge_url TEXT, active BOOLEAN DEFAULT true,
      tier TEXT DEFAULT 'essential', monthly_cap INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now())`;
    // add columns if upgrading an existing table
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'essential'`;
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_cap INT DEFAULT 0`;
    await sql`CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)`;
  }

  impl = {
    init,
    createLead: async (l) =>
      sql`INSERT INTO leads (name,email,company,message,phone,client_id,source)
          VALUES (${l.name},${l.email},${l.company},${l.message},${l.phone || ''},${l.client_id || ''},${l.source || 'form'})`,
    listLeads: async () => sql`SELECT * FROM leads ORDER BY created_at DESC`,
    setLeadStatus: async (id, status) => sql`UPDATE leads SET status=${status} WHERE id=${id}`,
    listClients: async () => sql`SELECT * FROM clients ORDER BY created_at DESC`,
    upsertClient: async (c) =>
      sql`INSERT INTO clients (client_id,name,greeting,accent,knowledge_url,active,tier,monthly_cap)
          VALUES (${c.client_id},${c.name},${c.greeting},${c.accent},${c.knowledge_url},${c.active},${c.tier || 'essential'},${c.monthly_cap || 0})
          ON CONFLICT (client_id) DO UPDATE SET name=${c.name},greeting=${c.greeting},
          accent=${c.accent},knowledge_url=${c.knowledge_url},active=${c.active},
          tier=${c.tier || 'essential'},monthly_cap=${c.monthly_cap || 0}`,
    deleteClient: async (client_id) => sql`DELETE FROM clients WHERE client_id=${client_id}`,
    getAdmin: async (username) => (await sql`SELECT * FROM admins WHERE username=${username}`)[0],
    createAdmin: async (username, hash) =>
      sql`INSERT INTO admins (username,password_hash) VALUES (${username},${hash})
          ON CONFLICT (username) DO UPDATE SET password_hash=${hash}`,
  };
} else {
  const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
  const blank = { leads: [], clients: [], admins: [], seq: { leads: 0, clients: 0, admins: 0 } };

  function load() {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { return structuredClone(blank); }
  }
  function save(d) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }

  impl = {
    init: async () => { if (!fs.existsSync(FILE)) save(structuredClone(blank)); },
    createLead: async (l) => {
      const d = load();
      d.leads.push({ id: ++d.seq.leads, ...l, status: 'new', created_at: new Date().toISOString() });
      save(d);
    },
    listLeads: async () => load().leads.slice().reverse(),
    setLeadStatus: async (id, status) => {
      const d = load(); const x = d.leads.find((r) => r.id === Number(id));
      if (x) { x.status = status; save(d); }
    },
    listClients: async () => load().clients.slice().reverse(),
    upsertClient: async (c) => {
      const d = load();
      const ex = d.clients.find((r) => r.client_id === c.client_id);
      if (ex) Object.assign(ex, c);
      else d.clients.push({ id: ++d.seq.clients, ...c, created_at: new Date().toISOString() });
      save(d);
    },
    deleteClient: async (client_id) => {
      const d = load(); d.clients = d.clients.filter((r) => r.client_id !== client_id); save(d);
    },
    getAdmin: async (username) => load().admins.find((a) => a.username === username),
    createAdmin: async (username, hash) => {
      const d = load();
      const ex = d.admins.find((a) => a.username === username);
      if (ex) ex.password_hash = hash;
      else d.admins.push({ id: ++d.seq.admins, username, password_hash: hash });
      save(d);
    },
  };
}

export default impl;
export { usePostgres };

/* ---------- knowledge base storage (added for the assistant) ----------
   Stored separately so the chunks (which can be large) don't bloat the
   clients list. JSON-file mode locally; Postgres in prod.                */
export const kb = (() => {
  const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (PG_URL) {
    let sql;
    return {
      async _sql() {
        if (!sql) { const { neon } = await import('@neondatabase/serverless'); sql = neon(PG_URL); }
        return sql;
      },
      async init() {
        const s = await this._sql();
        await s`CREATE TABLE IF NOT EXISTS knowledge (
          client_id TEXT PRIMARY KEY, data JSONB, updated_at TIMESTAMPTZ DEFAULT now())`;
      },
      async save(client_id, data) {
        const s = await this._sql();
        await s`INSERT INTO knowledge (client_id,data) VALUES (${client_id},${JSON.stringify(data)})
          ON CONFLICT (client_id) DO UPDATE SET data=${JSON.stringify(data)}, updated_at=now()`;
      },
      async get(client_id) {
        const s = await this._sql();
        const rows = await s`SELECT data FROM knowledge WHERE client_id=${client_id}`;
        return rows[0]?.data || null;
      },
    };
  }
  // local JSON file
  const FILE = process.env.KB_FILE || path.join(process.cwd(), 'knowledge.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
  const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d));
  return {
    async init() { if (!fs.existsSync(FILE)) save({}); },
    async save(client_id, data) { const d = load(); d[client_id] = data; save(d); },
    async get(client_id) { return load()[client_id] || null; },
  };
})();
