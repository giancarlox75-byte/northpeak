# Northpeak Solutions — Website + Lead Capture + Admin

A complete Node/Express app: the marketing site, a working contact form that
stores leads, and a password-protected admin dashboard for leads and client
widget configs.

Storage works in two modes automatically:
- **Local dev:** a simple `data.json` file. Zero setup, no database needed.
- **Production (Vercel):** Neon Postgres, used automatically when `DATABASE_URL`
  (or `POSTGRES_URL`) is set. This survives redeploys; a file would not.

---

## Run it locally (5 minutes)

1. Install Node.js 18+ if you don't have it.
2. In this folder:
   ```bash
   npm install
   ```
3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and set `SESSION_SECRET` to a long random string. Generate one:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Create your admin login:
   ```bash
   node scripts/init-admin.js yourname yourStrongPassword
   ```
5. Start it:
   ```bash
   npm run dev
   ```
   - Site:  http://localhost:3000
   - Admin: http://localhost:3000/admin

Submit the contact form, then open the admin dashboard — your lead is there.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project** → import the repo.
3. Add a **Neon Postgres** database from the Vercel Storage tab and attach it to
   the project. Vercel sets `DATABASE_URL` for you.
4. Add environment variables in Vercel project settings:
   - `SESSION_SECRET` = your long random string
   - (optional) `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM` for email alerts on new leads
5. Deploy.
6. Create your admin user against the live database once. Easiest: run locally
   with the production `DATABASE_URL` temporarily in your `.env`:
   ```bash
   DATABASE_URL="postgres://..." node scripts/init-admin.js yourname yourStrongPassword
   ```

> Custom domain: add `northpeak.solutions` (or your domain) in Vercel's Domains tab.

---

## What's included

```
server.js              Express app: site, /api/contact, /admin
src/db.js              Storage layer (JSON file local / Neon Postgres prod)
src/auth.js            Session cookies (HMAC) + bcrypt password check
views/admin.js         Server-rendered admin dashboard
scripts/init-admin.js  Create/reset the admin user
public/                The marketing site (index, services, about, contact, privacy, terms)
```

## Admin dashboard

- **Leads** — every contact submission, with status (new / contacted / archived).
- **Clients** — store a config per client (ID, name, greeting, accent, knowledge URL).
  This is the groundwork for the embeddable chat widget; the embed snippet preview
  is shown at the bottom of that page for when you build the widget itself.

## Security notes

- Passwords are bcrypt-hashed; sessions are signed HMAC cookies (httpOnly).
- The contact form has a honeypot field + basic rate limiting.
- Keep `SESSION_SECRET` secret and never commit `.env`.
- The legal pages (`privacy.html`, `terms.html`) are **templates, not legal
  advice** — have them reviewed by an attorney before relying on them.

## Things to change before launch

- The homepage stats and case studies are **placeholders** — replace with real
  numbers once you have a pilot.
- `hello@northpeak.solutions` must be a real, monitored inbox.
- Add a favicon and Open Graph tags for link previews.

## Creating your admin on a live deployment (Vercel)

Instead of the Terminal, you can create your admin from a browser link:

1. In Vercel → your project → Settings → Environment Variables, add:
   - `SETUP_KEY` = any secret string only you know (e.g. a random word + numbers)
   (You should already have SESSION_SECRET, ANTHROPIC_API_KEY, and DATABASE_URL set.)
2. Redeploy so the variable takes effect.
3. In your browser, visit (replace the values):
   `https://YOUR-APP.vercel.app/setup?key=YOUR_SETUP_KEY&user=kevin&pass=YourPassword123`
   - Password must be at least 10 characters.
   - It will say "Admin created ✓".
4. Log in at `https://YOUR-APP.vercel.app/admin/login`.
5. IMPORTANT: when done, delete the `SETUP_KEY` environment variable in Vercel
   (and redeploy) so the setup link is disabled.

To reset a forgotten password later: re-add SETUP_KEY and visit the same link
with `&force=1` on the end.
