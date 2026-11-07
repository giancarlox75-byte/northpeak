# Team Reece: Campaign Website + Backend

The campaign site for **Kevin Reece**: born and raised in Flint, WMU political science graduate, building a stronger Michigan.

It has three parts:
- **The public website** (`public/`), built on the @officialreecehq branding
- **A backend** (`server.js`) that saves every form submission to a database
- **Campaign HQ** (`/admin`), a password-protected dashboard for reading and managing everything that comes in

## What gets saved

| Form on the site | Saved as | Where you see it |
|---|---|---|
| **Join the Team** (3-step volunteer form) | Volunteer: name, email, phone, ZIP, region, roles, availability, note | HQ → Volunteers |
| **Talk to Kevin** (comments, questions, event invites, press) | Message, with topic | HQ → Messages (a badge shows how many are new) |
| **Newsletter** (footer, plus opt-in boxes on the other forms) | Subscriber, with an unsubscribe link | HQ → Newsletter |
| **Event RSVP** | RSVP with guest count, one per person per event | HQ → RSVPs (head count per event) |
| **What Matters Most** poll | Anonymous vote, no name or email | HQ → Priorities, and live results on the site |

In Campaign HQ you can **search**, **set a status** (for example new → replied → archived), **delete** entries, **reply** by email in one click, and **export any list to CSV** for Excel, Google Sheets or a voter CRM.

**Email (optional, through [Resend](https://resend.com)):**
- You get an alert email for every new message, volunteer, subscriber and RSVP. Hitting Reply goes straight to that person.
- You can **write and send newsletters** from HQ → Newsletter. Each subscriber's first name is added at the top, and every email has a personal unsubscribe link.
- Optionally, people get an automatic "thanks, we got it" email.

**Spam and security:** a hidden honeypot field catches bots, and every form is rate-limited. Admin passwords are hashed with bcrypt, logins use signed cookies, cross-site requests are blocked, and CSV exports are protected against spreadsheet formula tricks.

---

## Put it online (about 20 minutes)

### 1. Create the project on Vercel
1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** → import the `northpeak` repo.
3. Set **Root Directory** to `teamreece`, then click **Deploy**.

### 2. Add the database (free)
1. In the Vercel project: **Storage → Create Database → Neon (Postgres)**, and connect it to the project.
2. Vercel adds `DATABASE_URL` for you. The tables are created automatically on first visit.

### 3. Add these environment variables
In **Settings → Environment Variables**:

| Name | Value |
|---|---|
| `SESSION_SECRET` | A long random string, e.g. from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SETUP_KEY` | Any secret word only you know. You delete it after step 4 |
| `SITE_URL` | Your site address, e.g. `https://teamreece.com` |

Then go to **Deployments → ⋯ → Redeploy**.

### 4. Create your admin login
1. Visit `https://YOUR-SITE/setup?key=YOUR_SETUP_KEY`.
2. Choose a username and a password (10+ characters).
3. Sign in at `https://YOUR-SITE/admin`.
4. **Delete `SETUP_KEY`** in Vercel and redeploy, which turns the setup page off.

### 5. Turn on email (recommended)
1. Create a free account at [resend.com](https://resend.com) and **verify your domain** (e.g. teamreece.com). Resend walks you through it.
2. Add these environment variables, then redeploy:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | From Resend → API Keys |
| `NOTIFY_EMAIL` | Where alerts go (e.g. your Gmail). Separate several with commas |
| `MAIL_FROM` | `Team Reece <hello@teamreece.com>` (must be on your verified domain) |
| `SEND_CONFIRMATIONS` | `1` to send automatic "thanks" emails, or `0` to skip them |

### 6. Connect your domain
Buy a domain (e.g. teamreece.com), then add it in Vercel → **Settings → Domains**. Update `SITE_URL` to match.

---

## Run it on your computer

```bash
cd teamreece
npm install
cp .env.example .env              # then set SESSION_SECRET in .env
npm run init-admin -- kevin yourLongPassword
npm run dev                        # http://localhost:3000  ·  admin: /admin
```

Locally, entries are saved to `data.json`, so no database is needed. `npm test` runs the backend tests. To run them against a real Postgres, set `TEST_DATABASE_URL`.

## Customizing

- **`public/config.js`**: office, district, election date, donate link, email, the "Paid for by" line, and events. The whole site updates from here.
- **Platform:** the `ISSUES` array in `public/app.js`. If you add or rename an issue, also update `ISSUE_LABELS` in `views/admin.js` so the dashboard shows its name.
- **Bio and photo:** the `#about` section of `public/index.html`. Put a photo at `public/assets/kevin.jpg` and replace the `KR` placeholder with `<img src="assets/kevin.jpg" alt="Kevin Reece">`.
- **Privacy policy:** `public/privacy.html`. This is a template, so have it reviewed before launch.

## Files

```
server.js              Express app: public API, admin, static site
src/db.js              Storage: Postgres in production (Neon or any Postgres), data.json locally
src/auth.js            Admin login (bcrypt + signed cookie) and cross-site protection
src/mail.js            Resend email: alerts, confirmations, newsletters
views/admin.js         Campaign HQ dashboard pages
scripts/init-admin.js  Create or reset the admin login from the terminal
test/api.test.js       End-to-end backend tests
public/                The website (index, privacy, 404, styles, app, config)
```

## Before you go live

- [ ] Deploy, add the database, and create your admin login (steps 1–4)
- [ ] Set up email (step 5) so you never miss a message
- [ ] Set `email` and `paidFor` in `public/config.js` (the committee's exact legal name once you form it)
- [ ] Add a photo of Kevin
- [ ] Review the platform text, the privacy policy and the events
- [ ] Add a donation processor link (`donateUrl`)
- [ ] Optional: let Senator-elect Julie Rogers know her name appears in your bio
