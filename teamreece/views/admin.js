// views/admin.js — server-rendered Campaign HQ dashboard + organizer portal (Team Reece brand).
import { REGIONS, REGION_BY_ID } from '../src/regions.js';
import { TEAM_TRACKS, TRACK_BY_ID, EVENT_TYPES } from '../src/team.js';
import { PLAYBOOK } from '../src/playbook.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'America/Detroit';
const fmt = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? esc(d) : x.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }); };
// Event times are stored as Michigan wall-clock strings ("2026-12-06T18:00"); format them without shifting zones.
const fmtLocal = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); if (!m) return esc(s || '');
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
};
const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const regionName = (id) => (REGION_BY_ID[id] ? `R${REGION_BY_ID[id].num} · ${REGION_BY_ID[id].name}` : '');

// Keep in sync with ISSUES in public/app.js (id → label)
export const ISSUE_LABELS = {
  ai: 'AI & your rights', jobs: 'Good-paying jobs', housing: 'Affordable housing', costs: 'Everyday costs',
  schools: 'Public schools', pathways: 'College & trades', roads: 'Roads & bridges', energy: 'Energy & the grid',
  water: 'Clean water', mental: 'Mental health', rural: 'Rural & affordable care', open: 'Open government',
};

const MARK = `<svg viewBox="0 0 400 260" width="34" aria-hidden="true"><text x="190" y="238" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="290" fill="#fff">R</text><path d="M22,214 C110,140 230,98 336,86" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><polygon fill="#5b86ff" points="360,55 366.5,73.1 385.7,73.7 370.5,85.4 375.9,103.8 360,93 344.1,103.8 349.5,85.4 334.3,73.7 353.5,73.1"/></svg>`;

const STYLE = `
:root{--bg:#05070c;--ink:#0a0e17;--navy:#0d1424;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.18);--text:#e8ebf2;--muted:#9aa3b8;--blue:#3d6bff;--blue2:#5b86ff;--green:#3ecf8e;--amber:#f5b748;--red:#ff6b7a;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;font-size:14px}
a{color:var(--blue2);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:20px;padding:12px 24px;border-bottom:1px solid var(--line);background:rgba(5,7,12,.94);backdrop-filter:blur(10px);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.2em;font-size:12px;color:#fff;text-transform:uppercase}
.brand small{display:block;color:var(--muted);font-weight:600;letter-spacing:.24em;font-size:9px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;flex:1}
.tabs a{padding:8px 12px;border-radius:8px;color:var(--muted);font-weight:600;font-size:13px}
.tabs a:hover{color:#fff;background:rgba(255,255,255,.05);text-decoration:none}
.tabs a.active{color:#fff;background:rgba(61,107,255,.18)}
.tabs .badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:5px;border-radius:9px;background:var(--blue);color:#fff;font-size:11px;text-align:center}
.wrap{max-width:1200px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:26px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.06em;color:#fff}
h2{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--blue2);margin-bottom:14px}
h3{font-size:15px;color:#fff;margin-bottom:4px}
.sub{color:var(--muted);margin:4px 0 24px;max-width:760px}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.head .sub{margin-bottom:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.stat{background:var(--ink);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.stat b{display:block;font-size:28px;font-weight:800;color:#fff;line-height:1.1;font-variant-numeric:tabular-nums}
.stat span{color:var(--muted);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.stat em{display:block;font-style:normal;color:var(--green);font-size:12px;margin-top:4px}
.stat em.m{color:var(--muted)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid2>*{min-width:0}
.card{background:var(--ink);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:16px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--ink);margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{text-align:left;color:var(--muted);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:700}
td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
tr:hover td{background:rgba(255,255,255,.02)}
td.msg{max-width:420px;white-space:pre-wrap;word-break:break-word}
.muted{color:var(--muted)}.small{font-size:12px}.nowrap{white-space:nowrap}
.pill{display:inline-block;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid var(--line2);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.pill.new,.pill.going,.pill.subscribed,.pill.published,.pill.received{color:var(--blue2);border-color:rgba(91,134,255,.5)}
.pill.contacted,.pill.interviewing{color:var(--amber);border-color:rgba(245,183,72,.45)}
.pill.replied,.pill.attended,.pill.onboarded,.pill.active,.pill.verified{color:var(--green);border-color:rgba(62,207,142,.45)}
.pill.archived,.pill.unsubscribed,.pill.cancelled,.pill.inactive,.pill.draft,.pill.no-show{color:var(--muted)}
.pill.open{color:var(--red);border-color:rgba(255,107,122,.4)}
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.06);margin:0 4px 4px 0}
.tag.hq{background:rgba(61,107,255,.2);color:#cfdcff}.tag.regional{background:rgba(245,183,72,.15);color:#ffe2a8}.tag.organizer{background:rgba(62,207,142,.13);color:#b5f2d6}
input,select,textarea{background:var(--bg);border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:9px 11px;font:inherit;font-size:13px;max-width:100%}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--blue)}
textarea{width:100%;resize:vertical}
button,.btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:var(--blue);color:#fff;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:700;font-size:13px;white-space:nowrap}
button:hover,.btn:hover{background:var(--blue2);text-decoration:none}
button:focus-visible,.btn:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ghost{background:transparent;border:1px solid var(--line2);color:var(--text)}
.ghost:hover{background:rgba(255,255,255,.06)}
.danger{background:transparent;border:1px solid rgba(255,107,122,.35);color:var(--red);padding:6px 10px}
.danger:hover{background:rgba(255,107,122,.12)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.between{justify-content:space-between}
.acts{display:flex;gap:6px;align-items:center}
.acts select{padding:6px 8px;font-size:12px}
.search{min-width:240px}
.empty{padding:40px 20px;text-align:center;color:var(--muted)}
.bar{height:8px;border-radius:9px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:6px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--blue),#8fb0ff);border-radius:9px}
.prow{margin-bottom:14px}
.note{border-left:3px solid var(--amber);background:rgba(245,183,72,.07);padding:12px 16px;border-radius:0 10px 10px 0;margin-bottom:18px;color:var(--text)}
.note.ok{border-color:var(--green);background:rgba(62,207,142,.08)}
.note.err{border-color:var(--red);background:rgba(255,107,122,.08)}
label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin:14px 0 6px}
.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px}
.form-grid input,.form-grid select{width:100%}
.list-item{padding:12px 0;border-bottom:1px solid var(--line)}.list-item:last-child{border:0}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.filters a{padding:6px 12px;border-radius:99px;border:1px solid var(--line2);color:var(--muted);font-size:12px;font-weight:600}
.filters a.on{background:#fff;color:#05070c;border-color:#fff}
.filters a:hover{text-decoration:none;color:#fff}.filters a.on:hover{color:#05070c}
.org{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.seat{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.02)}
.seat.filled{border-color:rgba(62,207,142,.35)}
.seat .r{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.seat b{display:block;color:#fff;margin-top:2px}
.seat.open b{color:var(--red);font-weight:600}
.phase{margin-bottom:26px}
.check-item{scroll-margin-top:90px;display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--line);align-items:flex-start}
.check-item:last-child{border:0}
.check-item form{flex:none}
.tick{width:26px;height:26px;border-radius:7px;border:1.5px solid var(--line2);background:transparent;padding:0;justify-content:center;color:transparent;font-size:15px}
.tick:hover{background:rgba(255,255,255,.06)}
.tick.on{background:var(--green);border-color:var(--green);color:#05070c}
.check-item.done h3{color:var(--muted);text-decoration:line-through}
details summary{list-style:none}details summary::-webkit-details-marker{display:none}
@media(max-width:860px){.grid2{grid-template-columns:1fr}.search{min-width:0;width:100%}.top{gap:10px}.top form{margin-left:auto}.tabs{order:3;flex-basis:100%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.tabs a{flex:none}}
`;

