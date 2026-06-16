// views/admin.js — server-rendered admin UI, styled to match Northpeak.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLE = `
  :root{--ink:#0b1014;--ink-2:#0f161c;--paper:#e9eef0;--muted:#7c8a93;--line:rgba(233,238,240,.10);--cyan:#5fd4d6;--copper:#c98a5e}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:ui-sans-serif,system-ui,sans-serif;background:var(--ink);color:var(--paper);line-height:1.5}
  a{color:var(--cyan);text-decoration:none}
  .mono{font-family:ui-monospace,'JetBrains Mono',monospace}
  .top{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--line);background:var(--ink-2)}
  .brand{font-weight:700;font-size:16px;letter-spacing:-.01em}
  .brand small{color:var(--muted);font-size:9px;letter-spacing:.28em;display:block}
  .tabs{display:flex;gap:8px}
  .tabs a{padding:8px 16px;border:1px solid var(--line);border-radius:6px;color:var(--muted);font-size:14px}
  .tabs a.active{color:var(--ink);background:var(--cyan);border-color:var(--cyan);font-weight:600}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 28px}
  h1{font-size:24px;margin-bottom:6px;font-weight:700}
  .sub{color:var(--muted);font-size:14px;margin-bottom:26px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--line)}
  td{padding:14px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:hover td{background:rgba(255,255,255,.02)}
  .pill{font-size:11px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);text-transform:uppercase;letter-spacing:.05em}
  .pill.new{color:var(--cyan);border-color:rgba(95,212,214,.4)}
  .pill.contacted{color:var(--copper);border-color:rgba(201,138,94,.4)}
  .pill.archived{color:var(--muted)}
  select,input,textarea{background:var(--ink);border:1px solid var(--line);color:var(--paper);border-radius:6px;padding:8px 10px;font:inherit;font-size:13px}
  button{cursor:pointer;background:var(--cyan);color:var(--ink);border:none;border-radius:6px;padding:8px 14px;font-weight:600;font-size:13px}
  button.ghost{background:transparent;border:1px solid var(--line);color:var(--paper)}
  .empty{padding:60px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}
  .card{border:1px solid var(--line);border-radius:12px;padding:22px;background:var(--ink-2);margin-bottom:18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
  label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
  .row{display:flex;gap:8px;align-items:center}
  form.inline{display:inline}
`;

export function loginPage(error) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Northpeak Admin — Login</title><style>${STYLE}
  .login{max-width:360px;margin:14vh auto;padding:0 20px}
  .login .card{padding:30px}
  .login input{width:100%;margin-bottom:14px;padding:12px}
  .login button{width:100%;padding:12px}
  .err{color:#ff8a8a;font-size:13px;margin-bottom:14px}
  </style></head><body>
  <div class="login">
    <div class="brand" style="margin-bottom:20px">Northpeak<small>SOLUTIONS · ADMIN</small></div>
    <div class="card">
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <form method="post" action="/admin/login">
        <label>Username</label><input name="username" autofocus autocomplete="username">
        <label>Password</label><input name="password" type="password" autocomplete="current-password">
        <button type="submit">Sign in</button>
      </form>
    </div>
  </div></body></html>`;
}

