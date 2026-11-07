// views/admin.js — server-rendered Campaign HQ dashboard (Team Reece brand).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? esc(d) : x.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' }); };
const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

// Keep in sync with ISSUES in public/app.js (id → label)
export const ISSUE_LABELS = {
  ai: 'AI & your rights', jobs: 'Good-paying jobs', housing: 'Affordable housing', costs: 'Everyday costs',
  schools: 'Public schools', pathways: 'College & trades', roads: 'Roads & bridges', energy: 'Energy & the grid',
  water: 'Clean water', mental: 'Mental health', rural: 'Rural & affordable care', open: 'Open government',
};
const REGION_LABELS = { up: 'Upper Peninsula', north: 'Northern Michigan', west: 'West Michigan', bay: 'Great Lakes Bay', thumb: 'The Thumb', capital: 'Capital Region', metro: 'Metro Detroit', southwest: 'Southwest Michigan' };

const MARK = `<svg viewBox="0 0 400 260" width="34" aria-hidden="true"><text x="190" y="238" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="290" fill="#fff">R</text><path d="M22,214 C110,140 230,98 336,86" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><polygon fill="#5b86ff" points="360,55 366.5,73.1 385.7,73.7 370.5,85.4 375.9,103.8 360,93 344.1,103.8 349.5,85.4 334.3,73.7 353.5,73.1"/></svg>`;

const STYLE = `
:root{--bg:#05070c;--ink:#0a0e17;--navy:#0d1424;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.18);--text:#e8ebf2;--muted:#9aa3b8;--blue:#3d6bff;--blue2:#5b86ff;--green:#3ecf8e;--amber:#f5b748;--red:#ff6b7a}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;font-size:14px}
a{color:var(--blue2);text-decoration:none}a:hover{text-decoration:underline}
.top{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:20px;padding:12px 24px;border-bottom:1px solid var(--line);background:rgba(5,7,12,.92);backdrop-filter:blur(10px);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.2em;font-size:12px;color:#fff;text-transform:uppercase}
.brand small{display:block;color:var(--muted);font-weight:600;letter-spacing:.24em;font-size:9px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;flex:1}
.tabs a{padding:8px 13px;border-radius:8px;color:var(--muted);font-weight:600;font-size:13px;position:relative}
.tabs a:hover{color:#fff;background:rgba(255,255,255,.05);text-decoration:none}
.tabs a.active{color:#fff;background:rgba(61,107,255,.18)}
.tabs .badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:5px;border-radius:9px;background:var(--blue);color:#fff;font-size:11px;text-align:center}
.wrap{max-width:1180px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:26px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.06em;color:#fff}
h2{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--blue2);margin-bottom:14px}
.sub{color:var(--muted);margin:4px 0 24px}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.head .sub{margin-bottom:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px}
.stat{background:var(--ink);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.stat b{display:block;font-size:30px;font-weight:800;color:#fff;line-height:1.1}
.stat span{color:var(--muted);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.stat em{display:block;font-style:normal;color:var(--green);font-size:12px;margin-top:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:var(--ink);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:16px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--ink)}
table{width:100%;border-collapse:collapse}
th{text-align:left;color:var(--muted);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:700}
td{padding:13px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
tr:hover td{background:rgba(255,255,255,.02)}
td.msg{max-width:420px;white-space:pre-wrap;word-break:break-word}
.muted{color:var(--muted)}.small{font-size:12px}.nowrap{white-space:nowrap}
.pill{display:inline-block;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;border:1px solid var(--line2);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.pill.new,.pill.going,.pill.subscribed{color:var(--blue2);border-color:rgba(91,134,255,.5)}
.pill.contacted,.pill.replied,.pill.attended{color:var(--green);border-color:rgba(62,207,142,.45)}
.pill.active{color:var(--amber);border-color:rgba(245,183,72,.45)}
.pill.archived,.pill.unsubscribed,.pill.cancelled{color:var(--muted)}
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.06);margin:0 4px 4px 0}
input,select,textarea{background:var(--bg);border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:9px 11px;font:inherit;font-size:13px}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--blue)}
textarea{width:100%;resize:vertical}
button,.btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:var(--blue);color:#fff;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:700;font-size:13px;white-space:nowrap}
button:hover,.btn:hover{background:var(--blue2);text-decoration:none}
.ghost{background:transparent;border:1px solid var(--line2);color:var(--text)}
.ghost:hover{background:rgba(255,255,255,.06)}
.danger{background:transparent;border:1px solid rgba(255,107,122,.35);color:var(--red);padding:6px 10px}
.danger:hover{background:rgba(255,107,122,.12)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.acts{display:flex;gap:6px;align-items:center}
.acts select{padding:6px 8px;font-size:12px}
.search{min-width:240px}
.empty{padding:50px 20px;text-align:center;color:var(--muted)}
.bar{height:8px;border-radius:9px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:6px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--blue),#8fb0ff);border-radius:9px}
.prow{margin-bottom:14px}.prow .row{justify-content:space-between}
.note{border-left:3px solid var(--amber);background:rgba(245,183,72,.07);padding:12px 16px;border-radius:0 10px 10px 0;margin-bottom:18px;color:var(--text)}
.note.ok{border-color:var(--green);background:rgba(62,207,142,.08)}
.note.err{border-color:var(--red);background:rgba(255,107,122,.08)}
label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin:14px 0 6px}
.list-item{padding:12px 0;border-bottom:1px solid var(--line)}.list-item:last-child{border:0}
@media(max-width:800px){.grid2{grid-template-columns:1fr}.search{min-width:0;width:100%}.top{gap:10px}.top form{margin-left:auto}.tabs{order:3;flex-basis:100%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.tabs a{flex:none}}
`;