const SCRIPT = `<script>
document.querySelectorAll('[data-search]').forEach(function(inp){
  var rows=document.querySelectorAll(inp.dataset.search+' tbody tr');
  inp.addEventListener('input',function(){var q=inp.value.toLowerCase();rows.forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>-1?'':'none'})});
});
document.querySelectorAll('form[data-confirm]').forEach(function(f){f.addEventListener('submit',function(e){if(!confirm(f.dataset.confirm))e.preventDefault()})});
document.querySelectorAll('select[data-autosubmit]').forEach(function(s){s.addEventListener('change',function(){s.form.submit()})});
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Copied ✓'})})});
// Team member form: show the roles for the chosen team, counties for the chosen region
var tm=document.getElementById('mTeam');if(tm){var sync=function(){document.querySelectorAll('[data-roles]').forEach(function(g){var on=g.dataset.roles===tm.value;g.hidden=!on;g.querySelectorAll('input').forEach(function(i){i.disabled=!on})})};tm.addEventListener('change',sync);sync()}
var rg=document.getElementById('mRegion'),ct=document.getElementById('mCounty');if(rg&&ct){var all=JSON.parse(ct.dataset.counties),fill=function(){var cur=ct.dataset.value||ct.value;ct.innerHTML='<option value="">—</option>'+(all[rg.value]||[]).map(function(c){return '<option'+(c===cur?' selected':'')+'>'+c+'</option>'}).join('');ct.dataset.value=''};rg.addEventListener('change',fill);fill()}
</script>`;

const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · Team Reece HQ</title><link rel="icon" href="/assets/favicon.svg"><style>${STYLE}</style></head><body>${body}${SCRIPT}</body></html>`;

const centered = (inner, width = 420) => `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div style="width:min(${width}px,100%)">
<div class="brand" style="justify-content:center;margin-bottom:22px">${MARK}<div>Team Reece HQ<small>Campaign dashboard</small></div></div>
<div class="card" style="padding:30px">${inner}</div></div></div>`;

/* ---------------------------------------------------------------- auth pages */
export function loginPage(error) {
  return shell('Sign in', centered(`${error ? `<div class="note err">${esc(error)}</div>` : ''}
    <form method="post" action="/admin/login">
      <label for="u">Username</label><input id="u" name="username" autofocus autocomplete="username" style="width:100%">
      <label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" style="width:100%">
      <button type="submit" style="width:100%;justify-content:center;margin-top:20px;padding:12px">Sign in</button>
    </form>`));
}

export function setupPage({ key, error, done }) {
  if (done) return shell('Setup', centered(`<div class="note ok">Admin <b>${esc(done)}</b> created ✓</div>
    <p class="muted">Now <a href="/admin/login">sign in</a>. For security, delete the <b>SETUP_KEY</b> environment variable when you're done.</p>`));
  return shell('Setup', centered(`<h2>Create your admin login</h2>${error ? `<div class="note err">${esc(error)}</div>` : ''}
    ${key ? `<form method="post" action="/setup">
      <input type="hidden" name="key" value="${esc(key)}">
      <label for="su">Username</label><input id="su" name="user" required style="width:100%" autocomplete="username">
      <label for="sp">Password (10+ characters)</label><input id="sp" name="pass" type="password" required minlength="10" style="width:100%" autocomplete="new-password">
      <label class="row" style="text-transform:none;letter-spacing:0;font-weight:500"><input type="checkbox" name="force" value="1"> Reset password if this username exists</label>
      <button type="submit" style="width:100%;justify-content:center;margin-top:16px;padding:12px">Create admin</button>
    </form>` : ''}`));
}

export function unsubscribePage(token, state) {
  const body = state === 'done'
    ? `<h2>You're unsubscribed</h2><p class="muted">You won't get any more campaign emails from us. Changed your mind? You can sign up again any time on <a href="/">the website</a>.</p>`
    : state === 'missing'
      ? `<h2>Link not found</h2><p class="muted">This unsubscribe link is invalid or has already been used. Email us and we'll remove you right away.</p>`
      : token
        ? `<h2>Unsubscribe?</h2><p class="muted" style="margin-bottom:18px">Click below to stop receiving Team Reece emails.</p>
           <form method="post" action="/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit" style="width:100%;justify-content:center;padding:12px">Unsubscribe me</button></form>`
        : `<h2>Missing link</h2><p class="muted">Use the unsubscribe link from the bottom of one of our emails.</p>`;
  return shell('Unsubscribe', centered(body));
}

