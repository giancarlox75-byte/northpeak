/* embed.js — Northpeak chat widget loader.
   Usage on a client site:
   <script src="https://YOUR-DOMAIN/embed.js" data-client="acme-law"></script>
*/
(function () {
  var script = document.currentScript;
  var clientId = script && script.getAttribute('data-client');
  if (!clientId) { console.error('[Northpeak] data-client is required on the embed script.'); return; }

  // origin = where this script was loaded from (your backend)
  var origin = new URL(script.src).origin;
  var accent = script.getAttribute('data-accent') || '#5fd4d6';
  var title = script.getAttribute('data-title') || 'Assistant';
  var greeting = script.getAttribute('data-greeting') || 'Hi! Ask me anything.';

  // a session id groups one visitor's chat into a single "conversation"
  var sessionId = 'np-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  var convo = []; // conversation history for memory + lead capture

  var css = `
  .np-btn{position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;
    background:${accent};border:none;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.28);z-index:2147483000;
    display:flex;align-items:center;justify-content:center;transition:transform .2s}
  .np-btn:hover{transform:scale(1.06)}
  .np-btn svg{width:26px;height:26px}
  .np-panel{position:fixed;bottom:92px;right:22px;width:360px;max-width:calc(100vw - 44px);height:520px;
    max-height:calc(100vh - 130px);background:#0b1014;border:1px solid rgba(255,255,255,.12);border-radius:16px;
    box-shadow:0 24px 60px rgba(0,0,0,.4);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .np-panel.open{display:flex}
  .np-head{padding:16px 18px;background:#0f161c;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px}
  .np-dot{width:30px;height:30px;border-radius:50%;background:${accent};flex:none}
  .np-head b{color:#e9eef0;font-size:14px;display:block}
  .np-head span{color:${accent};font-size:10px;font-family:monospace;letter-spacing:.08em}
  .np-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
  .np-m{max-width:84%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.45}
  .np-bot{background:rgba(255,255,255,.06);color:#dfe6ec;align-self:flex-start;border-bottom-left-radius:3px;white-space:pre-wrap}
  .np-user{background:${accent};color:#06121a;align-self:flex-end;border-bottom-right-radius:3px}
  .np-typing{color:#7c8a93;font-size:13px;align-self:flex-start}
  .np-foot{padding:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:8px}
  .np-foot input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;
    padding:11px 13px;color:#e9eef0;font-size:14px;outline:none}
  .np-foot button{background:${accent};border:none;border-radius:10px;width:42px;cursor:pointer;color:#06121a;font-size:16px}
  .np-credit{text-align:center;font-size:10px;color:#55626d;padding:6px}
  .np-credit a{color:#7c8a93;text-decoration:none}
  `;
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'np-btn'; btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#06121a" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z"/></svg>';

  var panel = document.createElement('div');
  panel.className = 'np-panel';
  panel.innerHTML =
    '<div class="np-head"><div class="np-dot"></div><div><b>' + esc(title) + '</b><span>● ONLINE</span></div></div>' +
    '<div class="np-msgs" id="np-msgs"></div>' +
    '<div class="np-foot"><input id="np-input" placeholder="Type your question…" /><button id="np-send">➤</button></div>' +
    '<div class="np-credit">Powered by <a href="https://northpeak.solutions" target="_blank" rel="noopener">Northpeak</a></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('#np-msgs');
  var input = panel.querySelector('#np-input');
  var send = panel.querySelector('#np-send');
  var greeted = false;

  btn.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!greeted) { addMsg(greeting, 'bot'); greeted = true; }
      input.focus();
    }
  });

  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function addMsg(text, who) {
    var d = document.createElement('div');
    d.className = 'np-m ' + (who === 'user' ? 'np-user' : 'np-bot');
    d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function ask() {
    var q = input.value.trim();
    if (!q) return;
    addMsg(q, 'user'); input.value = '';
    convo.push({ role: 'user', text: q });
    var typing = document.createElement('div');
    typing.className = 'np-typing'; typing.textContent = 'Typing…';
    msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    send.disabled = true;

    fetch(origin + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, message: q, session_id: sessionId, history: convo.slice(-10) }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        typing.remove(); send.disabled = false;
        if (res.ok && res.j.answer) {
          addMsg(res.j.answer, 'bot');
          convo.push({ role: 'assistant', text: res.j.answer });
          if (res.j.leadCaptured) {
            var note = document.createElement('div');
            note.className = 'np-typing';
            note.style.color = accent;
            note.textContent = '✓ Your details were sent to the team.';
            msgs.appendChild(note); msgs.scrollTop = msgs.scrollHeight;
          }
        } else {
          addMsg((res.j && res.j.error) || 'Sorry, something went wrong.', 'bot');
        }
        input.focus();
      })
      .catch(function () {
        typing.remove(); send.disabled = false;
        addMsg('Connection error. Please try again.', 'bot');
      });
  }

  send.addEventListener('click', ask);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
})();
