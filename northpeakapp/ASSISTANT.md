# The AI Assistant (the product you install for clients)

This is the part clients pay for: a chat assistant trained on *their* website,
embedded on *their* site with one line of code. The "brain" runs on your server.

## How it works

1. You add a client in the admin (Clients tab) with their website as the "Knowledge URL".
2. You click **Train** — your server scrapes their site, splits the text into
   chunks, and stores it as that client's knowledge base.
3. You give the client one line to paste on their site (shown in the admin):

   ```html
   <script src="https://YOUR-DOMAIN/embed.js" data-client="their-client-id"></script>
   ```

   Optional attributes: `data-title`, `data-accent="#2f7df6"`, `data-greeting="..."`.

4. When a visitor asks a question, the widget calls your `/api/chat`, which finds
   the most relevant chunks of that client's content and asks the AI to answer
   using only that content (with a "I'm not sure, contact us" fallback).

## Setting your AI key

Edit `.env` and set ONE of:
- `ANTHROPIC_API_KEY=...`  (from console.anthropic.com)
- `OPENAI_API_KEY=...`     (from platform.openai.com)

The app auto-detects which one is present. With only Anthropic, retrieval uses
keyword matching. Add OpenAI too for embedding-based (semantic) search.

## Installing the widget on a client's real site

- **WordPress:** a header/footer-scripts plugin, or theme footer settings.
- **Squarespace / Wix / Webflow:** the "code injection" / "custom code" box.
- **Custom site:** paste before </body> in the template.
- **Easiest for small clients:** do it for them with temporary editor access.

## Try it locally

1. Set `SESSION_SECRET` and an AI key in `.env`.
2. `npm install` then `npm run dev`.
3. In admin → Clients, add a client whose Knowledge URL is a real website, click **Train**.
4. Open `widget-test.html` in a browser (edit the client id + your localhost URL at the top)
   to see the widget talking to your trained assistant.

## Limits of this v1 (deliberately simple)
- Scrapes up to ~8 pages per site. Increase in src/knowledge.js if needed.
- Some sites block scraping; you may need to paste content manually (a future feature).
- Knowledge is re-built on demand (click Train again when their site changes).

## Usage caps & billing protection (new)

Each client has a **plan tier** and a monthly **conversation cap** (set in the admin → Clients).
- A "conversation" = one visitor session in a calendar month (not each message).
- When a client hits their cap, brand-new conversations get a polite "limit reached" message; in-progress chats are never cut off.
- The admin Clients tab shows a live usage bar (used / cap) for the current month.
- Caps protect your API bill: you always know your worst-case cost per client.

Tier defaults: Essential 300/mo, Professional 800/mo, Custom 100,000/mo, Trial 50/mo.
Set a per-client custom cap to override the tier default.

## Lead capture (the sellable feature)

The assistant now captures leads during conversation:
- When a visitor shows interest, the bot naturally asks for name + phone/email + reason (one question at a time).
- Once it has a name and a phone or email, the lead is saved to the admin Leads tab,
  tagged with the client_id and source = "assistant".
- The visitor sees a friendly confirmation; the machine tag used internally is hidden.
- The bot has conversation memory (last ~10 turns) so follow-ups make sense.

### Instant email to the business (optional but recommended)
To have each captured lead emailed to the business immediately:
1. Create a free account at resend.com and get an API key.
2. In your environment variables set:
   - RESEND_API_KEY = your Resend key
   - NOTIFY_EMAIL = where leads should go (your inbox, or the client's)
   - NOTIFY_FROM = e.g. "Northpeak <onboarding@resend.dev>" (works without a verified domain)
3. Redeploy. New leads now arrive by email the moment they're captured.

(Per-client notify email: a `notify_email` field on the client is supported if present;
otherwise it falls back to NOTIFY_EMAIL.)

### What the client sees
Leads from the contact form AND from assistants both appear in the admin Leads tab,
with a source badge ("form" vs "assistant") and the phone number click-to-call.