/* ---------------------------------------------------------------- organizer portal (/team) */
export function teamPortal({ enabled, shifts = [], regions = REGIONS, error, done, report, form = {} }) {
  if (done) return shell('Report filed', centered(`<div class="note ok">Report filed. Thank you for knocking doors for Team Reece! ★</div>
    ${report ? `<p class="muted">${nf(report.doors)} doors · ${nf(report.conversations)} conversations · ${nf(report.supporters)} supporters identified</p>` : ''}
    <p style="margin-top:16px"><a href="/team">File another report</a> · <a href="/">Back to the website</a></p>`, 520));
  if (!enabled) return shell('Organizer portal', centered(`<h2>Organizer portal</h2><p class="muted">Canvass reporting isn't open yet. Your Regional Director will share the link and access code when shifts begin.</p>`, 520));
  const v = (k) => esc(form[k] ?? '');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
  return shell('Organizer portal', centered(`<h2>File canvass results</h2>
    <p class="muted" style="margin-bottom:6px">After each shift, report your numbers here. They go straight to Campaign HQ and count toward your region's goal.</p>
    ${error ? `<div class="note err" style="margin-top:14px">${esc(error)}</div>` : ''}
    <form method="post" action="/team">
      <div style="position:absolute;left:-10000px" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
      <label for="tc">Team access code</label><input id="tc" name="code" required autocomplete="off" style="width:100%" value="${v('code')}">
      <div class="form-grid">
        <div><label for="tn">Your name</label><input id="tn" name="name" required autocomplete="name" value="${v('name')}"></div>
        <div><label for="te">Email</label><input id="te" name="email" type="email" required autocomplete="email" value="${v('email')}"></div>
        <div><label for="tr">Region</label><select id="tr" name="region" required><option value="">Choose…</option>${regions.map((r) => `<option value="${r.id}"${form.region === r.id ? ' selected' : ''}>Region ${r.num} · ${esc(r.name)}</option>`).join('')}</select></div>
        <div><label for="td">Date</label><input id="td" name="report_date" type="date" value="${v('report_date') || today}"></div>
      </div>
      <label for="ts">Shift (optional)</label><select id="ts" name="event_key" style="width:100%"><option value="">Not part of a scheduled shift</option>${shifts.map((e) => `<option value="ev:${e.id}">${esc(e.title)} · ${fmtLocal(e.starts_at)}</option>`).join('')}</select>
      <div class="form-grid">
        ${[['doors', 'Doors knocked'], ['conversations', 'Conversations'], ['supporters', 'Supporters identified'], ['undecided', 'Undecided'], ['recruits', 'New volunteers recruited'], ['signs', 'Yard sign requests']]
          .map(([k, l]) => `<div><label for="t-${k}">${l}</label><input id="t-${k}" name="${k}" type="number" min="0" inputmode="numeric" value="${v(k) || 0}"></div>`).join('')}
      </div>
      <label for="tnotes">Notes for the team (optional)</label><textarea id="tnotes" name="notes" rows="3" placeholder="Issues people raised, follow-ups needed…">${v('notes')}</textarea>
      <button type="submit" style="width:100%;justify-content:center;margin-top:18px;padding:12px">Submit report</button>
    </form>`, 640));
}

/* ---------------------------------------------------------------- layout */
export function layout(title, active, content, user, badges = {}) {
  const tab = (id, href, label) => `<a href="${href}" class="${active === id ? 'active' : ''}">${label}${badges[id] ? `<span class="badge">${badges[id]}</span>` : ''}</a>`;
  return shell(title, `<header class="top">
    <a href="/admin" class="brand" style="text-decoration:none">${MARK}<div>Team Reece HQ<small>Campaign dashboard</small></div></a>
    <nav class="tabs" aria-label="Campaign HQ">${tab('overview', '/admin', 'Overview')}${tab('messages', '/admin/messages', 'Messages')}${tab('team', '/admin/team', 'Team')}${tab('events', '/admin/events', 'Events')}${tab('field', '/admin/field', 'Field')}${tab('newsletter', '/admin/newsletter', 'Newsletter')}${tab('playbook', '/admin/playbook', 'Playbook')}</nav>
    <form method="post" action="/admin/logout" class="row"><a href="/" target="_blank" class="small">View site ↗</a><span class="muted small">${esc(user?.username)}</span><button class="ghost" type="submit">Log out</button></form>
  </header><main class="wrap">${content}</main>`);
}

const STATUSES = {
  volunteers: ['new', 'contacted', 'interviewing', 'onboarded', 'active', 'inactive', 'archived'],
  messages: ['new', 'replied', 'archived'], subscribers: ['subscribed', 'unsubscribed'],
  rsvps: ['going', 'attended', 'no-show', 'cancelled'], events: ['published', 'draft', 'cancelled'], field_reports: ['received', 'verified'],
};
const statusForm = (table, r) => `<form method="post" action="/admin/${table}/${r.id}/status" class="acts">
  <select name="status" data-autosubmit aria-label="Status">${STATUSES[table].map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
  <noscript><button>Save</button></noscript></form>`;
const delForm = (table, r, what, next, label = '✕') => `<form method="post" action="/admin/${table}/${r.id}/delete" data-confirm="Permanently delete this ${what}?">${next ? `<input type="hidden" name="next" value="${esc(next)}">` : ''}<button class="danger" title="Delete ${what}" aria-label="Delete ${what}">${label}</button></form>`;
const searchBox = (id, placeholder) => `<input class="search" placeholder="${placeholder}" data-search="#${id}" aria-label="Search">`;
const exportBtn = (table, qs = '') => `<a class="btn ghost" href="/admin/export/${table}.csv${qs}">⤓ Export CSV</a>`;
const empty = (msg) => `<div class="tbl"><div class="empty">${msg}</div></div>`;
const flash = (q) => `${q.saved ? '<div class="note ok">Saved ✓</div>' : ''}${q.err ? `<div class="note err">${esc(q.err)}</div>` : ''}`;

function tallyRows(tally, limit = 12) {
  const rows = Object.entries(tally.scores).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r[1])), total = rows.reduce((a, r) => a + r[1], 0) || 1;
  return rows.length ? rows.map(([id, score]) => `<div class="prow"><div class="row between"><b>${esc(ISSUE_LABELS[id] || id)}</b><span class="muted small">${score} pts · ${Math.round((score / total) * 100)}%</span></div><div class="bar"><i style="width:${(score / max) * 100}%"></i></div></div>`).join('')
    : '<p class="muted">No votes yet. They\'ll appear as visitors use "What Matters Most" on the site.</p>';
}

