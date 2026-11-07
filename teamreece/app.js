/* =========================================================================
   TEAM REECE — site interactions
   ========================================================================= */
(() => {
  "use strict";
  const C = window.CAMPAIGN || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Safe storage ---------- */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem("tr_" + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem("tr_" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem("tr_" + k); } catch { /* noop */ } }
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  async function share(text, url = location.href.split("?")[0].split("#")[0]) {
    if (navigator.share) {
      try { await navigator.share({ title: C.brand || "Team Reece", text, url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Copied to clipboard. Paste it anywhere!"); }
    catch { toast("Share: " + url); }
  }

  /* ---------- Inline the <use> shapes so CSS animations can reach them ---------- */
  $$("use").forEach((u) => {
    const ref = $(u.getAttribute("href"));
    if (!ref) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.innerHTML = ref.innerHTML;
    u.replaceWith(g);
  });

  /* ---------- Campaign config → page ---------- */
  const fullName = [C.firstName, C.lastName].filter(Boolean).join(" ") || "Reece";
  const officeLabel = C.office ? `${C.lastName || "Reece"} for ${C.office}${C.district ? " · " + C.district : ""}` : "";
  $$("[data-office-line]").forEach((el) => (el.textContent = officeLabel || `${fullName} · ${C.state || "Michigan"}`));
  $$("[data-name-signature]").forEach((el) => (el.textContent = `— ${fullName}`));
  if (C.office) {
    $$("[data-office-faq]").forEach((el) => (el.textContent = `${fullName} is running for ${C.office}${C.district ? " in " + C.district : ""}, ${C.state || "Michigan"}. Join the team to help us win.`));
    document.title = `${officeLabel} | The Movement Starts Here`;
  }
  $$("[data-ig]").forEach((a) => (a.href = C.instagram || "#"));
  $$("[data-mail]").forEach((a) => (a.href = "mailto:" + (C.email || "")));
  $("#paidFor").textContent = C.paidFor || "Paid for by Team Reece.";
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Nav ---------- */
  const nav = $("#nav"), toTop = $("#toTop"), menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 40);
    toTop.classList.toggle("show", y > 900);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  menuBtn.addEventListener("click", () => {
    const open = menuBtn.getAttribute("aria-expanded") !== "true";
    menuBtn.setAttribute("aria-expanded", open);
    navLinks.classList.toggle("open", open);
  });
  $$("a", navLinks).forEach((a) => a.addEventListener("click", () => { menuBtn.setAttribute("aria-expanded", "false"); navLinks.classList.remove("open"); }));

  // Scroll spy
  const spyLinks = $$("a[href^='#']", navLinks);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) spyLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  spyLinks.forEach((a) => { const s = $(a.getAttribute("href")); if (s) spy.observe(s); });

  /* ---------- Reveal on scroll + counters ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      $$("[data-count]", e.target).forEach(countUp);
      revealer.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  function observeReveals(root = document) { $$(".reveal:not(.in)", root).forEach((el) => revealer.observe(el)); }

  function countUp(el) {
    const target = +el.dataset.count, suffix = el.dataset.suffix || "";
    if (reduceMotion) { el.textContent = target.toLocaleString() + suffix; return; }
    const start = performance.now(), dur = 1600;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Hero: starfield ---------- */
  (function starfield() {
    const cv = $("#stars"), ctx = cv.getContext("2d");
    let w, h, stars = [], shooting = null, mx = 0, my = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 5200);
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.85, r: Math.random() * 1.3 + 0.2, a: Math.random(), s: Math.random() * 0.02 + 0.004, z: Math.random() * 0.8 + 0.2 }));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.a += st.s; const alpha = 0.35 + Math.abs(Math.sin(st.a)) * 0.65;
        ctx.globalAlpha = alpha * (1 - st.y / h * 0.6);
        ctx.fillStyle = st.r > 1.2 ? "#cfdcff" : "#fff";
        ctx.beginPath(); ctx.arc(st.x + mx * st.z * 14, st.y + my * st.z * 10, st.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, l: 0 };
      if (shooting) {
        shooting.l += 14;
        const g = ctx.createLinearGradient(shooting.x + shooting.l - 120, shooting.y + (shooting.l - 120) * 0.35, shooting.x + shooting.l, shooting.y + shooting.l * 0.35);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(200,215,255,.9)");
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(shooting.x + shooting.l - 120, shooting.y + (shooting.l - 120) * 0.35); ctx.lineTo(shooting.x + shooting.l, shooting.y + shooting.l * 0.35); ctx.stroke();
        if (shooting.l > 520) shooting = null;
      }
      ctx.globalAlpha = 1;
      if (!reduceMotion) requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
    resize(); frame();
  })();

  /* ---------- Hero: Capitol + tree-line skyline ---------- */
  (function skyline() {
    const W = 1440, H = 300, cx = 720;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dome" x1="0" x2="1"><stop offset="0" stop-color="#5b6680"/><stop offset=".45" stop-color="#e9eef8"/><stop offset="1" stop-color="#4a546c"/></linearGradient>
        <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2335"/><stop offset="1" stop-color="#070a12"/></linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#05070c" stop-opacity="0"/><stop offset="1" stop-color="#05070c"/></linearGradient>
      </defs>`;
    // Trees (seeded so they render the same every load)
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const tree = (x0, x1, peak) => {
      let t = "";
      for (let x = x0; x < x1; x += 14) {
        const edge = x0 === 0 ? 1 - x / x1 : (x - x0) / (W - x0);
        const top = H - 30 - edge * peak - rnd() * 40;
        for (let k = 0; k < 3; k++) t += `<circle cx="${x + rnd() * 20}" cy="${top + k * 26 + rnd() * 10}" r="${18 + rnd() * 18}"/>`;
        t += `<rect x="${x}" y="${top}" width="22" height="${H - top}"/>`;
      }
      return t;
    };
    s += `<g fill="#020308">${tree(0, 400, 190)}${tree(1040, W, 190)}</g>`;
    // Wings
    s += `<rect x="${cx - 270}" y="222" width="540" height="78" fill="url(#bldg)"/>`;
    s += `<rect x="${cx - 280}" y="216" width="560" height="8" fill="#2a3449"/>`;
    // Windows
    for (let row = 0; row < 2; row++) for (let x = cx - 255; x < cx + 255; x += 22) {
      if (Math.abs(x - cx) < 95) continue;
      s += `<rect x="${x}" y="${236 + row * 28}" width="9" height="16" fill="${rnd() > 0.35 ? "#8fa3cc" : "#3a4866"}" opacity=".7"/>`;
    }
    // Central portico
    s += `<rect x="${cx - 90}" y="196" width="180" height="104" fill="url(#bldg)"/>`;
    s += `<polygon points="${cx - 100},198 ${cx},168 ${cx + 100},198" fill="#2a3449"/>`;
    for (let x = cx - 80; x <= cx + 80; x += 20) s += `<rect x="${x - 3}" y="204" width="6" height="90" fill="#a9b6d2" opacity=".85"/>`;
    // Drum
    s += `<rect x="${cx - 52}" y="120" width="104" height="50" fill="#1f2840"/>`;
    for (let x = cx - 46; x <= cx + 46; x += 11.5) s += `<rect x="${x - 2}" y="124" width="4" height="42" fill="#d6deef"/>`;
    s += `<rect x="${cx - 58}" y="116" width="116" height="6" fill="#c4cde0"/>`;
    // Dome, lantern, spire
    s += `<path d="M${cx - 50},117 C${cx - 50},70 ${cx - 22},52 ${cx},50 C${cx + 22},52 ${cx + 50},70 ${cx + 50},117 Z" fill="url(#dome)"/>`;
    for (let i = -3; i <= 3; i++) s += `<path d="M${cx + i * 14},117 Q${cx + i * 7},70 ${cx},51" stroke="#2c3550" stroke-width="1" fill="none" opacity=".6"/>`;
    s += `<rect x="${cx - 10}" y="34" width="20" height="18" fill="#dfe6f4"/><path d="M${cx - 12},35 Q${cx},20 ${cx + 12},35Z" fill="#c9d2e6"/><rect x="${cx - 1.5}" y="4" width="3" height="22" fill="#e9eef8"/>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/></svg>`;
    $("#skyline").innerHTML = s;
  })();

  /* ---------- Hero: Build • Fight • Win ---------- */
  (function heroSub() {
    const el = $("#heroSub"), words = ["Build", "Fight", "Win"];
    if (reduceMotion) { el.innerHTML = words.join('<span class="dot">•</span>'); return; }
    words.forEach((w, i) => setTimeout(() => {
      el.innerHTML = words.slice(0, i + 1).map((x) => `<span>${x}</span>`).join('<span class="dot">•</span>');
    }, 1300 + i * 450));
  })();

  /* ---------- Countdown ---------- */
  (function countdown() {
    const target = new Date((C.electionDate || "2028-11-07") + "T07:00:00");
    const pretty = target.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    $("#cdCaption").textContent = `until Election Day · ${pretty}`;
    const els = { d: $("[data-cd=d]"), h: $("[data-cd=h]"), m: $("[data-cd=m]"), s: $("[data-cd=s]") };
    const pad = (n, l = 2) => String(n).padStart(l, "0");
    function tick() {
      let diff = Math.max(0, target - Date.now()) / 1000;
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600); diff -= h * 3600;
      const m = Math.floor(diff / 60), s = Math.floor(diff - m * 60);
      els.d.textContent = pad(d, 3); els.h.textContent = pad(h); els.m.textContent = pad(m); els.s.textContent = pad(s);
    }
    tick(); setInterval(tick, 1000);
  })();

  /* ---------- Ticker ---------- */
  const tickerItems = ["The Movement Starts Here", "Born & Raised in Flint", "Technology for the Common Good", "Strong Schools", "Affordable Basics", "Higher Wages", "Build • Fight • Win", "Join Team Reece"];
  $("#ticker").innerHTML = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((t) => `<span>${t}</span>`).join("");

  /* =======================================================================
     PLATFORM
     Draft positions — edit freely. Each issue: problem, plan bullets, why.
     ======================================================================= */
  const ICONS = {
    chip: "M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6zM10 10h4v4h-4z",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
    school: "M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5",
    cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.8h7.7a2 2 0 0 0 2-1.6L21 8H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    wage: "M3 17l6-6 4 4 8-8M15 7h6v6",
    home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
    health: "M3 12h4l2-5 4 10 2-5h6",
    scale: "M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    water: "M12 2.7s-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z"
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]}"/></svg>`;

  const CATS = { all: "All Issues", technology: "Technology", economy: "Economy", families: "Families", community: "Community" };
  // `top: true` marks Kevin's core priorities (shown first, with a badge).
  const ISSUES = [
    { id: "ai", top: true, cat: "technology", icon: "chip", label: "AI & tech safety", title: "AI That Works for People",
      short: "AI is changing everything. Michigan needs smart rules so it's safe, fair, and used for the public good.",
      problem: "AI is already making decisions about our lives: who gets a job interview, what an insurance claim pays, what our kids see online. Right now there are almost no rules about how it's used, who's accountable when it gets things wrong, or how our personal data is protected.",
      plan: ["Clear guardrails for AI used in hiring, housing, lending, healthcare, and policing, with a human in the loop on decisions that change people's lives",
        "Strong data privacy protections so Michiganders own their personal information",
        "Require disclosure when you're talking to an AI or seeing AI-generated political ads and deepfakes",
        "Protect state systems, schools, and hospitals from AI-powered cyberattacks and scams that target seniors",
        "Make government lead by example: transparent, tested, and accountable use of AI in state agencies"],
      why: "Technology should make life better for working people, not just bigger profits for a few. We can lead on AI and still make sure it's safe." },
    { id: "innovation", top: true, cat: "technology", icon: "bolt", label: "Michigan innovation", title: "Keep Michigan on Top",
      short: "Michigan built the auto age. Now let's lead the next one: tech, clean energy, and the jobs that come with it.",
      problem: "Michigan's universities produce world-class talent, and too much of it leaves. Too many communities still don't have reliable high-speed internet, and too many workers are left out as industries change.",
      plan: ["Grow tech, advanced manufacturing, and mobility jobs across the whole state, not just one or two cities",
        "Close the broadband gap so every home, school, and small business can connect",
        "Free and low-cost training so workers can learn new skills as AI and automation change their jobs",
        "Help homegrown startups get funding and stay in Michigan",
        "Partner universities and community colleges with local employers"],
      why: "If Michigan leads in technology, Michigan workers win. Our kids shouldn't have to leave the state to build their future." },
    { id: "schools", top: true, cat: "families", icon: "school", label: "Strong schools", title: "Strong Schools for Every Kid",
      short: "Great public schools, respected teachers, and classrooms ready for the world our kids are growing into.",
      problem: "Too many kids are falling behind in reading and math, teachers are leaving the profession, and too many classrooms don't have the tools to prepare students for a tech-driven world.",
      plan: ["Pay and support teachers like the professionals they are, so great teachers stay",
        "Early literacy: every child reading by third grade",
        "Computer science, digital literacy, and responsible AI education in every school",
        "Bring career, technical, and skilled-trades programs back into high schools",
        "Mental-health support and counselors so students can focus on learning",
        "Fair funding, so a kid's ZIP code doesn't decide their future"],
      why: "Education is the surest path to opportunity, and it's how Michigan stays at the top." },
    { id: "costs", top: true, cat: "economy", icon: "cart", label: "Affordable basics", title: "Make the Basics Affordable",
      short: "Groceries, rent, utilities, childcare, prescriptions. The basics shouldn't break the bank.",
      problem: "Paychecks haven't kept up with the cost of living. Families are choosing between groceries, rent, and the electric bill, and too many are one emergency away from falling behind.",
      plan: ["Push back on utility rate hikes, and demand reliable power for what we already pay",
        "Expand affordable childcare so parents can work without going broke",
        "Lower prescription drug costs and crack down on price gouging",
        "Target tax relief to working families and seniors on fixed incomes",
        "Cut junk fees and hidden charges on everyday bills"],
      why: "When families can afford the basics, they can plan, save, and build a future. That makes the whole state stronger." },
    { id: "wages", top: true, cat: "economy", icon: "wage", label: "Higher wages", title: "Raise Wages. Reward Work.",
      short: "A full day's work should pay for a good life. It's time Michigan wages caught up.",
      problem: "Costs keep climbing while wages lag behind. Too many people work full time, sometimes more than one job, and still can't get ahead.",
      plan: ["Raise wages so they keep pace with the real cost of living",
        "Protect workers' right to organize and bargain for fair pay",
        "Fight wage theft and make sure people get paid for every hour they work",
        "Close pay gaps so equal work gets equal pay",
        "Make sure companies that get public incentives create good-paying jobs"],
      why: "Higher wages don't just help workers. They get spent at local businesses and keep Michigan communities strong." },
    { id: "housing", cat: "economy", icon: "home", label: "Housing", title: "Homes Families Can Afford",
      short: "More housing, fair rents, and a real shot at owning a home in the community you love.",
      problem: "From Flint to Grand Rapids to Traverse City, young families and workers are being priced out of the towns they grew up in.",
      plan: ["Cut the red tape that blocks new starter homes", "Help first-time buyers with down-payment support", "Turn vacant and blighted properties into homes", "Protect renters from unfair fees and junk charges"],
      why: "A home is stability for kids, a foundation for families, and the backbone of strong neighborhoods." },
    { id: "wellness", cat: "families", icon: "health", label: "Health & wellness", title: "Healthy Communities",
      short: "Affordable care, mental-health support, and community wellness in every corner of Michigan.",
      problem: "Medical bills are a leading source of debt, rural hospitals are struggling, and getting mental-health care can mean waiting months.",
      plan: ["Expand access to mental-health and addiction care, including in schools", "Keep rural hospitals and clinics open", "Use telehealth and technology to bring care closer to home", "Protect coverage for people with pre-existing conditions"],
      why: "Healthy people build strong communities. Nobody should go broke getting sick." },
    { id: "justice", cat: "community", icon: "scale", label: "Access to justice", title: "Justice for Everyone",
      short: "Your rights shouldn't depend on whether you can afford a lawyer.",
      problem: "Every year, thousands of Michiganders face evictions, debt cases, and family court without any legal help, simply because they can't afford it.",
      plan: ["Expand funding for legal aid organizations across the state", "Right to counsel for families facing eviction", "Make court forms and processes simpler, with plain-language and online tools", "Clear old records so people can get jobs and housing"],
      why: "Kevin has seen this up close at Legal Aid of Western Michigan. Equal justice under law has to mean equal access to it." },
    { id: "accountability", cat: "community", icon: "eye", label: "Open government", title: "Government That Answers to You",
      short: "Transparency, ethics, and modern tools that let you see what your government is doing.",
      problem: "Michigan has some of the weakest transparency laws in the country, and too many decisions happen behind closed doors.",
      plan: ["Extend open-records laws to the Legislature and Governor's office", "Put state spending and results online in plain language", "Slow the revolving door between lawmaking and lobbying", "Hold regular town halls, in person and online"],
      why: "Trust is earned. You deserve to know who's working for you, and how." },
    { id: "lakes", cat: "community", icon: "water", label: "Clean water", title: "Clean Water & Great Lakes",
      short: "Safe drinking water in every home, and Great Lakes protected for the next generation.",
      problem: "Aging pipes, pollution, and underfunded water systems put families at risk. Flint knows this better than anywhere.",
      plan: ["Replace every lead service line in Michigan", "Make polluters, not taxpayers, pay for cleanup", "Invest in local water infrastructure and affordable water bills", "Protect the Great Lakes from pollution and invasive species"],
      why: "Clean, safe, affordable water is a basic right, and the Great Lakes are who we are." }
  ];

  const chips = $("#chips"), grid = $("#issueGrid");
  chips.innerHTML = Object.entries(CATS).map(([k, v], i) => `<button class="chip${i ? "" : " active"}" role="tab" aria-selected="${!i}" data-cat="${k}">${v}</button>`).join("");
  grid.innerHTML = ISSUES.map((it) => `
    <button class="issue reveal${it.top ? " featured" : ""}" data-id="${it.id}" data-cat="${it.cat}">
      ${it.top ? '<span class="top-badge">Top priority</span>' : ""}
      <span class="issue-icon">${icon(it.icon)}</span>
      <span class="issue-tag">${CATS[it.cat]}</span>
      <h3>${it.title}</h3>
      <p>${it.short}</p>
      <span class="issue-more">Read the plan <span>→</span></span>
    </button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$(".chip", chips).forEach((c) => { c.classList.toggle("active", c === b); c.setAttribute("aria-selected", c === b); });
    const cat = b.dataset.cat;
    $$(".issue", grid).forEach((card) => {
      const show = cat === "all" || card.dataset.cat === cat;
      card.classList.toggle("hide", !show);
      if (show) card.classList.add("in");
    });
  });

  /* Modal */
  const modal = $("#modal"), modalBody = $("#modalBody");
  let lastFocus;
  function openModal(html) {
    lastFocus = document.activeElement;
    modalBody.innerHTML = html;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => $(".modal-close", modal).focus(), 50);
  }
  function closeModal() {
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".issue"); if (!card) return;
    const it = ISSUES.find((x) => x.id === card.dataset.id);
    const idx = ISSUES.indexOf(it);
    const next = ISSUES[(idx + 1) % ISSUES.length];
    openModal(`
      <span class="eyebrow">${CATS[it.cat]}</span>
      <h3 id="modalTitle">${it.title}</h3>
      <h4>The Problem</h4><p>${it.problem}</p>
      <h4>The Plan</h4><ul class="plan-list">${it.plan.map((p) => `<li>${p}</li>`).join("")}</ul>
      <h4>Why It Matters</h4><p>${it.why}</p>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" data-act="share" data-title="${esc(it.title)}">Share this plan</button>
        <a href="#join" class="btn btn-ghost btn-sm" data-close>Help make it happen</a>
        <button class="btn btn-ghost btn-sm" data-act="next" data-id="${next.id}">Next: ${next.label} →</button>
      </div>`);
  });
  modalBody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "share") share(`${b.dataset.title}: Team Reece's plan for a stronger Michigan.`);
    if (b.dataset.act === "next") { closeModal(); $(`.issue[data-id="${b.dataset.id}"]`).click(); }
  });

  /* =======================================================================
     PRIORITIES — pick top 3
     Results are stored per-browser until a backend is connected.
     ======================================================================= */
  const prioOptions = $("#prioOptions"), prioBars = $("#prioBars"), prioSubmit = $("#prioSubmit");
  let picks = [];
  prioOptions.innerHTML = ISSUES.map((it) => `<button class="prio-opt" data-id="${it.id}" aria-pressed="false"><span class="rank"></span>${it.label}</button>`).join("");

  function renderPickState() {
    $$(".prio-opt", prioOptions).forEach((b) => {
      const i = picks.indexOf(b.dataset.id);
      b.classList.toggle("sel", i > -1);
      b.setAttribute("aria-pressed", i > -1);
      $(".rank", b).textContent = i > -1 ? i + 1 : "";
      b.disabled = i === -1 && picks.length >= 3;
    });
    $("#prioHint").textContent = `Tap issues on the left. ${picks.length} of 3 selected.`;
    prioSubmit.disabled = picks.length !== 3;
    prioBars.innerHTML = picks.map((id, i) => {
      const it = ISSUES.find((x) => x.id === id);
      return `<div class="bar-row"><div class="bar-top"><b>#${i + 1} ${it.label}</b></div><div class="bar"><i style="width:${100 - i * 25}%"></i></div></div>`;
    }).join("") || `<p style="color:var(--muted);font-size:.9rem">Your ranking will appear here.</p>`;
  }
  prioOptions.addEventListener("click", (e) => {
    const b = e.target.closest(".prio-opt"); if (!b || store.get("myPicks")) return;
    const id = b.dataset.id, i = picks.indexOf(id);
    if (i > -1) picks.splice(i, 1); else if (picks.length < 3) picks.push(id);
    renderPickState();
  });

  function renderResults(mine) {
    // Weighted tally: #1 = 3 pts, #2 = 2 pts, #3 = 1 pt
    const tally = store.get("tally", {});
    const scores = ISSUES.map((it) => ({ it, v: tally[it.id] || 0 })).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...scores.map((s) => s.v));
    const total = scores.reduce((a, s) => a + s.v, 0) || 1;
    $("#prioTitle").textContent = "You're on the record ★";
    $("#prioHint").textContent = "Here's how priorities rank so far. Results update as more people weigh in.";
    prioBars.innerHTML = scores.slice(0, 6).map((s) => `
      <div class="bar-row${mine.includes(s.it.id) ? " mine" : ""}">
        <div class="bar-top"><b>${s.it.label}</b><span>${Math.round((s.v / total) * 100)}%</span></div>
        <div class="bar"><i data-w="${(s.v / max) * 100}"></i></div>
      </div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => $$("i[data-w]", prioBars).forEach((i) => (i.style.width = i.dataset.w + "%"))));
    $$(".prio-opt", prioOptions).forEach((b) => { const i = mine.indexOf(b.dataset.id); b.classList.toggle("sel", i > -1); $(".rank", b).textContent = i > -1 ? i + 1 : ""; b.disabled = true; });
    prioSubmit.hidden = true; $("#prioShare").hidden = false; $("#prioReset").hidden = false;
  }
  prioSubmit.addEventListener("click", () => {
    const tally = store.get("tally", {});
    picks.forEach((id, i) => (tally[id] = (tally[id] || 0) + (3 - i)));
    store.set("tally", tally); store.set("myPicks", picks);
    renderResults(picks);
    burst();
    toast("Thanks for weighing in. Your voice shapes this campaign.");
  });
  $("#prioShare").addEventListener("click", () => {
    const mine = store.get("myPicks", []).map((id) => ISSUES.find((x) => x.id === id).label);
    share(`My top 3 for Michigan: 1) ${mine[0]} 2) ${mine[1]} 3) ${mine[2]}. What are yours? #TeamReece`);
  });
  $("#prioReset").addEventListener("click", () => {
    const tally = store.get("tally", {});
    store.get("myPicks", []).forEach((id, i) => (tally[id] = Math.max(0, (tally[id] || 0) - (3 - i))));
    store.set("tally", tally); store.del("myPicks");
    picks = []; prioSubmit.hidden = false; $("#prioShare").hidden = true; $("#prioReset").hidden = true;
    $("#prioTitle").textContent = "Pick your top 3";
    renderPickState();
  });
  let savedPicks = store.get("myPicks");
  if (savedPicks && !savedPicks.every((id) => ISSUES.some((it) => it.id === id))) { store.del("myPicks"); store.del("tally"); savedPicks = null; }
  if (savedPicks) renderResults(savedPicks); else renderPickState();

  /* =======================================================================
     MAP — regions of Michigan
     ======================================================================= */
  const REGIONS = [
    { id: "up", name: "Upper Peninsula", x: 205, y: 104, lx: 0, ly: 26, anchor: "middle", cities: "Marquette · Sault Ste. Marie · Escanaba · Houghton",
      focus: "Broadband that actually reaches, mining and timber jobs with a future, and making sure Lansing never forgets the U.P.", issues: ["innovation", "wellness", "costs"] },
    { id: "north", name: "Northern Michigan", x: 318, y: 212, lx: 12, ly: 4, anchor: "start", cities: "Traverse City · Gaylord · Petoskey · Alpena",
      focus: "Housing that workers can afford in tourism towns, clean lakes, and year-round jobs, not just summer ones.", issues: ["housing", "wages", "lakes"] },
    { id: "west", name: "West Michigan", x: 254, y: 320, lx: -12, ly: 4, anchor: "end", cities: "Grand Rapids · Holland · Muskegon",
      focus: "Keeping a growing region affordable, backing manufacturers, and protecting the Lake Michigan shoreline.", issues: ["housing", "innovation", "schools"] },
    { id: "bay", name: "Great Lakes Bay", x: 346, y: 290, lx: 0, ly: -14, anchor: "middle", cities: "Saginaw · Bay City · Midland · Flint",
      focus: "Kevin's hometown region. Clean, safe water in every home, strong schools, revitalized downtowns, and the next generation of good-paying jobs.", issues: ["lakes", "schools", "wages"], home: true },
    { id: "thumb", name: "The Thumb", x: 400, y: 292, lx: 10, ly: 4, anchor: "start", cities: "Port Huron · Bad Axe · Lapeer · Sandusky",
      focus: "Family farms, rural hospitals that stay open, and roads that hold up to the work.", issues: ["wellness", "costs", "innovation"] },
    { id: "capital", name: "Capital Region", x: 314, y: 352, lx: -12, ly: 4, anchor: "end", cities: "Lansing · East Lansing · Jackson",
      focus: "Opening up state government, supporting students and young workers, and growing good jobs at home.", issues: ["accountability", "ai", "schools"] },
    { id: "metro", name: "Metro Detroit", x: 388, y: 372, lx: 0, ly: 24, anchor: "middle", cities: "Detroit · Warren · Dearborn · Troy · Ann Arbor",
      focus: "Where Kevin spent part of growing up, in Ann Arbor and Troy. Lower living costs, great schools, tech jobs, and a comeback that reaches every block.", issues: ["costs", "ai", "schools"] },
    { id: "southwest", name: "Southwest Michigan", x: 262, y: 390, lx: 0, ly: 26, anchor: "middle", cities: "Kalamazoo · Battle Creek · Benton Harbor · St. Joseph",
      focus: "Where Kevin went to college at Western Michigan and worked in Kalamazoo. Investing in workers, students, and small towns, and making sure legal help reaches everyone.", issues: ["justice", "wages", "schools"] }
  ];
  const pinsG = $("#pins"), regionCard = $("#regionCard");
  pinsG.innerHTML = REGIONS.map((r) => `
    <g class="pin" data-id="${r.id}" tabindex="0" role="button" aria-label="${r.name}">
      <circle class="pulse" cx="${r.x}" cy="${r.y}" r="7"/>
      <circle class="core" cx="${r.x}" cy="${r.y}" r="6"/>
      <text x="${r.x + r.lx}" y="${r.y + r.ly}" text-anchor="${r.anchor}">${r.name.replace("Michigan", "").replace("The ", "").trim() || r.name}</text>
    </g>`).join("");
  $("#fRegion").innerHTML += REGIONS.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");

  function showRegion(id) {
    const r = REGIONS.find((x) => x.id === id);
    $$(".pin", pinsG).forEach((p) => p.classList.toggle("active", p.dataset.id === id));
    const members = store.get("signups", []).filter((s) => s.region === id).length;
    regionCard.innerHTML = `
      <span class="eyebrow">Region</span>
      <h3>${r.name}${r.home ? '<span class="home-badge">Hometown</span>' : ""}</h3>
      <p class="region-cities">${r.cities}</p>
      <p class="region-focus">${r.focus}</p>
      <div class="region-meta">
        <div><b>${r.issues.length}</b>Top issues</div>
        <div><b>${members}</b>Signed up here</div>
      </div>
      <div class="chips" style="margin-bottom:24px">${r.issues.map((i) => `<button class="chip" data-open="${i}">${ISSUES.find((x) => x.id === i).label}</button>`).join("")}</div>
      <button class="btn btn-primary" data-organize="${r.id}">Organize in ${r.name.replace("The ", "the ")} →</button>`;
    regionCard.classList.remove("in"); void regionCard.offsetWidth; regionCard.classList.add("in");
  }
  pinsG.addEventListener("click", (e) => { const p = e.target.closest(".pin"); if (p) showRegion(p.dataset.id); });
  pinsG.addEventListener("keydown", (e) => { const p = e.target.closest(".pin"); if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showRegion(p.dataset.id); } });
  regionCard.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o) $(`.issue[data-id="${o.dataset.open}"]`).click();
    const g = e.target.closest("[data-organize]");
    if (g) {
      $("#fRegion").value = g.dataset.organize;
      const cap = $('input[value="Region captain"]'); if (cap) cap.checked = true;
      $("#join").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      setTimeout(() => $("#fFirst").focus({ preventScroll: true }), 700);
    }
  });
  showRegion("bay");

  /* =======================================================================
     EVENTS
     ======================================================================= */
  const eventList = $("#eventList");
  const rsvps = store.get("rsvps", {});
  const now = Date.now();
  const events = (C.events || []).map((e, i) => ({ ...e, key: e.title + e.date, i })).filter((e) => new Date(e.end || e.date).getTime() > now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  eventList.innerHTML = events.length ? events.map((ev) => {
    const d = new Date(ev.date);
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    const going = rsvps[ev.key];
    return `<article class="event reveal">
      <div class="event-date"><div class="m">${d.toLocaleDateString("en-US", { month: "short" })}</div><div class="d">${d.getDate()}</div><div class="y">${d.getFullYear()}</div></div>
      <div><span class="event-type">${esc(ev.type || "Event")}</span><h3>${esc(ev.title)}</h3><p class="where">${day}, ${time} · ${esc(ev.place)}</p><p class="desc">${esc(ev.desc || "")}</p></div>
      <div class="event-actions">
        <button class="btn btn-primary btn-sm${going ? " going" : ""}" data-rsvp="${esc(ev.key)}">${going ? "✓ Going" : "RSVP"}</button>
        <button class="btn btn-ghost btn-sm" data-ics="${ev.i}">+ Calendar</button>
      </div>
    </article>`;
  }).join("") : `<p class="lede">New events are being scheduled now. Join the team to hear first.</p>`;

  eventList.addEventListener("click", (e) => {
    const r = e.target.closest("[data-rsvp]");
    if (r) {
      const k = r.dataset.rsvp, on = !rsvps[k];
      if (on) rsvps[k] = true; else delete rsvps[k];
      store.set("rsvps", rsvps);
      r.classList.toggle("going", on); r.textContent = on ? "✓ Going" : "RSVP";
      toast(on ? "You're on the list! See you there." : "RSVP removed.");
      if (on) burst(r);
    }
    const c = e.target.closest("[data-ics]");
    if (c) downloadICS(C.events[+c.dataset.ics]);
  });

  function downloadICS(ev) {
    const fmt = (s) => { const d = new Date(s); return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    const end = ev.end || new Date(new Date(ev.date).getTime() + 2 * 3600e3).toISOString();
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Team Reece//Events//EN", "BEGIN:VEVENT",
      `UID:${Date.now()}@teamreece`, `DTSTAMP:${fmt(new Date().toISOString())}`, `DTSTART:${fmt(ev.date)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${ev.title}`, `LOCATION:${ev.place}`, `DESCRIPTION:${(ev.desc || "").replace(/\n/g, " ")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = ev.title.replace(/\W+/g, "-").toLowerCase() + ".ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* =======================================================================
     JOIN — 3-step volunteer form
     ======================================================================= */
  const form = $("#joinForm"), steps = $$(".step", form), bars = $$(".progress i", form);
  const prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn");
  let step = 0;

  function setStep(n) {
    step = n;
    steps.forEach((s, i) => s.classList.toggle("active", i === n));
    bars.forEach((b, i) => b.classList.toggle("done", i <= n));
    prevBtn.hidden = n === 0;
    nextBtn.textContent = n === steps.length - 1 ? "Join the Team ★" : "Next →";
  }
  function validate(n) {
    let ok = true;
    $$("[required]", steps[n]).forEach((inp) => {
      let valid = inp.value.trim() !== "";
      if (inp.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim());
      if (inp.name === "zip") valid = /^\d{5}$/.test(inp.value.trim());
      inp.closest(".field").classList.toggle("invalid", !valid);
      if (!valid && ok) { inp.focus(); ok = false; }
    });
    return ok;
  }
  form.addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("invalid"); });
  form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); nextBtn.click(); } });
  prevBtn.addEventListener("click", () => setStep(step - 1));
  nextBtn.addEventListener("click", () => {
    if (!validate(step)) return;
    if (step < steps.length - 1) return setStep(step + 1);
    const fd = new FormData(form);
    const entry = {
      first: fd.get("first").trim(), last: fd.get("last").trim(), email: fd.get("email").trim(), phone: (fd.get("phone") || "").trim(),
      zip: fd.get("zip").trim(), region: fd.get("region"), help: fd.getAll("help").join("; "), when: fd.getAll("when").join("; "),
      message: (fd.get("message") || "").trim(), at: new Date().toISOString()
    };
    const list = store.get("signups", []); list.push(entry); store.set("signups", list);
    const region = REGIONS.find((r) => r.id === entry.region);
    $("#memberCard").innerHTML = `
      <div class="mc-top"><span>TEAM<b>REECE</b>HQ</span><span>★</span></div>
      <div><div class="mc-meta">Founding Member</div><div class="mc-name">${esc(entry.first)} ${esc(entry.last)}</div></div>
      <div class="mc-top" style="color:var(--muted)"><span>${esc(region ? region.name : "Michigan")}</span><span>#${String(1000 + list.length).slice(-4)}</span></div>`;
    form.hidden = true; $("#joinSuccess").classList.add("show");
    burst();
    if ($(".pin.active")) showRegion($(".pin.active").dataset.id);
  });
  $("#joinAgain").addEventListener("click", () => { form.reset(); form.hidden = false; $("#joinSuccess").classList.remove("show"); setStep(0); });
  $("#shareJoin").addEventListener("click", () => share("I just joined Team Reece. The movement starts here. Join me!"));

  /* =======================================================================
     DONATE
     ======================================================================= */
  const AMOUNTS = [10, 25, 50, 100, 250, 500];
  const IMPACT = [
    [500, "could sponsor a full stop on the statewide listening tour."],
    [250, "could power a weekend of door-knocking in one region."],
    [100, "could fund a phone-bank night reaching hundreds of voters."],
    [50, "could put yard signs up across a whole block."],
    [25, "could print literature for a volunteer's door-knocking shift."],
    [1, "could cover coffee for a neighborhood meet-and-greet."]
  ];
  let amount = 50, freq = "once";
  const amountsEl = $("#amounts"), customAmt = $("#customAmt");
  amountsEl.innerHTML = AMOUNTS.map((a) => `<button class="amt${a === amount ? " on" : ""}" data-amt="${a}">$${a}</button>`).join("");
  function renderImpact() {
    const msg = (IMPACT.find(([min]) => amount >= min) || IMPACT[IMPACT.length - 1])[1];
    $("#impact").innerHTML = amount > 0 ? `<b>$${amount.toLocaleString()}${freq === "monthly" ? "/month" : ""}</b> ${msg}` : "Choose an amount to see your impact.";
    $("#donateBtn").textContent = amount > 0 ? `Donate $${amount.toLocaleString()}${freq === "monthly" ? " monthly" : ""}` : "Donate";
  }
  amountsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".amt"); if (!b) return;
    amount = +b.dataset.amt; customAmt.value = "";
    $$(".amt", amountsEl).forEach((x) => x.classList.toggle("on", x === b));
    renderImpact();
  });
  customAmt.addEventListener("input", () => {
    amount = Math.max(0, Math.floor(+customAmt.value || 0));
    $$(".amt", amountsEl).forEach((x) => x.classList.toggle("on", +x.dataset.amt === amount));
    renderImpact();
  });
  $$(".toggle button").forEach((b) => b.addEventListener("click", () => {
    freq = b.dataset.freq; $$(".toggle button").forEach((x) => x.classList.toggle("on", x === b)); renderImpact();
  }));
  $("#donateBtn").addEventListener("click", () => {
    if (!amount) { customAmt.focus(); return toast("Choose an amount first."); }
    if (C.donateUrl) {
      const u = new URL(C.donateUrl);
      u.searchParams.set("amount", amount);
      if (freq === "monthly") u.searchParams.set("recurring", "1");
      window.open(u.toString(), "_blank", "noopener");
    } else {
      toast("Online giving opens soon. Join the team and you'll be first to know!");
    }
  });
  $("#donateFine").textContent = (C.donateUrl ? "" : "Online donations are not open yet. ") +
    "Contributions are not tax-deductible. State and federal law require us to collect each contributor's name, address, occupation and employer.";
  renderImpact();

  /* ---------- Newsletter ---------- */
  $("#newsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("input", e.target), v = inp.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { inp.focus(); return toast("Enter a valid email address."); }
    const list = store.get("newsletter", []); if (!list.includes(v)) list.push(v); store.set("newsletter", list);
    inp.value = ""; toast("You're subscribed. Welcome to the movement! ★");
  });

  /* ---------- Admin view (?admin) ---------- */
  if (new URLSearchParams(location.search).has("admin")) {
    const admin = $("#admin"); admin.classList.add("show");
    const cols = ["at", "first", "last", "email", "phone", "zip", "region", "help", "when", "message"];
    const render = () => {
      const rows = store.get("signups", []);
      $("#adminTable").innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>` +
        (rows.length ? rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] || "")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}">No sign-ups on this device yet.</td></tr>`);
    };
    render();
    $("#exportCsv").addEventListener("click", () => {
      const rows = store.get("signups", []);
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "team-reece-signups.csv"; a.click();
    });
    $("#clearData").addEventListener("click", () => { if (confirm("Delete all sign-ups stored in this browser?")) { store.del("signups"); render(); } });
    setTimeout(() => admin.scrollIntoView(), 300);
  }

  /* ---------- Confetti (stars, in brand colors) ---------- */
  const cf = $("#confetti"), cctx = cf.getContext("2d");
  let parts = [], running = false;
  function burst(origin) {
    if (reduceMotion) return;
    cf.width = innerWidth; cf.height = innerHeight;
    const rect = origin ? origin.getBoundingClientRect() : null;
    const ox = rect ? rect.left + rect.width / 2 : innerWidth / 2, oy = rect ? rect.top : innerHeight / 2;
    for (let i = 0; i < (origin ? 40 : 140); i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * (origin ? 6 : 11) + 3;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, r: Math.random() * 5 + 3, rot: Math.random() * 6, vr: Math.random() * 0.3 - 0.15, life: 1,
        c: ["#ffffff", "#3d6bff", "#8fb0ff", "#ffffff"][i % 4], star: Math.random() > 0.5 });
    }
    if (!running) { running = true; requestAnimationFrame(confettiFrame); }
  }
  function drawStar(x, y, r, rot) {
    cctx.save(); cctx.translate(x, y); cctx.rotate(rot); cctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = (i * Math.PI) / 5 - Math.PI / 2; cctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    cctx.closePath(); cctx.fill(); cctx.restore();
  }
  function confettiFrame() {
    cctx.clearRect(0, 0, cf.width, cf.height);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.009;
      cctx.globalAlpha = Math.max(0, p.life); cctx.fillStyle = p.c;
      if (p.star) drawStar(p.x, p.y, p.r, p.rot); else { cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cctx.restore(); }
    }
    if (parts.length) requestAnimationFrame(confettiFrame); else { running = false; cctx.clearRect(0, 0, cf.width, cf.height); }
  }

  /* ---------- Meet Kevin timeline: line fills as you scroll ---------- */
  (function timeline() {
    const tl = $("#timeline"); if (!tl) return;
    const items = $$(".tl-item", tl);
    const update = () => {
      const r = tl.getBoundingClientRect(), mid = innerHeight * 0.6;
      const fill = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      tl.style.setProperty("--fill", fill.toFixed(3));
      items.forEach((it) => it.classList.toggle("lit", it.getBoundingClientRect().top + 12 < mid));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  observeReveals();
})();