export function adminLayout(title, content, user, active) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Northpeak Admin — ${esc(title)}</title><style>${STYLE}</style></head><body>
  <div class="top">
    <div class="brand">Northpeak<small>SOLUTIONS · ADMIN</small></div>
    <div class="tabs">
      <a href="/admin" class="${active === 'leads' ? 'active' : ''}">Leads</a>
      <a href="/admin/clients" class="${active === 'clients' ? 'active' : ''}">Clients</a>
    </div>
    <form method="post" action="/admin/logout" class="row">
      <span class="mono" style="color:var(--muted);font-size:12px">${esc(user.username)}</span>
      <button class="ghost" type="submit">Log out</button>
    </form>
  </div>
  <div class="wrap">${content}</div></body></html>`;
}

export function leadsView(leads) {
  if (!leads.length) return `<h1>Leads</h1><p class="sub">Leads from your contact form and your assistants land here.</p>
    <div class="empty">No leads yet. When the contact form or a website assistant captures someone, they'll appear here.</div>`;
  const rows = leads.map((l) => {
    const status = l.status || 'new';
    const src = l.source || 'form';
    const srcBadge = src === 'bot'
      ? '<span class="pill new" title="Captured by an assistant">assistant</span>'
      : '<span class="pill" style="color:var(--muted)">form</span>';
    const contactLines = [];
    if (l.email) contactLines.push(`<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>`);
    if (l.phone) contactLines.push(`<a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>`);
    return `<tr>
      <td class="mono" style="color:var(--muted);white-space:nowrap">${esc(String(l.created_at).slice(0, 16).replace('T', ' '))}</td>
      <td><strong>${esc(l.name)}</strong><br>${contactLines.join('<br>') || '<span style="color:var(--muted)">—</span>'}</td>
      <td>${srcBadge}${l.client_id ? `<br><span class="mono" style="font-size:11px;color:var(--muted)">${esc(l.client_id)}</span>` : ''}</td>
      <td style="max-width:320px;color:#cdd6dc">${esc(l.message) || '<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="pill ${status}">${esc(status)}</span></td>
      <td>
        <form class="inline" method="post" action="/admin/leads/${l.id}/status">
          <select name="status" onchange="this.form.submit()">
            <option ${status==='new'?'selected':''}>new</option>
            <option ${status==='contacted'?'selected':''}>contacted</option>
            <option ${status==='archived'?'selected':''}>archived</option>
          </select>
        </form>
      </td></tr>`;
  }).join('');
  const botCount = leads.filter((l) => (l.source||'form') === 'bot').length;
  return `<h1>Leads</h1><p class="sub">${leads.length} total · ${botCount} captured by assistants.</p>
    <table><thead><tr><th>Date</th><th>Contact</th><th>Source</th><th>Reason / message</th><th>Status</th><th>Set</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

export function clientsView(clients) {
  const rows = clients.length ? clients.map((c) => {
    const used = c._usage || 0;
    const cap = c._cap || 0;
    const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
    const barColor = pct >= 90 ? '#ff8a8a' : pct >= 70 ? 'var(--copper)' : 'var(--cyan)';
    return `<tr>
      <td class="mono">${esc(c.client_id)}</td>
      <td>${esc(c.name)}</td>
      <td><span class="pill ${c.tier === 'professional' ? 'new' : ''}">${esc(c.tier || 'essential')}</span></td>
      <td style="min-width:130px">
        <div style="font-size:12px;color:#cdd6dc">${used} / ${cap} <span style="color:var(--muted)">this month</span></div>
        <div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;margin-top:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor}"></div>
        </div>
      </td>
      <td>${c.active ? '<span class="pill new">active</span>' : '<span class="pill archived">off</span>'}</td>
      <td>
        <button class="ghost np-train" data-id="${esc(c.client_id)}" type="button">Train</button>
        <form class="inline" method="post" action="/admin/clients/${esc(c.client_id)}/delete" onsubmit="return confirm('Delete ${esc(c.client_id)}?')"><button class="ghost" type="submit">Delete</button></form>
      </td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="color:var(--muted);padding:30px;text-align:center">No client widgets configured yet.</td></tr>`;

  return `<h1>Client widgets</h1>
    <p class="sub">Each client gets an ID used by the embed snippet. Usage shows this month's conversations against the plan cap — the cap protects your API costs.</p>
    <div class="card">
      <form method="post" action="/admin/clients">
        <div class="grid">
          <div><label>Client ID</label><input name="client_id" placeholder="acme-law" required style="width:100%"></div>
          <div><label>Display name</label><input name="name" placeholder="Acme Law" style="width:100%"></div>
          <div><label>Accent color</label><input name="accent" value="#5fd4d6" style="width:100%"></div>
          <div><label>Knowledge URL</label><input name="knowledge_url" placeholder="https://acme-law.com" style="width:100%"></div>
          <div><label>Plan tier</label>
            <select name="tier" style="width:100%">
              <option value="essential">Essential (300/mo)</option>
              <option value="professional">Professional (800/mo)</option>
              <option value="custom">Custom (high volume)</option>
              <option value="trial">Trial (50/mo)</option>
            </select>
          </div>
          <div><label>Custom cap (optional, overrides tier)</label><input name="monthly_cap" type="number" min="0" placeholder="0 = use tier default" style="width:100%"></div>
        </div>
        <div style="margin-top:14px"><label>Greeting</label><input name="greeting" placeholder="Hi! Ask me anything about our services." style="width:100%"></div>
        <div class="row" style="margin-top:14px">
          <label style="margin:0"><input type="checkbox" name="active" checked> Active</label>
          <button type="submit">Save client</button>
        </div>
      </form>
    </div>
    <table><thead><tr><th>Client ID</th><th>Name</th><th>Plan</th><th>Usage</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="card mono" id="np-snippet" style="margin-top:20px;font-size:12px;color:var(--muted)">
      Embed snippet: &lt;script src="ORIGIN_PLACEHOLDER/embed.js" data-client="<span style="color:var(--cyan)">CLIENT_ID</span>"&gt;&lt;/script&gt;
    </div>
    <script>
      document.querySelectorAll('.np-train').forEach(function(btn){
        btn.addEventListener('click', function(){
          var id = btn.getAttribute('data-id');
          btn.disabled = true; var old = btn.textContent; btn.textContent = 'Training…';
          fetch('/admin/clients/' + id + '/ingest', { method:'POST' })
            .then(function(r){ return r.json(); })
            .then(function(j){
              btn.disabled = false; btn.textContent = old;
              if (j.ok) alert('Trained "' + id + '": ' + j.pages + ' pages, ' + j.chunks + ' chunks (' + j.mode + ' mode).');
              else alert('Training failed: ' + (j.error || 'unknown error'));
            })
            .catch(function(){ btn.disabled=false; btn.textContent=old; alert('Training request failed.'); });
        });
      });
      var snip = document.getElementById('np-snippet');
      if (snip) snip.innerHTML = snip.innerHTML.replace('ORIGIN_PLACEHOLDER', location.origin);
    </script>`;
}
