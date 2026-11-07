# Team Reece: Campaign Website

The campaign site for **Kevin Reece**: born and raised in Flint, WMU political science graduate, building a stronger Michigan.

A campaign platform site built on the **@officialreecehq** branding: black and navy, white, an electric "HERE." blue, the R-and-star mark, the Michigan outline and the Capitol skyline.

It's plain HTML, CSS and JS with no build step. Open `index.html` or deploy the folder to any static host (Vercel, Netlify, GitHub Pages).

## Once you pick an office

Edit **`config.js`** and the whole site updates:

| Field | What it does |
|---|---|
| `office`, `district` | Leave blank and the site reads "Team Reece". Set them (e.g. `"State House"`, `"District 42"`) and it reads "Reece for State House · District 42" in the hero, the page title and the FAQ |
| `firstName` | Adds your first name to the signature and FAQ |
| `electionDate` | Drives the countdown. Next Michigan generals: **2028-11-07** (State House, U.S. House) and **2030-11-05** (Governor, State Senate, U.S. Senate) |
| `donateUrl` | Your ActBlue, WinRed or processor link. While it's blank, the Donate button shows "coming soon" |
| `paidFor` | The legal "Paid for by…" line. Required once you form a committee |
| `events` | The event list. Past events hide automatically |

## What's interactive

- **Hero:** animated starfield with shooting stars, a logo that draws itself in, a live election countdown, and the Capitol with a tree line
- **Platform:** 11 issues with category filters. Each card opens a full plan (The Problem, The Plan, Why It Matters) with share and next-issue buttons
- **Your Voice:** visitors rank their top 3 issues, see the results bars, and share their picks
- **Region map:** 8 clickable Michigan regions with local focus and key issues. "Organize here" pre-fills the volunteer form
- **Events:** RSVP toggle and one-tap **add to calendar** (.ics download)
- **Join:** a 3-step volunteer form with validation, ending in confetti and a "Founding Member" card
- **Donate:** amount picker, one-time or monthly, and a live "your impact" message
- **Newsletter, FAQ, back-to-top, mobile menu,** and support for reduced motion

## Platform content

The platform is built around Kevin's top priorities, marked `top: true` and shown first with a "Top priority" badge: **AI & tech safety, Michigan innovation, strong schools, affordable basics, and higher wages**. Supporting issues are housing, health and wellness, access to justice, open government, and clean water. They're all in the `ISSUES` array in `app.js`. Review every bullet so each one reflects positions you're ready to defend.

## Meet Kevin

The bio and timeline are in the `#about` section of `index.html`. To add a photo, put it at `assets/kevin.jpg` and replace the `KR` placeholder inside `.portrait` with `<img src="assets/kevin.jpg" alt="Kevin Reece">`.

## Data storage

Right now, sign-ups, newsletter emails, RSVPs and priority votes are saved **in each visitor's own browser** (localStorage). Visit `index.html?admin` to see and **export to CSV** the sign-ups made on that device.

Before launch, connect the forms to a real backend so you collect everyone's submissions (e.g. Formspree, Airtable, or the Neon database already used by `northpeakapp`). Until then, the "Your Voice" results only reflect votes from the same browser.

## Before you go live

- [ ] Choose the office and fill in `config.js`
- [ ] Form a committee and update `paidFor` with its exact name and address
- [ ] Add a photo of Kevin
- [ ] Review the platform bullets and edit any you wouldn't defend
- [ ] Optional: let Senator-elect Julie Rogers know her name appears in your bio
- [ ] Connect the forms to a backend
- [ ] Add a donation processor link
- [ ] Replace the placeholder events with real ones
- [ ] Check Michigan Bureau of Elections filing deadlines and requirements for your office