const SEARCH_JS = `<script>
document.querySelectorAll('[data-search]').forEach(function(inp){
  var rows=document.querySelectorAll(inp.dataset.search+' tbody tr');
  inp.addEventListener('input',function(){var q=inp.value.toLowerCase();rows.forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>-1?'':'none'})});
});
document.querySelectorAll('form[data-confirm]').forEach(function(f){f.addEventListener('submit',function(e){if(!confirm(f.dataset.confirm))e.preventDefault()})});
document.querySelectorAll('select[data-autosubmit]').forEach(function(s){s.addEventListener('change',function(){s.form.submit()})});
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Copied ✓'})})});
</script>`;

const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · Team Reece HQ</title><link rel="icon" href="/assets/favicon.svg"><style>${STYLE}</style></head><body>${body}${SEARCH_JS}</body></html>`;

const centered = (inner) => `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div style="width:min(420px,100%)">
<div class="brand" style="justify-content:center;margin-bottom:22px">${MARK}<div>Team Reece HQ<small>Campaign dashboard</small></div></div>
<div class="card" style="padding:30px">${inner}</div></div></div>`;

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
      <label>Username</label><input name="user" required style="width:100%" autocomplete="username">
      <label>Password (10+ characters)</label><input name="pass" type="password" required minlength="10" style="width:100%" autocomplete="new-password">
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

export function layout(title, active, content, user, badges = {}) {
  const tab = (id, href, label) => `<a href="${href}" class="${active === id ? 'active' : ''}">${label}${badges[id] ? `<span class="badge">${badges[id]}</span>` : ''}</a>`;
  return shell(title, `<header class="top">
    <a href="/admin" class="brand" style="text-decoration:none">${MARK}<div>Team Reece HQ<small>Campaign dashboard</small></div></a>
    <nav class="tabs">${tab('overview', '/admin', 'Overview')}${tab('messages', '/admin/messages', 'Messages')}${tab('volunteers', '/admin/volunteers', 'Volunteers')}${tab('newsletter', '/admin/newsletter', 'Newsletter')}${tab('rsvps', '/admin/rsvps', 'RSVPs')}${tab('priorities', '/admin/priorities', 'Priorities')}</nav>
    <form method="post" action="/admin/logout" class="row"><a href="/" target="_blank" class="small">View site ↗</a><span class="muted small">${esc(user?.username)}</span><button class="ghost" type="submit">Log out</button></form>
  </header><main class="wrap">${content}</main>`);
}

const statusForm = (table, r) => `<form method="post" action="/admin/${table}/${r.id}/status" class="acts">
  <select name="status" data-autosubmit aria-label="Status">${STATUSES[table].map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
  <noscript><button>Save</button></noscript></form>`;
const delForm = (table, r, what) => `<form method="post" action="/admin/${table}/${r.id}/delete" data-confirm="Permanently delete this ${what}?"><button class="danger" title="Delete">✕</button></form>`;
const STATUSES = { volunteers: ['new', 'contacted', 'active', 'archived'], messages: ['new', 'replied', 'archived'], subscribers: ['subscribed', 'unsubscribed'], rsvps: ['going', 'attended', 'cancelled'] };
const toolbar = (id, table, placeholder) => `<div class="row"><input class="search" placeholder="${placeholder}" data-search="#${id}" aria-label="Search"><a class="btn ghost" href="/admin/export/${table}.csv">⤓ Export CSV</a></div>`;
const empty = (msg) => `<div class="tbl"><div class="empty">${msg}</div></div>`;

function tallyRows(tally, limit = 12) {
  const rows = Object.entries(tally.scores).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r[1])), total = rows.reduce((a, r) => a + r[1], 0) || 1;
  return rows.length ? rows.map(([id, score]) => `<div class="prow"><div class="row"><b>${esc(ISSUE_LABELS[id] || id)}</b><span class="muted small">${score} pts · ${Math.round((score / total) * 100)}%</span></div><div class="bar"><i style="width:${(score / max) * 100}%"></i></div></div>`).join('')
    : '<p class="muted">No votes yet. They\'ll appear as visitors use "What Matters Most" on the site.</p>';
}

export function overview({ counts: c, tally, messages, volunteers, mail, postgres }) {
  return `<div class="head"><div><h1>Campaign HQ</h1><p class="sub">Everything coming in from the website.</p></div></div>
  ${!postgres ? '<div class="note">Running on the local <b>data.json</b> file. That\'s fine for testing, but connect a Postgres database (DATABASE_URL) before launch so entries are saved permanently.</div>' : ''}
  ${!mail ? '<div class="note">Email alerts are off. Add <b>RESEND_API_KEY</b> and <b>NOTIFY_EMAIL</b> to get an email for every new message and volunteer, and to send newsletters.</div>' : ''}
  <div class="stats">
    <div class="stat"><b>${c.messagesNew}</b><span>New messages</span><em class="muted" style="color:var(--muted)">${c.messages} total</em></div>
    <div class="stat"><b>${c.volunteers}</b><span>Volunteers</span><em>+${c.volunteersWeek} this week</em></div>
    <div class="stat"><b>${c.subscribers}</b><span>Subscribers</span><em>+${c.subscribersWeek} this week</em></div>
    <div class="stat"><b>${c.rsvps}</b><span>Event RSVPs</span></div>
    <div class="stat"><b>${c.votes}</b><span>Priority votes</span></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="row" style="justify-content:space-between"><h2>Latest messages</h2><a class="small" href="/admin/messages">All →</a></div>
      ${messages.length ? messages.map((m) => `<div class="list-item"><div class="row" style="justify-content:space-between"><b>${esc(m.name)}</b><span class="pill ${esc(m.status)}">${esc(m.status)}</span></div>
        <div class="small muted">${esc(m.topic)} · ${ago(m.created_at)}</div><div class="small" style="margin-top:4px">${esc(String(m.message).slice(0, 140))}${String(m.message).length > 140 ? '…' : ''}</div></div>`).join('') : '<p class="muted">No messages yet.</p>'}</div>
    <div class="card"><div class="row" style="justify-content:space-between"><h2>Newest volunteers</h2><a class="small" href="/admin/volunteers">All →</a></div>
      ${volunteers.length ? volunteers.map((v) => `<div class="list-item"><div class="row" style="justify-content:space-between"><b>${esc(v.first)} ${esc(v.last)}</b><span class="small muted">${ago(v.created_at)}</span></div>
        <div class="small muted">${esc(REGION_LABELS[v.region] || v.region || '')} · ${esc(v.zip)}</div><div class="small" style="margin-top:4px">${esc(v.help || 'No roles picked')}</div></div>`).join('') : '<p class="muted">No volunteers yet.</p>'}</div>
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2>What voters care about</h2><a class="small" href="/admin/priorities">Details →</a></div>${tallyRows(tally, 6)}</div>`;
}

export function messages(rows) {
  return `<div class="head"><div><h1>Messages</h1><p class="sub">Comments, questions, invitations and press inquiries sent through the Contact form.</p></div>${toolbar('t', 'messages', 'Search messages…')}</div>
  ${rows.length ? `<div class="tbl"><table id="t"><thead><tr><th>Received</th><th>From</th><th>Topic</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((m) => `<tr><td class="nowrap small muted">${fmt(m.created_at)}</td>
    <td><b>${esc(m.name)}</b><br><a href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Team Reece')}">${esc(m.email)}</a>${m.phone ? `<br><span class="small muted">${esc(m.phone)}</span>` : ''}${m.zip ? `<br><span class="small muted">ZIP ${esc(m.zip)}</span>` : ''}</td>
    <td><span class="tag">${esc(m.topic)}</span></td><td class="msg">${esc(m.message)}</td>
    <td>${statusForm('messages', m)}</td><td><div class="acts"><a class="btn ghost" style="padding:6px 10px" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Team Reece')}">Reply</a>${delForm('messages', m, 'message')}</div></td></tr>`).join('')}
  </tbody></table></div>` : empty('No messages yet. They\'ll show up here when people use the Contact form.')}`;
}

export function volunteers(rows) {
  return `<div class="head"><div><h1>Volunteers</h1><p class="sub">${rows.length} people have signed up to help.</p></div>${toolbar('t', 'volunteers', 'Search name, ZIP, region…')}</div>
  ${rows.length ? `<div class="tbl"><table id="t"><thead><tr><th>Signed up</th><th>Name</th><th>Contact</th><th>Location</th><th>Wants to</th><th>Available</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((v) => `<tr><td class="nowrap small muted">${fmt(v.created_at)}</td><td><b>${esc(v.first)} ${esc(v.last)}</b></td>
    <td><a href="mailto:${esc(v.email)}">${esc(v.email)}</a>${v.phone ? `<br><span class="small muted">${esc(v.phone)}</span>` : ''}</td>
    <td class="nowrap">${esc(REGION_LABELS[v.region] || v.region || '-')}<br><span class="small muted">ZIP ${esc(v.zip)}</span></td>
    <td>${String(v.help || '').split('; ').filter(Boolean).map((h) => `<span class="tag">${esc(h)}</span>`).join('') || '<span class="muted">-</span>'}</td>
    <td class="small">${esc(v.availability || '-')}</td><td class="msg small">${esc(v.message || '')}</td>
    <td>${statusForm('volunteers', v)}</td><td>${delForm('volunteers', v, 'volunteer')}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No volunteers yet. They\'ll show up here when people use the Join form.')}`;
}

export function rsvps(rows) {
  const byEvent = {};
  rows.forEach((r) => { (byEvent[r.event_key] ||= { title: r.event_title, date: r.event_date, list: [] }).list.push(r); });
  const groups = Object.values(byEvent).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return `<div class="head"><div><h1>RSVPs</h1><p class="sub">Who's coming to each event.</p></div>${toolbar('t', 'rsvps', 'Search…')}</div>
  ${groups.length ? `<div class="stats">${groups.map((g) => { const going = g.list.filter((r) => r.status !== 'cancelled'); return `<div class="stat"><b>${going.length + going.reduce((a, r) => a + (Number(r.guests) || 0), 0)}</b><span>${esc(g.title)}</span><em class="muted" style="color:var(--muted)">${fmt(g.date)}</em></div>`; }).join('')}</div>
  <div class="tbl"><table id="t"><thead><tr><th>Event</th><th>Name</th><th>Email</th><th>Guests</th><th>RSVP'd</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td><b>${esc(r.event_title)}</b><br><span class="small muted">${fmt(r.event_date)}</span></td><td>${esc(r.name)}</td><td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
    <td>${r.guests ? '+' + esc(r.guests) : '-'}</td><td class="small muted nowrap">${fmt(r.created_at)}</td><td>${statusForm('rsvps', r)}</td><td>${delForm('rsvps', r, 'RSVP')}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No RSVPs yet.')}`;
}

export function newsletter(subs, sent, mail, q = {}) {
  const active = subs.filter((s) => s.status === 'subscribed');
  return `<div class="head"><div><h1>Newsletter</h1><p class="sub">${active.length} active subscribers · ${subs.length - active.length} unsubscribed</p></div>
    <div class="row"><button class="ghost" type="button" data-copy="${esc(active.map((s) => s.email).join(', '))}">Copy all emails</button><a class="btn ghost" href="/admin/export/subscribers.csv">⤓ Export CSV</a></div></div>
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
  <div class="row" style="justify-content:space-between;margin:10px 0 14px"><h2 style="margin:0">Subscribers</h2><input class="search" placeholder="Search emails…" data-search="#t" aria-label="Search"></div>
  ${subs.length ? `<div class="tbl"><table id="t"><thead><tr><th>Email</th><th>Name</th><th>ZIP</th><th>Source</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>
  ${subs.map((s) => `<tr><td><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td>${esc(s.first || '-')}</td><td>${esc(s.zip || '-')}</td><td><span class="tag">${esc(s.source || '-')}</span></td>
    <td class="small muted nowrap">${fmt(s.created_at)}</td><td>${statusForm('subscribers', s)}</td><td>${delForm('subscribers', s, 'subscriber')}</td></tr>`).join('')}
  </tbody></table></div>` : empty('No subscribers yet.')}`;
}

export function priorities(tally) {
  return `<div class="head"><div><h1>Priorities</h1><p class="sub">${tally.voters} people have ranked their top 3 issues. A #1 pick earns 3 points, #2 earns 2, and #3 earns 1.</p></div></div>
  <div class="card">${tallyRows(tally)}</div>`;
}