/* ---------------------------------------------------------------- overview */
export function overview({ counts: c, tally, messages, members, upcoming, playbook, mail, postgres }) {
  return `<div class="head"><div><h1>Campaign HQ</h1><p class="sub">Everything coming in from the website, and everything you need to run the campaign.</p></div></div>
  ${!postgres ? '<div class="note">Running on the local <b>data.json</b> file. That\'s fine for testing, but connect a Postgres database (DATABASE_URL) before launch so entries are saved permanently.</div>' : ''}
  ${!mail ? '<div class="note">Email alerts are off. Add <b>RESEND_API_KEY</b> and <b>NOTIFY_EMAIL</b> to get an email for every new message, application and volunteer, and to send newsletters.</div>' : ''}
  <div class="stats">
    <div class="stat"><b>${c.messagesNew}</b><span>New messages</span><em class="m">${c.messages} total</em></div>
    <div class="stat"><b>${c.applicants}</b><span>Applications to review</span><em class="m">HQ + regional</em></div>
    <div class="stat"><b>${c.volunteers}</b><span>Team members</span><em>+${c.volunteersWeek} this week</em></div>
    <div class="stat"><b>${c.subscribers}</b><span>Subscribers</span><em>+${c.subscribersWeek} this week</em></div>
    <div class="stat"><b>${nf(c.doors)}</b><span>Doors knocked</span></div>
    <div class="stat"><b>${playbook.done}/${playbook.total}</b><span>Playbook done</span><div class="bar"><i style="width:${(playbook.done / playbook.total) * 100}%"></i></div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="row between"><h2>Latest messages</h2><a class="small" href="/admin/messages">All →</a></div>
      ${messages.length ? messages.map((m) => `<div class="list-item"><div class="row between"><b>${esc(m.name)}</b><span class="pill ${esc(m.status)}">${esc(m.status)}</span></div>
        <div class="small muted">${esc(m.topic)} · ${ago(m.created_at)}</div><div class="small" style="margin-top:4px">${esc(String(m.message).slice(0, 140))}${String(m.message).length > 140 ? '…' : ''}</div></div>`).join('') : '<p class="muted">No messages yet.</p>'}</div>
    <div class="card"><div class="row between"><h2>Newest team members</h2><a class="small" href="/admin/team">Team →</a></div>
      ${members.length ? members.map((v) => `<div class="list-item"><div class="row between"><a href="/admin/team/${v.id}"><b>${esc(v.first)} ${esc(v.last)}</b></a><span class="small muted">${ago(v.created_at)}</span></div>
        <div class="small"><span class="tag ${esc(v.team)}">${esc(TRACK_BY_ID[v.team]?.name || 'Organizers')}</span> ${esc(regionName(v.region))}</div><div class="small muted">${esc(v.help || '')}</div></div>`).join('') : '<p class="muted">No sign-ups yet.</p>'}</div>
  </div>
  <div class="grid2">
    <div class="card"><div class="row between"><h2>Coming up</h2><a class="small" href="/admin/events">Events →</a></div>
      ${upcoming.length ? upcoming.map((e) => `<div class="list-item"><div class="row between"><a href="/admin/events/${e.id}"><b>${esc(e.title)}</b></a><span class="small muted">${e.going}${e.capacity ? ` / ${e.capacity}` : ''} going</span></div><div class="small muted">${fmtLocal(e.starts_at)} · ${esc(e.location)}</div></div>`).join('') : '<p class="muted">Nothing scheduled. <a href="/admin/events">Add an event or shift</a>.</p>'}</div>
    <div class="card"><div class="row between"><h2>What voters care about</h2><a class="small" href="/admin/priorities">Details →</a></div>${tallyRows(tally, 5)}</div>
  </div>`;
}

/* ---------------------------------------------------------------- messages */
export function messages(rows) {
  return `<div class="head"><div><h1>Messages</h1><p class="sub">Comments, questions, invitations and press inquiries sent through the Contact form.</p></div><div class="row">${searchBox('t', 'Search messages…')}${exportBtn('messages')}</div></div>
  ${rows.length ? `<div class="tbl"><table id="t"><thead><tr><th>Received</th><th>From</th><th>Topic</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((m) => `<tr><td class="nowrap small muted">${fmt(m.created_at)}</td>
    <td><b>${esc(m.name)}</b><br><a href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Team Reece')}">${esc(m.email)}</a>${m.phone ? `<br><span class="small muted">${esc(m.phone)}</span>` : ''}${m.zip ? `<br><span class="small muted">ZIP ${esc(m.zip)}</span>` : ''}</td>
    <td><span class="tag">${esc(m.topic)}</span></td><td class="msg">${esc(m.message)}</td>
    <td>${statusForm('messages', m)}</td><td><div class="acts"><a class="btn ghost" style="padding:6px 10px" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Team Reece')}">Reply</a>${delForm('messages', m, 'message')}</div></td></tr>`).join('')}
  </tbody></table></div>` : empty('No messages yet. They\'ll show up here when people use the Contact form.')}`;
}

/* ---------------------------------------------------------------- team */
const LIVE = ['onboarded', 'active'];
const PIPE = ['new', 'contacted', 'interviewing'];
const hasRole = (m, role) => String(m.role || '').split('; ').includes(role);

