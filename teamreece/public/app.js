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

  /* ---------- Backend API ---------- */
  async function api(path, data) {
    let r;
    try {
      r = await fetch(path, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : { headers: { Accept: "application/json" } });
    } catch { throw new Error("Couldn't reach the server. Check your connection and try again."); }
    let j = {};
    try { j = await r.json(); } catch { /* non-JSON */ }
    if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    return j;
  }
  function busy(btn, on, label) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || "Sending…"; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  // Remember who this visitor is so we can pre-fill later forms (RSVP, contact).
  const me = () => store.get("me", {});
  const rememberMe = (o) => {
    store.set("me", { ...me(), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v)) });
    // Pre-fill any empty contact fields so the visitor never types their details twice
    [["#cName", o.name], ["#cEmail", o.email], ["#cZip", o.zip]].forEach(([sel, v]) => { const el = $(sel); if (el && v && !el.value) el.value = v; });
  };
  const hp = () => `<div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>`;

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
  const tickerItems = ["The Movement Starts Here", "Born & Raised in Flint", "AI That Works for People", "Strong Public Schools", "Homes Families Can Afford", "Better Jobs, Better Pay", "Open Records for All", "Build • Fight • Win", "Join Team Reece"];
  $("#ticker").innerHTML = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((t) => `<span>${t}</span>`).join("");

  /* =======================================================================
     PLATFORM
     Draft positions — edit freely. Each issue: problem, plan bullets, why.
     ======================================================================= */
  const ICONS = {
    chip: "M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6zM10 10h4v4h-4z",
    factory: "M2 20h20M4 20V10l5 3V10l5 3V6l6 4v10",
    school: "M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5",
    path: "M4 19h16M6 15l4-4 3 3 5-6M14 8h4v4",
    cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.8h7.7a2 2 0 0 0 2-1.6L21 8H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
    road: "M4 20L8 4M20 20L16 4M12 5v2M12 10v3M12 16v3",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
    water: "M12 2.7s-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
    health: "M3 12h4l2-5 4 10 2-5h6",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]}"/></svg>`;

  // Six pillars of Kevin's platform. `top: true` = core priority (shown first, badged).
  const CATS = { all: "All Issues", affordability: "Affordability", jobs: "Jobs & AI", education: "Education", infrastructure: "Infrastructure & Energy", health: "Healthcare", accountability: "Accountability" };
  const ISSUES = [
    { id: "ai", top: true, cat: "jobs", icon: "chip", label: "AI & your rights", title: "AI That Works for People, Not Instead of Them",
      short: "AI should help Michiganders grow, not replace them. When it touches your rights, government has to provide real oversight.",
      problem: "AI and surveillance technology are spreading faster than the rules that should govern them. Automated license-plate cameras like Flock now record where Michigan drivers go, often with little public input and few limits on how long that data is kept or who can search it. AI is screening job applications and making decisions about people's lives, and some companies see it mainly as a way to cut workers.",
      plan: ["Put AI in workers' hands: free training so every Michigander can use AI tools to grow in their career, not be left behind by them",
        "Workers first: advance notice and transition support when companies use automation to cut jobs, and incentives for employers who use AI to upskill their people instead of laying them off",
        "Oversight when rights are on the line: public approval before communities adopt surveillance tech like Flock cameras or facial recognition, strict limits on keeping and sharing data, and regular independent audits",
        "Accountability: a human review and a right to appeal whenever AI makes a decision about your job, housing, credit, healthcare or benefits",
        "Your data belongs to you: strong privacy protections and clear rules on what companies and government can collect",
        "Honest elections: clear labels on AI-generated political ads and a crackdown on deceptive deepfakes"],
      why: "Technology should make people more capable, not more watched or more replaceable. Michigan can lead on AI and protect people's rights at the same time." },
    { id: "jobs", top: true, cat: "jobs", icon: "factory", label: "Good-paying jobs", title: "Better Jobs, Better Pay, Made in Michigan",
      short: "Raise wages by bringing the next generation of high-paying industries to Michigan and training our people to lead them.",
      problem: "Too many Michiganders work hard and still can't get ahead, and too many young people feel they have to leave the state to find a great career. Global competition for auto, tech and manufacturing jobs is fierce.",
      plan: ["Keep Michigan the heart of the auto industry, competitive in every kind of vehicle the world wants to buy",
        "Attract technology companies and new industries to every region, not just one or two cities",
        "Expand skilled trades and paid apprenticeships so workers can earn while they learn",
        "Prepare workers for AI and automation with retraining tied to real job openings",
        "Make sure companies that receive public incentives deliver the good-paying jobs they promise"],
      why: "The best way to raise wages is to make Michigan the place where the best jobs are, and where workers have the skills to land them." },
    { id: "housing", top: true, cat: "affordability", icon: "home", label: "Affordable housing", title: "Homes Young Families Can Afford",
      short: "Build more homes, and help first-time buyers and renters right now. We need both.",
      problem: "Young adults and families across Michigan are being priced out of the communities they grew up in. There aren't enough homes, and saving for a down payment feels out of reach.",
      plan: ["Build more: cut the red tape and outdated zoning that block starter homes and apartments",
        "Help first-time homebuyers with down-payment and closing-cost assistance",
        "Turn vacant and blighted properties into homes, especially in cities like Flint",
        "Protect renters from junk fees and unfair charges",
        "Partner with local builders and communities so new housing fits each region"],
      why: "Owning a home is how families build stability and wealth. That shouldn't be a dream reserved for the lucky few." },
    { id: "costs", top: true, cat: "affordability", icon: "cart", label: "Everyday costs", title: "Lower Everyday Costs",
      short: "Utilities, groceries and insurance keep climbing. Michigan families need relief, and Main Street needs room to grow.",
      problem: "Paychecks aren't keeping up. Michigan drivers pay some of the highest car-insurance rates in the country, utility bills keep rising even when the power goes out, and grocery prices squeeze every budget.",
      plan: ["Hold utilities accountable: no rate hikes without real improvements in reliability",
        "Keep pushing car-insurance costs down and protect drivers from unfair pricing",
        "Crack down on price gouging and junk fees on everyday bills",
        "Support small businesses with simpler rules, access to capital, and local investment",
        "Grow local economies so more money stays in Michigan communities"],
      why: "When families can afford the basics, they can plan, save, and invest in their future, and the whole state gets stronger." },
    { id: "schools", top: true, cat: "education", icon: "school", label: "Public schools", title: "Strong Public Schools, Valued Teachers",
      short: "Fully fund public schools, pay teachers like professionals, and modernize classrooms for the world kids are growing into.",
      problem: "Too many kids are falling behind, teachers are leaving the profession, and many classrooms don't have the tools to prepare students for a tech-driven future.",
      plan: ["Fully and fairly fund public schools, so a child's ZIP code doesn't decide their future",
        "Raise teacher pay and support so great teachers stay in the classroom",
        "Modernize classrooms: updated technology, computer science, and digital and AI literacy in every school",
        "Make sure every child is reading by third grade",
        "Put counselors and mental-health support in schools so students can focus on learning"],
      why: "Strong public schools are the foundation of opportunity, and how Michigan stays at the top." },
    { id: "pathways", cat: "education", icon: "path", label: "College & trades", title: "Every Path to a Great Career",
      short: "College, trade school or apprenticeship: every path should be affordable and lead to a good Michigan job.",
      problem: "College debt holds young people back, career and technical programs have been cut, and too many graduates leave Michigan to find work.",
      plan: ["Expand career and technical education in every high school",
        "Make community college and trade school more affordable and accessible",
        "Partner schools and colleges with Michigan employers so training matches real jobs",
        "Connect graduates with good-paying Michigan jobs, with incentives to build a career here"],
      why: "There's more than one road to success. Every one of them should lead to a future in Michigan." },
    { id: "roads", cat: "infrastructure", icon: "road", label: "Roads & bridges", title: "Fix the Roads & Bridges",
      short: "Michigan drivers deserve roads that don't wreck their cars and bridges they can trust.",
      problem: "Potholes cost drivers hundreds of dollars a year in repairs, and too many bridges are in poor condition.",
      plan: ["Long-term, dependable road funding, not one-year patches", "Fix roads based on need, with a public map of where the money goes", "Build with Michigan workers and demand quality that lasts", "Invest in public transit and safe routes for people without cars"],
      why: "Good roads get people to work, kids to school, and goods to market." },
    { id: "energy", cat: "infrastructure", icon: "bolt", label: "Energy & the grid", title: "Reliable, Affordable Energy",
      short: "Keep the lights on and bills low, and modernize Michigan's energy system using every tool we have.",
      problem: "Michigan families and businesses face some of the longest power outages in the region, even as rates keep going up.",
      plan: ["Improve grid reliability, with real penalties for utilities that leave families in the dark",
        "An all-of-the-above energy strategy that balances cost, reliability and the environment",
        "Modernize the grid and grow the energy jobs of the future here in Michigan",
        "Keep energy affordable as the system modernizes"],
      why: "Reliable, affordable power is essential for every home, school and business in Michigan." },
    { id: "water", cat: "infrastructure", icon: "water", label: "Clean water", title: "Clean Water & Great Lakes",
      short: "Safe drinking water in every home, and Great Lakes protected for the next generation.",
      problem: "Aging pipes, pollution and underfunded water systems put families at risk. Flint knows this better than anywhere.",
      plan: ["Replace every lead service line in Michigan", "Protect the Great Lakes from pollution and invasive species", "Make polluters, not taxpayers, pay for cleanup", "Keep water bills affordable while upgrading local systems"],
      why: "Clean, safe, affordable water is a basic right, and the Great Lakes are who we are." },
    { id: "mental", cat: "health", icon: "heart", label: "Mental health", title: "Mental Health Care When You Need It",
      short: "No one should wait months for help. Mental-health care should be as easy to get as any other care.",
      problem: "Michiganders often wait weeks or months for mental-health care, and many communities don't have a single provider nearby.",
      plan: ["Expand mental-health services in schools, colleges and communities", "Strengthen crisis response so people in crisis get help, not handcuffs", "Require insurers to cover mental health on equal terms with physical health", "Grow the mental-health workforce with loan forgiveness for those who serve in Michigan"],
      why: "Mental health is health. Getting help should never depend on where you live or what you can afford." },
    { id: "rural", cat: "health", icon: "health", label: "Rural & affordable care", title: "Healthcare Close to Home",
      short: "Affordable care, rural hospitals that stay open, and enough doctors and nurses to go around.",
      problem: "Rural hospitals are struggling, healthcare workers are in short supply, and medical bills remain a leading cause of debt.",
      plan: ["Keep rural hospitals and clinics open with targeted support", "Expand telehealth so care comes to you", "Address the shortage of doctors, nurses and healthcare workers through training and loan forgiveness", "Lower out-of-pocket costs and protect coverage for people with pre-existing conditions"],
      why: "Nobody should have to drive two hours to see a doctor, or go broke getting sick." },
    { id: "open", top: true, cat: "accountability", icon: "eye", label: "Open government", title: "Open Records for All",
      short: "Michigan's Governor and Legislature are exempt from public-records law. That ends.",
      problem: "Michigan is one of only two states where the Governor's office and the Legislature are exempt from public-records (FOIA) law. Spending is hard to follow, and public trust is low.",
      plan: ["End the FOIA exemption for the Governor and Legislature", "Put state spending online in a simple, searchable dashboard anyone can understand", "Cut unnecessary bureaucracy and use technology to make state services faster and easier", "Stronger ethics and disclosure rules to rebuild trust in elected officials"],
      why: "It's your government and your money. You have a right to see how both are being used." }
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
     PRIORITIES — pick top 3, saved to the campaign database
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

  // Weighted community tally from the server: #1 = 3 pts, #2 = 2 pts, #3 = 1 pt
  function renderResults(mine, tally = { scores: {}, voters: 0 }) {
    const scores = ISSUES.map((it) => ({ it, v: tally.scores[it.id] || 0 })).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...scores.map((s) => s.v));
    const total = scores.reduce((a, s) => a + s.v, 0) || 1;
    $("#prioTitle").textContent = "You're on the record ★";
    $("#prioHint").textContent = tally.voters > 1
      ? `${tally.voters.toLocaleString()} people have weighed in. Here's how Michigan's priorities rank so far.`
      : "You're one of the first to weigh in. Results fill in as more people share their priorities.";
    prioBars.innerHTML = scores.slice(0, 6).map((s) => `
      <div class="bar-row${mine.includes(s.it.id) ? " mine" : ""}">
        <div class="bar-top"><b>${s.it.label}</b><span>${Math.round((s.v / total) * 100)}%</span></div>
        <div class="bar"><i data-w="${(s.v / max) * 100}"></i></div>
      </div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => $$("i[data-w]", prioBars).forEach((i) => (i.style.width = i.dataset.w + "%"))));
    $$(".prio-opt", prioOptions).forEach((b) => { const i = mine.indexOf(b.dataset.id); b.classList.toggle("sel", i > -1); $(".rank", b).textContent = i > -1 ? i + 1 : ""; b.disabled = true; });
    prioSubmit.hidden = true; $("#prioShare").hidden = false;
  }
  prioSubmit.addEventListener("click", async () => {
    busy(prioSubmit, true, "Saving…");
    try {
      const tally = await api("/api/priorities", { picks });
      store.set("myPicks", picks);
      renderResults(picks, tally);
      burst();
      toast("Thanks for weighing in. Your voice shapes this campaign.");
    } catch (err) { toast(err.message); busy(prioSubmit, false); }
  });
  $("#prioShare").addEventListener("click", () => {
    const mine = store.get("myPicks", []).map((id) => ISSUES.find((x) => x.id === id).label);
    share(`My top 3 for Michigan: 1) ${mine[0]} 2) ${mine[1]} 3) ${mine[2]}. What are yours? #TeamReece`);
  });
  let savedPicks = store.get("myPicks");
  if (savedPicks && !savedPicks.every((id) => ISSUES.some((it) => it.id === id))) { store.del("myPicks"); savedPicks = null; }
  if (savedPicks) {
    renderResults(savedPicks);
    api("/api/priorities").then((t) => renderResults(savedPicks, t)).catch(() => {});
  } else renderPickState();

  /* =======================================================================
     MAP — regions of Michigan
     ======================================================================= */
  const REGIONS = [
    { id: "up", name: "Upper Peninsula", x: 205, y: 104, lx: 0, ly: 26, anchor: "middle", cities: "Marquette · Sault Ste. Marie · Escanaba · Houghton",
      focus: "Broadband that actually reaches, mining and timber jobs with a future, and making sure Lansing never forgets the U.P.", issues: ["rural", "jobs", "energy"] },
    { id: "north", name: "Northern Michigan", x: 318, y: 212, lx: 12, ly: 4, anchor: "start", cities: "Traverse City · Gaylord · Petoskey · Alpena",
      focus: "Housing that workers can afford in tourism towns, clean lakes, and year-round jobs, not just summer ones.", issues: ["housing", "jobs", "water"] },
    { id: "west", name: "West Michigan", x: 254, y: 320, lx: -12, ly: 4, anchor: "end", cities: "Grand Rapids · Holland · Muskegon",
      focus: "Keeping a growing region affordable, backing manufacturers, and protecting the Lake Michigan shoreline.", issues: ["housing", "jobs", "pathways"] },
    { id: "bay", name: "Great Lakes Bay", x: 346, y: 290, lx: 0, ly: -14, anchor: "middle", cities: "Saginaw · Bay City · Midland · Flint",
      focus: "Kevin's hometown region. Clean, safe water in every home, strong schools, revitalized downtowns, and the next generation of good-paying jobs.", issues: ["water", "schools", "housing"], home: true },
    { id: "thumb", name: "The Thumb", x: 400, y: 292, lx: 10, ly: 4, anchor: "start", cities: "Port Huron · Bad Axe · Lapeer · Sandusky",
      focus: "Family farms, rural hospitals that stay open, and roads that hold up to the work.", issues: ["rural", "roads", "costs"] },
    { id: "capital", name: "Capital Region", x: 314, y: 352, lx: -12, ly: 4, anchor: "end", cities: "Lansing · East Lansing · Jackson",
      focus: "Opening up state government, supporting students and young workers, and growing good jobs at home.", issues: ["open", "ai", "schools"] },
    { id: "metro", name: "Metro Detroit", x: 388, y: 372, lx: 0, ly: 24, anchor: "middle", cities: "Detroit · Warren · Dearborn · Troy · Ann Arbor",
      focus: "Where Kevin spent part of growing up, in Ann Arbor and Troy. Lower living costs, great schools, tech jobs, and a comeback that reaches every block.", issues: ["costs", "ai", "jobs"] },
    { id: "southwest", name: "Southwest Michigan", x: 262, y: 390, lx: 0, ly: 26, anchor: "middle", cities: "Kalamazoo · Battle Creek · Benton Harbor · St. Joseph",
      focus: "Where Kevin went to college at Western Michigan and worked in Kalamazoo. Investing in workers, students, and small towns, and connecting graduates with great Michigan careers.", issues: ["jobs", "pathways", "mental"] }
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
    regionCard.innerHTML = `
      <span class="eyebrow">Region</span>
      <h3>${r.name}${r.home ? '<span class="home-badge">Hometown</span>' : ""}</h3>
      <p class="region-cities">${r.cities}</p>
      <p class="region-focus">${r.focus}</p>
      <p class="region-label">Top issues here</p>
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
      if (rsvps[r.dataset.rsvp]) return toast("You're already on the list. See you there!");
      openRsvp(events.find((ev) => ev.key === r.dataset.rsvp), r);
    }
    const c = e.target.closest("[data-ics]");
    if (c) downloadICS(C.events[+c.dataset.ics]);
  });

  function openRsvp(ev, btn) {
    const m = me(), d = new Date(ev.date);
    openModal(`
      <span class="eyebrow">RSVP</span>
      <h3 id="modalTitle">${esc(ev.title)}</h3>
      <p style="color:var(--muted);margin-top:-8px">${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${esc(ev.place)}</p>
      <form id="rsvpForm" novalidate style="margin-top:22px">
        ${hp()}
        <div class="field"><label for="rName">Your name</label><input id="rName" name="name" autocomplete="name" required value="${esc(m.name || "")}" /><span class="err">Required</span></div>
        <div class="field-row">
          <div class="field"><label for="rEmail">Email</label><input id="rEmail" name="email" type="email" autocomplete="email" required value="${esc(m.email || "")}" /><span class="err">Enter a valid email</span></div>
          <div class="field"><label for="rGuests">Bringing guests?</label><select id="rGuests" name="guests">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n ? "+" + n : "Just me"}</option>`).join("")}</select></div>
        </div>
        <label class="check" style="margin-bottom:18px"><input type="checkbox" name="updates" checked /><span>Send me campaign updates</span></label>
        <button class="btn btn-primary" type="submit" style="width:100%">Save my spot</button>
      </form>`);
    const f = $("#rsvpForm");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateFields(f)) return;
      const fd = new FormData(f), b = $("button[type=submit]", f);
      const data = { event_key: ev.key, event_title: ev.title, event_date: ev.date, name: fd.get("name"), email: fd.get("email"), guests: fd.get("guests"), updates: fd.has("updates"), website: fd.get("website") };
      busy(b, true, "Saving…");
      try {
        await api("/api/rsvp", data);
        rememberMe({ name: data.name, email: data.email });
        rsvps[ev.key] = true; store.set("rsvps", rsvps);
        btn.classList.add("going"); btn.textContent = "✓ Going";
        closeModal(); burst(btn);
        toast("You're on the list! See you there.");
      } catch (err) { toast(err.message); busy(b, false); }
    });
  }

  // Shared validation for simple forms: required, email, ZIP
  function validateFields(root) {
    let ok = true;
    $$("[required]", root).forEach((inp) => {
      let valid = inp.value.trim() !== "";
      if (inp.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim());
      if (inp.name === "zip") valid = /^\d{5}$/.test(inp.value.trim());
      const f = inp.closest(".field"); if (f) f.classList.toggle("invalid", !valid);
      if (!valid && ok) { inp.focus(); ok = false; }
    });
    return ok;
  }

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
  nextBtn.addEventListener("click", async () => {
    if (!validate(step)) return;
    if (step < steps.length - 1) return setStep(step + 1);
    const fd = new FormData(form);
    const entry = {
      first: fd.get("first").trim(), last: fd.get("last").trim(), email: fd.get("email").trim(), phone: (fd.get("phone") || "").trim(),
      zip: fd.get("zip").trim(), region: fd.get("region"), help: fd.getAll("help"), when: fd.getAll("when"),
      message: (fd.get("message") || "").trim(), updates: fd.has("updates"), website: fd.get("website")
    };
    busy(nextBtn, true, "Joining…");
    try {
      await api("/api/volunteer", entry);
    } catch (err) { toast(err.message); busy(nextBtn, false); return; }
    busy(nextBtn, false);
    rememberMe({ name: `${entry.first} ${entry.last}`, email: entry.email, zip: entry.zip });
    const region = REGIONS.find((r) => r.id === entry.region);
    $("#memberCard").innerHTML = `
      <div class="mc-top"><span>TEAM<b>REECE</b>HQ</span><span>★</span></div>
      <div><div class="mc-meta">Founding Member</div><div class="mc-name">${esc(entry.first)} ${esc(entry.last)}</div></div>
      <div class="mc-top" style="color:var(--muted)"><span>${esc(region ? region.name : "Michigan")}</span><span>Est. ${new Date().getFullYear()}</span></div>`;
    form.hidden = true; $("#joinSuccess").classList.add("show");
    burst();
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
  $("#newsForm").insertAdjacentHTML("afterbegin", hp());
  $("#newsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, inp = $("input[type=email]", f), b = $("button", f), v = inp.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { inp.focus(); return toast("Enter a valid email address."); }
    busy(b, true, "…");
    try {
      const r = await api("/api/newsletter", { email: v, source: "footer", website: $("[name=website]", f).value });
      rememberMe({ email: v });
      inp.value = "";
      toast(r.already ? "You're already subscribed. Thanks for being part of the team!" : "You're subscribed. Welcome to the movement! ★");
    } catch (err) { toast(err.message); }
    busy(b, false);
  });

  /* ---------- Contact Kevin ---------- */
  const contactForm = $("#contactForm");
  contactForm.insertAdjacentHTML("afterbegin", hp());
  const m0 = me();
  if (m0.name) $("#cName").value = m0.name;
  if (m0.email) $("#cEmail").value = m0.email;
  if (m0.zip) $("#cZip").value = m0.zip;
  $$("[data-topic]").forEach((a) => a.addEventListener("click", () => { $("#cTopic").value = a.dataset.topic; setTimeout(() => $("#cMsg").focus({ preventScroll: true }), 600); }));
  contactForm.addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("invalid"); });
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateFields(contactForm)) return;
    const fd = new FormData(contactForm), b = $("button[type=submit]", contactForm);
    const data = Object.fromEntries(["name", "email", "zip", "topic", "message", "website"].map((k) => [k, fd.get(k) || ""]));
    data.updates = fd.has("updates");
    busy(b, true, "Sending…");
    try {
      await api("/api/contact", data);
      rememberMe({ name: data.name, email: data.email, zip: data.zip });
      contactForm.hidden = true; $("#contactSuccess").classList.add("show");
      burst(b);
    } catch (err) { toast(err.message); }
    busy(b, false);
  });
  $("#contactAgain").addEventListener("click", () => { $("#cMsg").value = ""; contactForm.hidden = false; $("#contactSuccess").classList.remove("show"); });

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