export function team(members, f) {
  const by = (t) => members.filter((m) => m.team === t);
  const hq = by('hq'), regional = by('regional'), org = by('organizer');
  const hqTrack = TRACK_BY_ID.hq;

  const hqChart = hqTrack.roles.map((r) => {
    const filled = hq.find((m) => hasRole(m, r.id) && LIVE.includes(m.status));
    const apps = hq.filter((m) => hasRole(m, r.id) && PIPE.includes(m.status)).length;
    return filled
      ? `<div class="seat filled"><div class="r">${esc(r.name)}</div><b><a href="/admin/team/${filled.id}">${esc(filled.first)} ${esc(filled.last)}</a></b><div class="small muted">${esc(filled.status)}</div></div>`
      : `<div class="seat open"><div class="r">${esc(r.name)}</div><b>Open</b><div class="small muted">${apps ? `<a href="/admin/team?team=hq&status=new#roster">${apps} applicant${apps > 1 ? 's' : ''} in review</a>` : 'No applicants yet'}</div></div>`;
  }).join('');

  const regionRows = REGIONS.map((r) => {
    const here = members.filter((m) => m.region === r.id);
    const director = regional.find((m) => m.region === r.id && hasRole(m, 'regional-director') && LIVE.includes(m.status));
    const captains = regional.filter((m) => m.region === r.id && hasRole(m, 'county-captain') && LIVE.includes(m.status));
    const covered = new Set(captains.map((m) => m.county).filter(Boolean));
    const organizers = here.filter((m) => m.team === 'organizer' && !['inactive', 'archived'].includes(m.status)).length;
    const apps = here.filter((m) => m.team !== 'organizer' && PIPE.includes(m.status)).length;
    return `<tr><td><b>Region ${r.num} · ${esc(r.name)}</b><div class="small muted">${r.counties.length} counties · ${esc(r.cities.slice(0, 2).join(', '))}</div></td>
      <td>${director ? `<a href="/admin/team/${director.id}">${esc(director.first)} ${esc(director.last)}</a>` : '<span class="pill open">Open</span>'}</td>
      <td class="num">${covered.size} / ${r.counties.length}</td><td class="num">${organizers}</td><td class="num">${apps ? `<a href="/admin/team?region=${r.id}#roster">${apps}</a>` : 0}</td>
      <td><a class="small" href="/admin/team?region=${r.id}#roster">Roster →</a></td></tr>`;
  }).join('');

  let rows = members;
  if (f.team) rows = rows.filter((m) => m.team === f.team);
  if (f.region) rows = rows.filter((m) => m.region === f.region);
  if (f.status) rows = rows.filter((m) => m.status === f.status);
  const qs = (o) => { const p = new URLSearchParams(Object.entries({ ...f, ...o }).filter(([, v]) => v)).toString(); return p ? `?${p}` : ''; };
  const filterBar = `<div class="filters">${[['', 'Everyone'], ...TEAM_TRACKS.map((t) => [t.id, t.name])].map(([id, n]) => `<a href="/admin/team${qs({ team: id })}#roster" class="${f.team === id ? 'on' : ''}">${esc(n)} (${id ? by(id).length : members.length})</a>`).join('')}
    <select aria-label="Filter by region" onchange="location.href=this.value"><option value="/admin/team${qs({ region: '' })}#roster">All regions</option>${REGIONS.map((r) => `<option value="/admin/team${qs({ region: r.id })}#roster"${f.region === r.id ? ' selected' : ''}>Region ${r.num} · ${esc(r.name)}</option>`).join('')}</select>
    <select aria-label="Filter by status" onchange="location.href=this.value"><option value="/admin/team${qs({ status: '' })}#roster">Any status</option>${STATUSES.volunteers.map((s) => `<option value="/admin/team${qs({ status: s })}#roster"${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>`;

  return `<div class="head"><div><h1>Team</h1><p class="sub">Three teams: <b>HQ Office</b> (Kevin's core staff), <b>Regional Leadership</b> (a director for each of Michigan's 10 regions, plus county captains), and <b>Organizers</b> who knock doors and make calls. A seat counts as filled once that person is <b>onboarded</b> or <b>active</b>.</p></div></div>
  <div class="stats">
    <div class="stat"><b>${new Set(hq.filter((m) => LIVE.includes(m.status)).flatMap((m) => String(m.role || '').split('; '))).size} / ${hqTrack.roles.length}</b><span>HQ seats filled</span><em class="m">${hq.filter((m) => PIPE.includes(m.status)).length} in review</em></div>
    <div class="stat"><b>${REGIONS.filter((r) => regional.some((m) => m.region === r.id && hasRole(m, 'regional-director') && LIVE.includes(m.status))).length} / 10</b><span>Regions with a director</span><em class="m">${regional.filter((m) => PIPE.includes(m.status)).length} in review</em></div>
    <div class="stat"><b>${org.filter((m) => !['inactive', 'archived'].includes(m.status)).length}</b><span>Organizers</span><em class="m">${org.filter((m) => m.status === 'active').length} active</em></div>
  </div>
  <div class="card"><h2>HQ Office · Kevin's team</h2><div class="org">${hqChart}</div></div>
  <h2 style="margin-top:8px">Regional Leadership</h2>
  <div class="tbl"><table><thead><tr><th>Region</th><th>Regional Director</th><th class="num">Counties with a captain</th><th class="num">Organizers</th><th class="num">Applicants</th><th></th></tr></thead><tbody>${regionRows}</tbody></table></div>
  <div class="row between" id="roster" style="margin:24px 0 10px"><h2 style="margin:0">Roster</h2><div class="row">${searchBox('t', 'Search name, email, ZIP…')}${exportBtn('volunteers', f.team ? `?team=${f.team}` : '')}</div></div>
  ${filterBar}
  ${rows.length ? `<div class="tbl"><table id="t"><thead><tr><th>Name</th><th>Team & role</th><th>Region</th><th>Contact</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((m) => `<tr><td><a href="/admin/team/${m.id}"><b>${esc(m.first)} ${esc(m.last)}</b></a>${m.hours ? `<div class="small muted">${esc(m.hours)} hrs/week</div>` : ''}</td>
    <td><span class="tag ${esc(m.team)}">${esc(TRACK_BY_ID[m.team]?.name || 'Organizers')}</span><div class="small">${esc(m.help || '-')}</div></td>
    <td class="small">${esc(regionName(m.region) || '-')}${m.county ? `<br><span class="muted">${esc(m.county)} County</span>` : ''}<br><span class="muted">ZIP ${esc(m.zip)}</span></td>
    <td class="small"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? `<br>${esc(m.phone)}` : ''}</td>
    <td class="small muted nowrap">${fmt(m.created_at)}</td><td>${statusForm('volunteers', m)}</td><td>${delForm('volunteers', m, 'team member')}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No one matches these filters yet.')}`;
}

export function member(m, saved) {
  const countiesByRegion = Object.fromEntries(REGIONS.map((r) => [r.id, r.counties]));
  const roles = String(m.role || '').split('; ');
  return `<p class="small" style="margin-bottom:10px"><a href="/admin/team">← Team</a></p>
  <div class="head"><div><h1>${esc(m.first)} ${esc(m.last)}</h1><p class="sub"><span class="tag ${esc(m.team)}">${esc(TRACK_BY_ID[m.team]?.name || 'Organizers')}</span> Signed up ${fmt(m.created_at)} · <span class="pill ${esc(m.status)}">${esc(m.status)}</span></p></div>
    <div class="row"><a class="btn" href="mailto:${esc(m.email)}">Email ${esc(m.first)}</a>${m.phone ? `<a class="btn ghost" href="tel:${esc(m.phone)}">Call</a>` : ''}</div></div>
  ${saved ? '<div class="note ok">Saved ✓</div>' : ''}
  <div class="grid2">
    <div class="card"><h2>Assignment</h2>
      <form method="post" action="/admin/team/${m.id}">
        <div class="form-grid">
          <div><label for="mTeam">Team</label><select id="mTeam" name="team">${TEAM_TRACKS.map((t) => `<option value="${t.id}"${m.team === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
          <div><label for="mStatus">Status</label><select id="mStatus" name="status">${STATUSES.volunteers.map((s) => `<option${s === m.status ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
          <div><label for="mRegion">Region</label><select id="mRegion" name="region"><option value="">—</option>${REGIONS.map((r) => `<option value="${r.id}"${m.region === r.id ? ' selected' : ''}>Region ${r.num} · ${esc(r.name)}</option>`).join('')}</select></div>
          <div><label for="mCounty">County</label><select id="mCounty" name="county" data-counties="${esc(JSON.stringify(countiesByRegion))}" data-value="${esc(m.county || '')}"><option value="">—</option></select></div>
          <div><label for="mPhone">Phone</label><input id="mPhone" name="phone" value="${esc(m.phone || '')}"></div>
        </div>
        <label>Role(s)</label>
        ${TEAM_TRACKS.map((t) => `<div data-roles="${t.id}">${t.roles.map((r) => `<label class="row" style="text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);margin:6px 0"><input type="checkbox" name="role" value="${r.id}"${roles.includes(r.id) ? ' checked' : ''}> ${esc(r.name)}</label>`).join('')}</div>`).join('')}
        <label for="mNotes">Internal notes</label><textarea id="mNotes" name="notes" rows="5" placeholder="Interview notes, follow-ups, training completed…">${esc(m.notes || '')}</textarea>
        <div class="row" style="margin-top:16px"><button type="submit">Save changes</button></div>
      </form>
    </div>
    <div>
      <div class="card"><h2>Contact</h2>
        <p><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>${m.phone ? `<p>${esc(m.phone)}</p>` : ''}<p class="muted">ZIP ${esc(m.zip)}${m.county ? ` · ${esc(m.county)} County` : ''}</p>
        ${m.link ? `<p style="margin-top:8px"><a href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">Résumé / LinkedIn ↗</a></p>` : ''}
      </div>
      <div class="card"><h2>What they told us</h2>
        <p class="small muted">Signed up for</p><p style="margin-bottom:10px">${esc(m.help || '-')}</p>
        ${m.hours ? `<p class="small muted">Hours per week</p><p style="margin-bottom:10px">${esc(m.hours)}</p>` : ''}
        ${m.availability ? `<p class="small muted">Availability</p><p style="margin-bottom:10px">${esc(m.availability)}</p>` : ''}
        ${m.experience ? `<p class="small muted">Experience</p><p style="white-space:pre-wrap;margin-bottom:10px">${esc(m.experience)}</p>` : ''}
        ${m.message ? `<p class="small muted">Note</p><p style="white-space:pre-wrap">${esc(m.message)}</p>` : ''}
      </div>
      ${delForm('volunteers', m, 'team member', '/admin/team', 'Delete this person')}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- events */
const eventForm = (e = {}, action) => `<form method="post" action="${action}">
  <div class="form-grid">
    <div style="grid-column:1/-1"><label for="eTitle">Title</label><input id="eTitle" name="title" required maxlength="160" value="${esc(e.title || '')}" placeholder="Saturday Canvass: Flint East Side"></div>
    <div><label for="eType">Type</label><select id="eType" name="type">${EVENT_TYPES.map((t) => `<option${t === e.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label for="eRegion">Region</label><select id="eRegion" name="region"><option value="">Statewide / online</option>${REGIONS.map((r) => `<option value="${r.id}"${e.region === r.id ? ' selected' : ''}>Region ${r.num} · ${esc(r.name)}</option>`).join('')}</select></div>
    <div><label for="eStart">Starts (Michigan time)</label><input id="eStart" name="starts_at" type="datetime-local" required value="${esc(e.starts_at || '')}"></div>
    <div><label for="eEnd">Ends</label><input id="eEnd" name="ends_at" type="datetime-local" value="${esc(e.ends_at || '')}"></div>
    <div><label for="eLoc">Location</label><input id="eLoc" name="location" maxlength="200" value="${esc(e.location || '')}" placeholder="Address, or Online"></div>
    <div><label for="eCap">Capacity / shift slots</label><input id="eCap" name="capacity" type="number" min="0" value="${esc(e.capacity || '')}" placeholder="Blank = unlimited"></div>
    <div><label for="eStatus">Visibility</label><select id="eStatus" name="status">${[['published', 'Published on website'], ['draft', 'Draft (hidden)'], ['cancelled', 'Cancelled (hidden)']].map(([v, l]) => `<option value="${v}"${(e.status || 'published') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
  </div>
  <label for="eDesc">Description</label><textarea id="eDesc" name="description" rows="3" maxlength="2000" placeholder="What to expect, what to bring, where to park…">${esc(e.description || '')}</textarea>
  <div class="row" style="margin-top:14px"><button type="submit">${e.id ? 'Save event' : 'Create event'}</button></div>
</form>`;

export function events(list, rsvps, now, q) {
  const counts = {};
  rsvps.filter((r) => r.status !== 'cancelled').forEach((r) => (counts[r.event_key] = (counts[r.event_key] || 0) + 1 + (Number(r.guests) || 0)));
  const upcoming = list.filter((e) => (e.ends_at || e.starts_at) >= now), past = list.filter((e) => (e.ends_at || e.starts_at) < now).reverse();
  const rowsFor = (arr) => arr.map((e) => { const n = counts[`ev:${e.id}`] || 0; return `<tr><td class="nowrap small">${fmtLocal(e.starts_at)}</td><td><a href="/admin/events/${e.id}"><b>${esc(e.title)}</b></a><div class="small muted">${esc(e.location || '')}</div></td>
    <td><span class="tag">${esc(e.type)}</span></td><td class="small">${esc(regionName(e.region) || 'Statewide')}</td>
    <td class="num">${n}${e.capacity ? ` / ${e.capacity}` : ''}${e.capacity && n >= e.capacity ? ' <span class="pill open">Full</span>' : ''}</td><td><span class="pill ${esc(e.status)}">${esc(e.status)}</span></td>
    <td>${delForm('events', e, 'event')}</td></tr>`; }).join('');
  const table = (arr) => `<div class="tbl"><table><thead><tr><th>When</th><th>Event</th><th>Type</th><th>Region</th><th class="num">Going</th><th>Status</th><th></th></tr></thead><tbody>${rowsFor(arr)}</tbody></table></div>`;
  return `<div class="head"><div><h1>Events & shifts</h1><p class="sub">Everything published here appears in the website's Events section, where people RSVP. For canvass and phone bank <b>shifts</b>, set a capacity: the site shows spots left and closes sign-ups when full.</p></div></div>
  ${flash(q)}
  <details class="card"${list.length ? '' : ' open'}><summary style="cursor:pointer;font-weight:700;color:#fff">+ New event or shift</summary><div style="margin-top:10px">${eventForm({}, '/admin/events')}</div></details>
  <h2>Upcoming</h2>${upcoming.length ? table(upcoming) : empty('Nothing scheduled yet. Add your first event above.')}
  ${past.length ? `<h2 style="margin-top:20px">Past</h2>${table(past)}` : ''}`;
}

export function eventDetail(e, rsvps, q) {
  const going = rsvps.filter((r) => r.status !== 'cancelled'), heads = going.reduce((a, r) => a + 1 + (Number(r.guests) || 0), 0);
  return `<p class="small" style="margin-bottom:10px"><a href="/admin/events">← Events</a></p>
  <div class="head"><div><h1>${esc(e.title)}</h1><p class="sub">${fmtLocal(e.starts_at)}${e.location ? ` · ${esc(e.location)}` : ''} · <span class="pill ${esc(e.status)}">${esc(e.status)}</span></p></div></div>
  ${flash(q)}
  <div class="stats"><div class="stat"><b>${heads}${e.capacity ? ` / ${e.capacity}` : ''}</b><span>People coming</span><em class="m">${going.length} RSVPs + guests</em></div>
    <div class="stat"><b>${rsvps.filter((r) => r.status === 'attended').length}</b><span>Checked in</span></div></div>
  <div class="grid2">
    <div class="card"><h2>Details</h2>${eventForm(e, `/admin/events/${e.id}`)}</div>
    <div><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">RSVPs</h2><div class="row"><button class="ghost" type="button" data-copy="${esc(going.map((r) => r.email).join(', '))}">Copy emails</button>${exportBtn('rsvps', `?event=ev:${e.id}`)}</div></div>
      ${rsvps.length ? `<div class="tbl"><table><thead><tr><th>Name</th><th class="num">Guests</th><th>Status</th><th></th></tr></thead><tbody>
      ${rsvps.map((r) => `<tr><td><b>${esc(r.name)}</b><br><a class="small" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td><td class="num">${r.guests ? '+' + esc(r.guests) : '-'}</td><td>${statusForm('rsvps', r)}</td><td>${delForm('rsvps', r, 'RSVP')}</td></tr>`).join('')}
      </tbody></table></div><p class="small muted">Mark people <b>attended</b> at the door to track turnout.</p>` : empty('No RSVPs yet.')}</div>
  </div>`;
}

/* ---------------------------------------------------------------- field */
export function field(reports, goals, code, siteUrl, q) {
  const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const K = ['doors', 'conversations', 'supporters', 'undecided', 'recruits', 'signs'];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const week = reports.filter((r) => String(r.report_date) >= weekAgo);
  const totalGoal = Object.values(goals).reduce((a, g) => a + g, 0), totalDoors = sum(reports, 'doors');
  const regionRows = REGIONS.map((r) => {
    const rr = reports.filter((x) => x.region === r.id), doors = sum(rr, 'doors'), goal = goals[r.id] || 0;
    return `<tr><td class="nowrap"><b>R${r.num} · ${esc(r.name)}</b></td>${K.map((k) => `<td class="num">${nf(sum(rr, k))}</td>`).join('')}
      <td style="min-width:180px"><div class="small">${goal ? `${Math.round((doors / goal) * 100)}% of ${nf(goal)}` : '<span class="muted">No goal set</span>'}</div>${goal ? `<div class="bar"><i style="width:${Math.min(100, (doors / goal) * 100)}%"></i></div>` : ''}</td></tr>`;
  }).join('');
  return `<div class="head"><div><h1>Field</h1><p class="sub">Canvass and phone bank results that organizers report through the portal at <a href="/team" target="_blank">${esc(siteUrl)}/team</a>.</p></div>${exportBtn('field_reports')}</div>
  ${flash(q)}
  ${!code ? '<div class="note">The organizer portal is <b>closed</b> until you set a team access code below.</div>' : ''}
  <div class="stats">
    <div class="stat"><b>${nf(totalDoors)}</b><span>Doors knocked</span><em>+${nf(sum(week, 'doors'))} this week</em></div>
    <div class="stat"><b>${nf(sum(reports, 'conversations'))}</b><span>Conversations</span></div>
    <div class="stat"><b>${nf(sum(reports, 'supporters'))}</b><span>Supporters identified</span></div>
    <div class="stat"><b>${nf(sum(reports, 'recruits'))}</b><span>Volunteers recruited</span></div>
    <div class="stat"><b>${totalGoal ? `${Math.round((totalDoors / totalGoal) * 100)}%` : '–'}</b><span>Of door goal</span>${totalGoal ? `<div class="bar"><i style="width:${Math.min(100, (totalDoors / totalGoal) * 100)}%"></i></div>` : '<em class="m">Set goals below</em>'}</div>
  </div>
  <h2>By region</h2>
  <div class="tbl"><table><thead><tr><th>Region</th><th class="num">Doors</th><th class="num">Talks</th><th class="num">Supporters</th><th class="num">Undecided</th><th class="num">Recruits</th><th class="num">Signs</th><th>Door goal</th></tr></thead><tbody>${regionRows}</tbody></table></div>
  <div class="grid2">
    <div class="card"><h2>Settings</h2>
      <form method="post" action="/admin/field/settings">
        <label for="fCode">Organizer access code</label>
        <input id="fCode" name="team_code" value="${esc(code || '')}" placeholder="e.g. flint-strong-26" style="width:100%" autocomplete="off">
        <p class="small muted" style="margin-top:6px">Share this with organizers along with the /team link. Leave it blank to close the portal. Change it any time.</p>
        <label>Door-knocking goals by region</label>
        <div class="form-grid">${REGIONS.map((r) => `<div><label for="g-${r.id}" style="margin-top:6px">R${r.num} · ${esc(r.name)}</label><input id="g-${r.id}" name="goal_${r.id}" type="number" min="0" value="${esc(goals[r.id] || '')}" placeholder="0"></div>`).join('')}</div>
        <div class="row" style="margin-top:16px"><button type="submit">Save settings</button></div>
      </form></div>
    <div><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Latest reports</h2>${searchBox('fr', 'Search…')}</div>
      ${reports.length ? `<div class="tbl"><table id="fr"><thead><tr><th>Date</th><th>Organizer</th><th class="num">Doors</th><th class="num">Supp.</th><th></th></tr></thead><tbody>
      ${reports.slice(0, 50).map((r) => `<tr><td class="small nowrap">${esc(r.report_date)}</td><td><b>${esc(r.name)}</b><div class="small muted">${esc(regionName(r.region))}${r.event_title ? ` · ${esc(r.event_title)}` : ''}</div>${r.notes ? `<div class="small" style="white-space:pre-wrap">${esc(r.notes)}</div>` : ''}</td>
        <td class="num">${nf(r.doors)}</td><td class="num">${nf(r.supporters)}</td><td>${delForm('field_reports', r, 'report')}</td></tr>`).join('')}
      </tbody></table></div>` : empty('No reports yet.')}</div>
  </div>`;
}

/* ---------------------------------------------------------------- playbook */
export function playbook(state) {
  const total = PLAYBOOK.reduce((a, p) => a + p.items.length, 0), done = PLAYBOOK.reduce((a, p) => a + p.items.filter((i) => state[i.id]).length, 0);
  return `<div class="head"><div><h1>Playbook</h1><p class="sub">Everything it takes to launch and run the campaign, in order. Michigan-specific steps link to official sources. Always confirm dates and requirements with the Michigan Bureau of Elections, because laws and calendars change.</p></div>
    <div class="stat" style="min-width:220px"><b>${done} / ${total}</b><span>Steps done</span><div class="bar"><i style="width:${(done / total) * 100}%"></i></div></div></div>
  ${PLAYBOOK.map((p, i) => `<section class="card phase"><div class="row between"><h2 style="margin:0">${i + 1}. ${esc(p.phase)}</h2><span class="small muted">${p.items.filter((x) => state[x.id]).length} / ${p.items.length}</span></div>
    ${p.items.map((it) => { const s = state[it.id]; return `<div class="check-item${s ? ' done' : ''}" id="${it.id}">
      <form method="post" action="/admin/playbook/${it.id}"><input type="hidden" name="done" value="${s ? '0' : '1'}"><button class="tick${s ? ' on' : ''}" aria-label="${s ? 'Mark not done' : 'Mark done'}: ${esc(it.title)}">✓</button></form>
      <div><h3>${esc(it.title)}</h3><p class="small muted">${esc(it.detail)}</p>${it.link ? `<p class="small" style="margin-top:4px"><a href="${esc(it.link)}" target="_blank" rel="noopener">Official source ↗</a></p>` : ''}
      ${s ? `<p class="small" style="color:var(--green);margin-top:4px">Done ${fmt(s.at)} by ${esc(s.by)}</p>` : ''}</div></div>`; }).join('')}
  </section>`).join('')}`;
}

/* ---------------------------------------------------------------- newsletter */
export function newsletter(subs, sent, mail, q = {}) {
  const active = subs.filter((s) => s.status === 'subscribed');
  return `<div class="head"><div><h1>Newsletter</h1><p class="sub">${active.length} active subscribers · ${subs.length - active.length} unsubscribed</p></div>
    <div class="row"><button class="ghost" type="button" data-copy="${esc(active.map((s) => s.email).join(', '))}">Copy all emails</button>${exportBtn('subscribers')}</div></div>
  ${q.ok ? `<div class="note ok">Newsletter sent to ${esc(q.ok)} subscribers${Number(q.failed) ? ` (${esc(q.failed)} failed, check your Resend dashboard)` : ''}.</div>` : ''}
  ${q.err ? `<div class="note err">${esc(q.err)}</div>` : ''}
  <div class="grid2">
    <div class="card"><h2>Send an update</h2>
      ${mail ? '' : '<div class="note">Sending is off until email is set up (RESEND_API_KEY + MAIL_FROM with a verified domain). Until then you can export the list and send from any email tool.</div>'}
      <form method="post" action="/admin/newsletter/send" data-confirm="Send this email to all ${active.length} subscribers now?">
        <label for="s">Subject</label><input id="s" name="subject" required maxlength="200" style="width:100%" placeholder="Big news from Team Reece">
        <label for="b">Message</label><textarea id="b" name="body" rows="10" required placeholder="Write your update. Each subscriber's name is added at the top, and an unsubscribe link at the bottom."></textarea>
        <label for="c">Type SEND to confirm</label><div class="row"><input id="c" name="confirm" autocomplete="off" placeholder="SEND" style="width:120px"><button type="submit" ${mail ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>Send to ${active.length} subscribers</button></div>
      </form></div>
    <div class="card"><h2>Sent</h2>${sent.length ? sent.map((n) => `<div class="list-item"><b>${esc(n.subject)}</b><div class="small muted">${fmt(n.created_at)} · sent to ${esc(n.sent_count)}${Number(n.failed_count) ? ` · ${esc(n.failed_count)} failed` : ''}</div></div>`).join('') : '<p class="muted">Nothing sent yet.</p>'}</div>
  </div>
  <div class="row between" style="margin:10px 0 14px"><h2 style="margin:0">Subscribers</h2>${searchBox('t', 'Search emails…')}</div>
  ${subs.length ? `<div class="tbl"><table id="t"><thead><tr><th>Email</th><th>Name</th><th>ZIP</th><th>Source</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>
  ${subs.map((s) => `<tr><td><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td>${esc(s.first || '-')}</td><td>${esc(s.zip || '-')}</td><td><span class="tag">${esc(s.source || '-')}</span></td>
    <td class="small muted nowrap">${fmt(s.created_at)}</td><td>${statusForm('subscribers', s)}</td><td>${delForm('subscribers', s, 'subscriber')}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No subscribers yet.')}`;
}

export function priorities(tally) {
  return `<p class="small" style="margin-bottom:10px"><a href="/admin">← Overview</a></p><div class="head"><div><h1>Priorities</h1><p class="sub">${tally.voters} people have ranked their top 3 issues on the website. A #1 pick earns 3 points, #2 earns 2, and #3 earns 1.</p></div></div>
  <div class="card">${tallyRows(tally)}</div>`;
}
