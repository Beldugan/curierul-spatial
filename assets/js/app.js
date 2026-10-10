/* =========================================================
   Curierul spațial — joc despre inerție, masă și acțiune-reacțiune
   Fizica distractivă 05 · fără biblioteci externe
   ========================================================= */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DPR = Math.min(window.devicePixelRatio || 1, 2);
function fmt(v, d) { return v.toFixed(d === undefined ? 1 : d).replace(".", LANG === "ro" ? "," : "."); }
function say(txt, cls) { const el = $("say"); el.textContent = txt; el.className = "say" + (cls ? " " + cls : ""); }
let LAST_SAY = null;   // mesajul curent, ținut ca funcție ca să se poată traduce din mers
function sayF(fn, cls) { LAST_SAY = [fn, cls]; say(fn(), cls); }

/* ---------- canvas ---------- */
const cv = $("cv"), W = cv.width, H = cv.height, ctx = cv.getContext("2d");
cv.style.aspectRatio = W + " / " + H;
cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

/* ---------- fizica jocului ----------
   1 m = 50 px · 60 cadre pe secundă · un puf = o împingere de 1 t·m/s
   deci un puf schimbă viteza cu 1/masă (m/s) — exact „masa e măsura inerției”. */
const SCALE = 50, DT = 1 / 60, J = 1;
const STATION_X = 860, PORT_HALF = 30;
const SHIP_W = 56, SHIP_H = 34, CARGO_W = 70, CARGO_H = 46;

const LEVELS = [
  { id: 1, kind: "ship", ship: { x: 110, y: 380 }, m: 1, port: 220, fuel: 12, limit: 1.5, par: 4 },
  { id: 2, kind: "ship", ship: { x: 110, y: 430 }, m: 1, cargo: { x: 440, y: 130, m: 2 }, port: 300, fuel: 24, limit: 1.5, par: 10 },
  { id: 3, kind: "astro", x: 330, y: 300, v0: -0.15, body: 100, u: 10, port: 300, limit: 1.5,
    items: [{ k: "key", m: 2, e: "🔧" }, { k: "hammer", m: 4, e: "🔨" }, { k: "box", m: 10, e: "🧰" }] },
  { id: 4, kind: "ship", ship: { x: 100, y: 100 }, m: 1, cargo: { x: 300, y: 440, m: 4 }, port: 270, fuel: 30, limit: 1.0, par: 16,
    rocks: [{ x: 640, y: 55, r: 42 }, { x: 625, y: 150, r: 40 }, { x: 630, y: 395, r: 42 }, { x: 645, y: 490, r: 40 }, { x: 470, y: 205, r: 30 }, { x: 760, y: 120, r: 26 }] },
  { id: 5, kind: "fly", port: 270, limit: 1 }
];

let LV = 0;            // indexul misiunii
let S = null;          // starea misiunii
let BEST = [0, 0, 0, 0, 0];
try { const b = JSON.parse(localStorage_get("fd05-stars") || "null"); if (Array.isArray(b)) b.slice(0, 5).forEach((x, i) => BEST[i] = clamp(+x || 0, 0, 3)); } catch (e) { }

/* stele de fundal, fixe */
const STARS = [];
(function () { let s = 7; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 140; i++) STARS.push([r() * W, r() * H, r() * 1.4 + .3, r()]); })();

/* ---------- pornirea unei misiuni ---------- */
function startLevel(i) {
  LV = i; const L = LEVELS[i];
  S = { L, state: "play", fx: [], parts: [], puffs: 0, said: {}, t: 0, endTimer: 0, result: null };
  if (L.kind === "ship") {
    S.x = L.ship.x; S.y = L.ship.y; S.vx = 0; S.vy = 0; S.m = L.m; S.fuel = L.fuel;
    S.cargo = L.cargo ? { x: L.cargo.x, y: L.cargo.y, m: L.cargo.m, att: false, dx: 0, dy: 0 } : null;
  } else if (L.kind === "fly") {
    S.x = 0; S.y = 0; S.vx = 0; S.vy = 0;
    flyInit();
  } else {
    S.x = L.x; S.y = L.y; S.vx = L.v0; S.vy = 0;
    S.items = L.items.map(it => ({ ...it, used: false }));
    S.flying = []; S.used = 0;
  }
  $("overlay").classList.add("hidden");
  $("padShip").classList.toggle("hidden", L.kind !== "ship");
  $("padThrow").classList.toggle("hidden", L.kind !== "astro");
  $("padFly").classList.toggle("hidden", L.kind !== "fly");
  $("brief").innerHTML = t("m" + L.id + ".brief");
  if (L.kind === "astro") { buildThrowPad(); sayF(() => t("say.m3start")); }
  else if (L.kind === "fly") { flyPadUI(); sayF(() => t("fw.setup")); }
  else sayF(() => t("say.start"));
  renderMissions(); updHUD();
}

function shipMass() { return S.m + (S.cargo && S.cargo.att ? S.cargo.m : 0); }
function astroMass() { return S.L.body + S.items.filter(x => !x.used).reduce((a, x) => a + x.m, 0); }
function speed() { return Math.hypot(S.vx, S.vy); }

/* ---------- comenzi ---------- */
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function puff(dir) {
  if (!S || S.state !== "play" || S.L.kind !== "ship") return;
  if (S.fuel <= 0) { sayF(() => t("say.noFuel"), "warn"); return; }
  const [ux, uy] = DIRV[dir], dv = J / shipMass();
  S.vx += ux * dv; S.vy += uy * dv;
  S.fuel--; S.puffs++;
  S.fx.push({ kind: "puff", ux, uy, life: 30 });
  for (let i = 0; i < 14; i++) S.parts.push({ x: S.x - ux * 30, y: S.y - uy * 20, vx: -ux * (2 + Math.random() * 3) + (Math.random() - .5) * 1.5, vy: -uy * (2 + Math.random() * 3) + (Math.random() - .5) * 1.5, life: 26 + Math.random() * 10 });
  if (S.puffs === 1 && LV === 0) sayF(() => t("say.firstPuff"), "good");
  if (S.fuel === 0) sayF(() => t("say.noFuel"), "warn");
}
document.querySelectorAll(".tbtn").forEach(b => b.addEventListener("click", () => puff(b.dataset.dir)));
window.addEventListener("keydown", e => {
  if ($("p-game").classList.contains("hidden")) return;
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  const d = map[e.key]; if (!d) return;
  e.preventDefault(); if (e.repeat) return; puff(d);
});

function buildThrowPad() {
  const box = $("padThrow"); box.innerHTML = "";
  S.items.forEach((it, i) => {
    const d = document.createElement("div"); d.className = "item" + (it.used ? " used" : "");
    d.innerHTML = `<span class="nm">${it.e} ${t("it." + it.k)} · ${it.m} kg</span><div class="row">
      <button class="btn" data-i="${i}" data-d="-1">${t("throw.left")}</button>
      <button class="btn" data-i="${i}" data-d="1">${t("throw.right")}</button></div>`;
    d.querySelectorAll("button").forEach(b => { b.disabled = it.used; b.addEventListener("click", () => throwItem(+b.dataset.i, +b.dataset.d)); });
    box.appendChild(d);
  });
}
function throwItem(i, d) {
  if (!S || S.state !== "play") return;
  const it = S.items[i]; if (it.used) return;
  it.used = true; S.used++;
  const Mafter = astroMass();
  // conservarea impulsului: ce primește obiectul într-o parte primește astronautul în cealaltă
  const vItem = S.vx + d * S.L.u;
  S.vx -= it.m * d * S.L.u / Mafter;
  S.flying.push({ e: it.e, x: S.x + d * 30, y: S.y - 6, vx: vItem, rot: 0 });
  S.fx.push({ kind: "throw", d, life: 50 });
  sayF(() => { const name = t("it." + it.k + ".a");
    return t("say.thrown", { item: name, item2: name.charAt(0).toUpperCase() + name.slice(1), dir: t(d < 0 ? "dir.left" : "dir.right") }); }, "good");
  buildThrowPad();
  if (S.items.every(x => x.used)) setTimeout(() => { if (S && S.state === "play" && LV === 2) sayF(() => t("say.noItems"), "warn"); }, 2500);
}

/* ---------- coliziuni ---------- */
function rect(cx, cy, w, h) { return { x: cx - w / 2, y: cy - h / 2, w, h }; }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circRect(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w), ny = clamp(c.y, r.y, r.y + r.h);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}
function bodies() {
  const out = [rect(S.x, S.y, SHIP_W, SHIP_H)];
  if (S.cargo && S.cargo.att) out.push(rect(S.x + S.cargo.dx, S.y + S.cargo.dy, CARGO_W, CARGO_H));
  return out;
}

function endLevel(kind, extra) {
  if (S.state !== "play") return;
  S.state = "ending"; S.result = { kind, ...extra }; S.endTimer = kind === "win" ? 30 : 45;
  if (kind !== "win" && kind !== "dark") for (let i = 0; i < 40; i++) S.parts.push({ x: S.x + 20, y: S.y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, life: 40 + Math.random() * 20, boom: true });
}

/* ---------- pasul de simulare ---------- */
function step() {
  if (S && S.state === "play") {
    S.t++;
    S.x += S.vx * SCALE * DT; S.y += S.vy * SCALE * DT;
    const L = S.L, sp = speed();

    if (L.kind === "fly") {
      flyStep();
    } else if (L.kind === "ship") {
      // prinderea containerului
      if (S.cargo && !S.cargo.att && overlap(rect(S.x, S.y, SHIP_W, SHIP_H), rect(S.cargo.x, S.cargo.y, CARGO_W, CARGO_H))) {
        if (sp <= L.limit) {
          const m0 = S.m, mt = S.m + S.cargo.m;
          S.vx = S.vx * m0 / mt; S.vy = S.vy * m0 / mt;          // containerul leneș frânează nava
          S.cargo.att = true; S.cargo.dx = S.cargo.x - S.x; S.cargo.dy = S.cargo.y - S.y;
          // așezăm containerul lipit de navă, pe partea pe care a fost atins
          if (Math.abs(S.cargo.dx) * SHIP_H >= Math.abs(S.cargo.dy) * SHIP_W) { S.cargo.dx = Math.sign(S.cargo.dx || -1) * (SHIP_W + CARGO_W) / 2; S.cargo.dy = clamp(S.cargo.dy, -12, 12); }
          else { S.cargo.dy = Math.sign(S.cargo.dy) * (SHIP_H + CARGO_H) / 2; S.cargo.dx = clamp(S.cargo.dx, -14, 14); }
          sayF(() => t("say.cargoGot", { a: m0, b: mt, k: mt / m0 }), "good");
        } else { endLevel("crash", { why: "cargo" }); sayF(() => t("say.cargoHit"), "warn"); }
      }
      // asteroizi
      if (L.rocks) for (const r of L.rocks) for (const b of bodies()) if (circRect(r, b)) { endLevel("crash", { why: "rock" }); break; }
      // stația
      const bs = bodies();
      let lead = bs[0];
      bs.forEach(b => { if (b.x + b.w > lead.x + lead.w) lead = b; });
      if (lead.x + lead.w >= STATION_X && S.state === "play") {
        const aligned = Math.abs(lead.y + lead.h / 2 - L.port) <= PORT_HALF - 4 || (lead === bs[0] && Math.abs(S.y - L.port) <= PORT_HALF - 4);
        if (S.cargo && !S.cargo.att) {
          S.x -= (lead.x + lead.w - STATION_X) + 2; S.vx = -Math.abs(S.vx) * 0.4;
          sayF(() => t("say.noCargo"), "warn");
        } else if (!aligned) endLevel("crash", { why: "wall" });
        else if (sp <= L.limit) endLevel("win", { v: sp });
        else endLevel("crash", { why: "fast", v: sp });
      }
      if (S.state === "play" && sp > L.limit && S.x > STATION_X - 280 && !S.said.fast) { S.said.fast = true; sayF(() => t("say.fast"), "warn"); }
      if (S.x < -80 || S.y < -80 || S.y > H + 80) endLevel("lost");
    } else {
      S.flying.forEach(f => { f.x += f.vx * SCALE * DT * 0.35; f.rot += 0.2; });
      S.flying = S.flying.filter(f => f.x > -60 && f.x < W + 60);
      if (S.x + 24 >= STATION_X) {
        S.x = STATION_X - 24;
        if (sp <= L.limit) endLevel("win", { v: sp }); else endLevel("crash", { why: "fast", v: sp });
      }
      if (S.x < -50) endLevel("lost");
    }
  } else if (S && S.state === "ending") {
    if (--S.endTimer <= 0) { S.state = "over"; showOverlay(); }
  }
  if (S) {
    S.fx.forEach(f => f.life--); S.fx = S.fx.filter(f => f.life > 0);
    S.parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= .96; p.vy *= .96; p.life--; }); S.parts = S.parts.filter(p => p.life > 0);
    if (S.state === "ending" && S.result.kind !== "win") { /* nava rămâne pe loc când explodează */ }
  }
  draw(); updHUD();
  requestAnimationFrame(step);
}

/* ---------- final de misiune ---------- */
function starsFor() {
  const L = S.L;
  if (L.kind === "astro") return S.used <= 1 ? 3 : S.used === 2 ? 2 : 1;
  if (L.kind === "fly") { const f = S.fw.lit / FW.night; return f >= 0.995 ? 3 : f >= 0.75 ? 2 : 1; }
  return S.puffs <= L.par ? 3 : S.puffs <= L.par + 4 ? 2 : 1;
}
function showOverlay() {
  const r = S.result, L = S.L;
  $("overlay").classList.remove("hidden");
  $("ovLearn").classList.add("hidden");
  $("ovNext").classList.add("hidden");
  if (r.kind === "win") {
    const st = starsFor();
    BEST[LV] = Math.max(BEST[LV], st); localStorage_set("fd05-stars", JSON.stringify(BEST));
    $("ovTitle").textContent = t("ov.win");
    $("ovStars").textContent = "★".repeat(st) + "☆".repeat(3 - st);
    $("ovText").textContent = L.kind === "fly" ? t("ov.flyTxt", { s: fmt(S.fw.lit / 60, 1) })
      : t("ov.winTxt", { v: fmt(r.v, 2), p: L.kind === "astro" ? S.used : S.puffs, unit: t(L.kind === "astro" ? "ov.unitItem" : "ov.unitPuff") });
    $("ovLearn").classList.remove("hidden");
    $("ovLearnH").textContent = t("l" + L.id + ".h");
    $("ovLearnP").textContent = t("l" + L.id + ".p");
    $("ovReal").textContent = t("l" + L.id + ".r");
    $("ovNext").classList.remove("hidden");
    $("ovNext").textContent = LV < LEVELS.length - 1 ? t("ov.next") : t("ov.last");
    sayF(() => t("l" + L.id + ".h"), "good");
  } else {
    $("ovStars").textContent = "";
    if (r.kind === "dark") { $("ovTitle").textContent = t("ov.dark"); $("ovText").textContent = t("ov.darkTxt", { s: fmt(S.fw.lit / 60, 1) }); }
    else if (r.kind === "lost") { $("ovTitle").textContent = t("ov.lost"); $("ovText").textContent = t("ov.lostTxt"); }
    else {
      $("ovTitle").textContent = t("ov.crash");
      $("ovText").textContent = r.why === "fast" ? t("ov.crashTxt", { v: fmt(r.v, 2), l: fmt(L.limit, 1) })
        : r.why === "wall" ? t("ov.wallTxt") : r.why === "rock" ? t("ov.rockTxt") : t("say.cargoHit");
    }
  }
  renderMissions();
}
$("ovRetry").addEventListener("click", () => startLevel(LV));
$("ovNext").addEventListener("click", () => { if (LV < LEVELS.length - 1) startLevel(LV + 1); else $("tab-quiz").click(); });
$("btnRestart").addEventListener("click", () => startLevel(LV));

/* ---------- desen ---------- */
function draw() {
  ctx.clearRect(0, 0, W, H);
  // cer + Pământul
  ctx.fillStyle = "#070b18"; ctx.fillRect(0, 0, W, H);
  STARS.forEach(([x, y, r, k]) => { ctx.globalAlpha = .45 + .55 * Math.abs(Math.sin(k * 6 + (S ? S.t : 0) / 60)); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(-80, H + 560, 560, -80, H + 560, 720);
  g.addColorStop(0, "#1d5fbf"); g.addColorStop(.92, "#3f8ee8"); g.addColorStop(1, "rgba(120,190,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-80, H + 560, 720, 0, 7); ctx.fill();
  if (!S) return;
  const L = S.L;
  if (L.kind === "fly") { drawFly(); return; }
  drawStation(L);
  if (L.rocks) L.rocks.forEach(drawRock);
  if (L.kind === "ship") {
    if (S.cargo && !S.cargo.att) drawCargo(S.cargo.x, S.cargo.y, S.cargo.m);
    drawParts();
    if (S.cargo && S.cargo.att) drawCargo(S.x + S.cargo.dx, S.y + S.cargo.dy, S.cargo.m);
    if (S.state !== "ending" || S.result.kind === "win") drawShip();
  } else {
    drawParts();
    S.flying.forEach(f => { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); emoji(f.e, 0, 0, 34); ctx.restore(); });
    if (S.state !== "ending" || S.result.kind === "win") emoji("🧑‍🚀", S.x, S.y, 60);
    // frânghia de siguranță ruptă — un mic detaliu
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(S.x + 8, S.y + 10); ctx.quadraticCurveTo(S.x + 30, S.y + 50, S.x + 52, S.y + 34); ctx.stroke(); ctx.setLineDash([]);
  }
  drawFx();
  // vectorul viteză + valoarea
  if (S.state === "play") {
    const sp = speed();
    if (sp > 0.02) arrow(S.x, S.y, S.x + S.vx * 40, S.y + S.vy * 40, "#4ade80", 3);
    ctx.font = "bold 14px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = sp <= L.limit ? "#4ade80" : "#f87171";
    ctx.fillText(fmt(sp, 2) + " m/s", S.x, S.y - 40);
  }
}
function emoji(e, x, y, s) {
  ctx.font = s + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e, x, y); ctx.textBaseline = "alphabetic";
}
function arrow(x1, y1, x2, y2, color, w, label) {
  const ang = Math.atan2(y2 - y1, x2 - x1), h = 10 + w * 1.5;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * h * .6, y2 - Math.sin(ang) * h * .6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(ang - .45) * h, y2 - Math.sin(ang - .45) * h);
  ctx.lineTo(x2 - Math.cos(ang + .45) * h, y2 - Math.sin(ang + .45) * h); ctx.closePath(); ctx.fill();
  if (label) { ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, (x1 + x2) / 2, Math.min(y1, y2) - 8); }
  ctx.restore();
}
function drawStation(L) {
  ctx.save();
  // panouri solare
  ctx.fillStyle = "#1e3a8a"; ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 1;
  for (const y of [20, 430]) for (let i = 0; i < 2; i++) { ctx.fillRect(STATION_X + 20 + i * 42, y, 36, 90); ctx.strokeRect(STATION_X + 20 + i * 42, y, 36, 90); }
  // corpul
  const grd = ctx.createLinearGradient(STATION_X, 0, W, 0);
  grd.addColorStop(0, "#c8d0db"); grd.addColorStop(1, "#7d8796");
  ctx.fillStyle = grd; ctx.fillRect(STATION_X, 110, W - STATION_X, 320);
  ctx.strokeStyle = "#5b6472"; ctx.lineWidth = 2; ctx.strokeRect(STATION_X, 110, W - STATION_X, 320);
  ctx.fillStyle = "#4b5563"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.save(); ctx.translate(W - 26, 270); ctx.rotate(-Math.PI / 2); ctx.fillText(t("c.station"), 0, 0); ctx.restore();
  // portul
  const blink = Math.floor(Date.now() / 400) % 2;
  ctx.fillStyle = "#0f172a"; ctx.fillRect(STATION_X - 4, L.port - PORT_HALF, 14, PORT_HALF * 2);
  ctx.fillStyle = blink ? "#22c55e" : "#15803d";
  ctx.fillRect(STATION_X - 8, L.port - PORT_HALF - 6, 8, 6); ctx.fillRect(STATION_X - 8, L.port + PORT_HALF, 8, 6);
  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3; ctx.strokeRect(STATION_X - 4, L.port - PORT_HALF, 14, PORT_HALF * 2);
  ctx.fillStyle = "#86efac"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "right";
  ctx.fillText(L.kind === "astro" ? t("c.handle") : t("c.port"), STATION_X - 14, L.port - PORT_HALF - 6);
  // ghidaj punctat
  ctx.strokeStyle = "rgba(34,197,94,.25)"; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(STATION_X - 220, L.port); ctx.lineTo(STATION_X - 10, L.port); ctx.stroke();
  ctx.restore();
}
function drawRock(r) {
  ctx.save(); ctx.fillStyle = "#6b5b4b"; ctx.strokeStyle = "#3f342a"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r.r * (0.86 + 0.14 * Math.sin(i * 2.7 + r.x)); ctx.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#54473a"; ctx.beginPath(); ctx.arc(r.x - r.r * .3, r.y - r.r * .2, r.r * .18, 0, 7); ctx.fill();
  ctx.restore();
}
function drawCargo(x, y, m) {
  ctx.save();
  ctx.fillStyle = "#f97316"; ctx.strokeStyle = "#9a3412"; ctx.lineWidth = 2;
  ctx.fillRect(x - CARGO_W / 2, y - CARGO_H / 2, CARGO_W, CARGO_H); ctx.strokeRect(x - CARGO_W / 2, y - CARGO_H / 2, CARGO_W, CARGO_H);
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - CARGO_W / 2 + i * CARGO_W / 4, y - CARGO_H / 2 + 3); ctx.lineTo(x - CARGO_W / 2 + i * CARGO_W / 4, y + CARGO_H / 2 - 3); ctx.stroke(); }
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(t("c.cargo", { m: m }), x, y); ctx.textBaseline = "alphabetic";
  ctx.restore();
}
function drawShip() {
  const x = S.x, y = S.y;
  ctx.save();
  ctx.fillStyle = "#f1f5f9"; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - SHIP_W / 2, y - SHIP_H / 2); ctx.lineTo(x + SHIP_W / 2 - 14, y - SHIP_H / 2);
  ctx.quadraticCurveTo(x + SHIP_W / 2 + 4, y, x + SHIP_W / 2 - 14, y + SHIP_H / 2);
  ctx.lineTo(x - SHIP_W / 2, y + SHIP_H / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2563eb"; ctx.fillRect(x - SHIP_W / 2, y - 3, SHIP_W - 14, 6);
  ctx.fillStyle = "#7dd3fc"; ctx.beginPath(); ctx.arc(x + 12, y - 7, 6, 0, 7); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(x - SHIP_W / 2 - 5, y - 10, 5, 20);
  ctx.restore();
}
function drawParts() {
  S.parts.forEach(p => {
    ctx.globalAlpha = clamp(p.life / 30, 0, 1);
    ctx.fillStyle = p.boom ? (p.life % 6 < 3 ? "#fbbf24" : "#ef4444") : "#93c5fd";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.boom ? 4 : 3, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function drawFx() {
  S.fx.forEach(f => {
    const a = clamp(f.life / 20, 0, 1); ctx.globalAlpha = a;
    if (f.kind === "puff") {
      // flacăra + cele două săgeți egale: gazul într-o parte, nava în cealaltă
      const fx = S.x - f.ux * 34, fy = S.y - f.uy * 24;
      ctx.fillStyle = "#fb923c"; ctx.beginPath();
      ctx.moveTo(fx + f.uy * 8, fy + f.ux * 8); ctx.lineTo(fx - f.ux * 26, fy - f.uy * 26); ctx.lineTo(fx - f.uy * 8, fy - f.ux * 8); ctx.fill();
      arrow(S.x + f.ux * 30, S.y + f.uy * 26, S.x + f.ux * 80, S.y + f.uy * 76, "#ef4444", 4, f.uy ? "" : t("c.push"));
      arrow(fx - f.ux * 28, fy - f.uy * 28, fx - f.ux * 78, fy - f.uy * 78, "#60a5fa", 4, f.uy ? "" : "gaz / gas");
    } else if (f.kind === "throw") {
      arrow(S.x - f.d * 26, S.y + 34, S.x - f.d * 86, S.y + 34, "#ef4444", 4, t("c.push"));
      arrow(S.x + f.d * 26, S.y + 34, S.x + f.d * 86, S.y + 34, "#60a5fa", 4, t("c.push"));
    }
  });
  ctx.globalAlpha = 1;
}

/* =========================================================
   MISIUNEA 5 — Noaptea pe stație: volantul, bateria care se învârte
   Energia unui volant = ½ · I · ω²,  I = masa × (cât de departe de ax stă ea)
   aici: E = 2,5 · I · ω²  (ω = 1 la viteza maximă), deci E_max = 2,5 · I.
   ========================================================= */
const FW = {
  day: 720, night: 720,             // cadre (12 s + 12 s)
  charge: 18, lamp: 10, need: 120,  // energie/s de la soare, energie/s cerută de lumini, nevoia pe noapte
  mass: { light: 20, heavy: 60 }, pos: { mid: 0.5, rim: 1 },
  loss: { air: 0.08, mag: 0.003 },  // ce parte din energie se pierde pe secundă prin frecare
  rpmMax: 20000
};
let FW_CHOICE = { mass: "light", pos: "mid", bear: "air" };
function flyInit() {
  S.fw = { ...FW_CHOICE, E: 0, f: 0, phase: "setup", lit: 0, ang: 0, flow: 0, saidFull: false, saidSlow: false };
}
function fwI() { return FW.mass[S.fw.mass] * FW.pos[S.fw.pos]; }
function fwEmax() { return 2.5 * fwI(); }
function fwOmega() { return Math.sqrt(Math.max(0, S.fw.E) / fwEmax()); }
function flyPadUI() {
  const running = S && S.fw && S.fw.phase !== "setup";
  document.querySelectorAll("#padFly .opt").forEach(b => {
    b.setAttribute("aria-pressed", FW_CHOICE[b.dataset.k] === b.dataset.v);
    b.disabled = running;
  });
  $("flyStart").textContent = t(S && S.fw && S.fw.phase === "done" ? "fw.again" : "fw.start");
  $("flyStart").disabled = running && S.fw.phase !== "done";
}
document.querySelectorAll("#padFly .opt").forEach(b => b.addEventListener("click", () => {
  if (!S || S.L.kind !== "fly" || S.fw.phase !== "setup") return;
  FW_CHOICE[b.dataset.k] = b.dataset.v; S.fw[b.dataset.k] = b.dataset.v; flyPadUI();
}));
$("flyStart").addEventListener("click", () => {
  if (!S || S.L.kind !== "fly") return;
  if (S.fw.phase !== "setup") { startLevel(LV); }
  S.fw.phase = "day"; S.fw.f = 0; flyPadUI();
  sayF(() => t("fw.day"));
});
function flyStep() {
  const F = S.fw; if (F.phase === "setup" || F.phase === "done") { F.ang += 0; return; }
  const dt = DT, Emax = fwEmax();
  F.f++;
  if (F.phase === "day") {
    F.E = Math.min(Emax, F.E + FW.charge * dt);
    if (F.E >= Emax - 0.01 && !F.saidFull) { F.saidFull = true; sayF(() => t("fw.full"), "good"); }
    if (F.f === 240 && F.E < Emax * 0.6 && !F.saidSlow && F.mass === "heavy" && F.pos === "rim") { F.saidSlow = true; sayF(() => t("fw.slowFill")); }
    if (F.f >= FW.day) { F.phase = "night"; F.f = 0; sayF(() => t("fw.night")); }
  } else if (F.phase === "night") {
    if (F.E > 0) { F.E -= FW.lamp * dt; F.lit++; }
    if (F.E <= 0 && !F.saidDark) { F.E = 0; F.saidDark = true; sayF(() => t("fw.dark"), "warn"); }
    if (F.f >= FW.night) {
      F.phase = "done"; flyPadUI();
      if (F.lit / FW.night >= 0.4) endLevel("win", { v: 0 }); else endLevel("dark");
    }
  }
  F.E = Math.max(0, F.E - FW.loss[F.bear] * F.E * dt);
}
function flyLit() { const F = S.fw; return F.phase === "setup" || F.phase === "day" || (F.phase === "night" && F.E > 0) || (F.phase === "done" && F.E > 0); }
function flyHUD() {
  const F = S.fw, Emax = fwEmax();
  $("hSpeedK").textContent = t("hud.rpm");
  $("hSpeed").textContent = Math.round(fwOmega() * FW.rpmMax / 100) * 100 + "";
  const bar = $("hSpeedBar");
  bar.style.width = clamp(F.E / 150 * 100, 0, 100) + "%";
  bar.parentElement.classList.toggle("over", F.phase === "night" && F.E <= 0);
  $("hLimitMark").style.left = (FW.need / 150 * 100) + "%";
  $("hLimitK").textContent = t("hud.energy");
  $("hLimit").textContent = t("hud.need", { e: Math.round(F.E), m: Math.round(Emax), n: FW.need });
  $("hMassK").textContent = t("hud.fw");
  $("hMass").textContent = FW.mass[F.mass] + " kg · " + t(F.pos === "rim" ? "fw.rim" : "fw.mid").toLowerCase();
  $("hDvK").textContent = t("hud.light");
  $("hDv").textContent = fmt(F.lit / 60, 1) + " / 12 s";
  $("hFuelK").textContent = t("hud.phase");
  $("hFuel").textContent = F.phase === "day" ? t("hud.day") + " · " + Math.ceil((FW.day - F.f) / 60) + " s"
    : F.phase === "night" ? t("hud.night") + " · " + Math.ceil((FW.night - F.f) / 60) + " s" : t("hud.wait");
}
function drawFlywheel(c, cx, cy, R, ang, massKg, pos, labelColor) {
  c.save(); c.translate(cx, cy); c.rotate(ang);
  c.fillStyle = "#9aa6b5"; c.strokeStyle = "#4b5563"; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.stroke();
  c.fillStyle = "#c3ccd6"; c.beginPath(); c.arc(0, 0, R * .82, 0, 7); c.fill();
  c.strokeStyle = "#6b7280"; c.lineWidth = 4;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * Math.PI / 2) * R * .82, Math.sin(i * Math.PI / 2) * R * .82); c.stroke(); }
  const rr = pos === "rim" ? R * .9 : R * .3, sz = massKg >= 40 ? R * .15 : R * .09;
  c.fillStyle = "#c2410c"; c.strokeStyle = "#7c2d12"; c.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, sz, 0, 7); c.fill(); c.stroke(); }
  // un semn alb, ca să se vadă rotația
  c.fillStyle = "#fff"; c.fillRect(-4, -R + 2, 8, R * .22);
  c.fillStyle = "#374151"; c.beginPath(); c.arc(0, 0, R * .1, 0, 7); c.fill();
  c.restore();
}
function drawFly() {
  const F = S.fw, night = F.phase === "night" || (F.phase === "done");
  const day = !night;
  // Pământul: luminat ziua, întunecat noaptea, cu luminile orașelor
  const g = ctx.createRadialGradient(480, H + 900, 860, 480, H + 900, 1000);
  g.addColorStop(0, day ? "#1d5fbf" : "#0a1730"); g.addColorStop(.92, day ? "#3f8ee8" : "#11264a"); g.addColorStop(1, "rgba(80,140,220,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(480, H + 900, 1000, 0, 7); ctx.fill();
  if (night) { ctx.fillStyle = "#fde68a"; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = H - 70 + ((i * 37) % 60) + Math.abs(x - 480) * 0.12; ctx.fillRect(x, y, 2, 2); } }
  // soarele se mișcă pe cer ziua
  if (F.phase === "day" || F.phase === "setup") {
    const k = F.phase === "day" ? F.f / FW.day : 0.15, sx = 60 + k * 840, sy = 70 + Math.pow((k - .5) * 2, 2) * 30;
    const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 60); sg.addColorStop(0, "#fff7c2"); sg.addColorStop(.35, "#fcd34d"); sg.addColorStop(1, "rgba(252,211,77,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, 7); ctx.fill();
  }
  // panourile solare
  const panel = day ? "#2563eb" : "#1e2a4a";
  [[40, 130], [790, 130]].forEach(([x, y]) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = panel; ctx.fillRect(x + i * 66, y + j * 120, 60, 112);
      ctx.strokeStyle = day ? "#93c5fd" : "#334155"; ctx.lineWidth = 1; ctx.strokeRect(x + i * 66, y + j * 120, 60, 112);
    }
  });
  // corpul stației
  ctx.fillStyle = day ? "#c8d0db" : "#59616d"; ctx.fillRect(180, 150, 600, 220);
  ctx.strokeStyle = "#3f4752"; ctx.lineWidth = 2; ctx.strokeRect(180, 150, 600, 220);
  ctx.fillRect(170, 236, 10, 48); ctx.fillRect(780, 236, 10, 48);
  // ferestrele: aprinse dacă există energie
  const lit = flyLit();
  for (let i = 0; i < 7; i++) for (const yy of [168, 334]) {
    if (i === 3) continue;
    const x = 210 + i * 80;
    ctx.fillStyle = lit ? "#fde047" : "#111827";
    ctx.beginPath(); ctx.roundRect(x, yy, 46, 20, 6); ctx.fill();
    if (lit && night) { ctx.fillStyle = "rgba(253,224,71,.18)"; ctx.beginPath(); ctx.arc(x + 23, yy + 10, 30, 0, 7); ctx.fill(); }
  }
  // camera volantului
  const cx = 480, cy = 260;
  ctx.fillStyle = F.bear === "mag" ? "#0b1020" : "#2b3442"; ctx.beginPath(); ctx.arc(cx, cy, 104, 0, 7); ctx.fill();
  ctx.strokeStyle = F.bear === "mag" ? "#a78bfa" : "#6b7280"; ctx.lineWidth = 4; ctx.stroke();
  const om = fwOmega();
  if (F.phase !== "setup") F.ang += 0.04 + 0.42 * om;
  drawFlywheel(ctx, cx, cy, 88, F.ang, FW.mass[F.mass], F.pos);
  ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = F.bear === "mag" ? "#c4b5fd" : "#cbd5e1";
  ctx.fillText(F.bear === "mag" ? t("c.vac") + " · " + t("c.mag") : "", cx, cy + 122);
  // fluxul de energie: soare → volant ziua, volant → ferestre noaptea
  F.flow = (F.flow + 0.02) % 1;
  if (F.phase === "day" && F.E < fwEmax() - 0.01) {
    for (let k = 0; k < 5; k++) { const p = (F.flow + k / 5) % 1;
      ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(180 + p * 196, 260, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(780 - p * 196, 260, 5, 0, 7); ctx.fill(); }
  } else if (F.phase === "night" && F.E > 0) {
    for (let k = 0; k < 5; k++) { const p = (F.flow + k / 5) % 1;
      ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(cx, cy - 104 - p * 60, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + 104 + p * 50, 4, 0, 7); ctx.fill(); }
  }
  // bara-baterie desenată sub stație
  const bx = 330, by = 420, bw = 300, bh = 34, Emax = fwEmax();
  ctx.fillStyle = "rgba(15,23,42,.85)"; ctx.beginPath(); ctx.roundRect(bx - 10, by - 30, bw + 34, bh + 44, 10); ctx.fill();
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh); ctx.fillStyle = "#e5e7eb"; ctx.fillRect(bx + bw, by + 10, 8, 14);
  ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(bx + 3, by + 3, (bw - 6) * Emax / 150, bh - 6);
  ctx.fillStyle = F.E >= FW.need ? "#22c55e" : F.E > 0 ? "#eab308" : "#ef4444"; ctx.fillRect(bx + 3, by + 3, (bw - 6) * F.E / 150, bh - 6);
  const nx = bx + 3 + (bw - 6) * FW.need / 150;
  ctx.strokeStyle = "#fff"; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(nx, by - 4); ctx.lineTo(nx, by + bh + 4); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#e5e7eb"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left";
  ctx.fillText("⚙️🔋 " + Math.round(F.E) + " / " + Math.round(Emax), bx, by - 10);
  ctx.textAlign = "right"; ctx.fillText(t("c.need") + " ↓", nx + 4, by - 10);
  // eticheta fazei
  ctx.textAlign = "center"; ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = night ? "#c7d2fe" : "#fef3c7";
  if (F.phase !== "setup") ctx.fillText((F.phase === "day" ? "☀️ " + t("c.day") : "🌙 " + t("c.night")), W / 2, 36);
}

/* =========================================================
   LABORATORUL VOLANTULUI
   ========================================================= */
function fitC(cv) {
  const w = cv.width, h = cv.height, c = cv.getContext("2d");
  cv.style.aspectRatio = w + " / " + h; cv.width = w * DPR; cv.height = h * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  cv.__w = w; cv.__h = h; return c;
}
const LAB = { w: [{ I: 0.5, om: 0, ang: 0, t: 0, stopAt: null }, { I: 1, om: 0, ang: 0, t: 0, stopAt: null }], brake: false, bt: 0, msg: ["lab1.start"], n: 1, heavy: false, ang2: 0 };
let c1, c2;
function labInit() {
  c1 = fitC($("cvLab1")); c2 = fitC($("cvLab2"));
  $("l1Push").addEventListener("click", () => { LAB.brake = false; LAB.w.forEach(w => { w.om += 1 / w.I; w.stopAt = null; }); LAB.msg = ["lab1.pushed"]; labSay(); });
  $("l1Same").addEventListener("click", () => { LAB.brake = false; LAB.w.forEach(w => { w.om = 1.5; w.stopAt = null; }); LAB.msg = ["lab1.samed"]; labSay(); });
  $("l1Brake").addEventListener("click", () => { if (LAB.w.every(w => w.om <= 0)) return; LAB.brake = true; LAB.bt = 0; LAB.w.forEach(w => w.stopAt = null); LAB.msg = ["lab1.braking"]; labSay(); });
  $("l1Stop").addEventListener("click", () => { LAB.brake = false; LAB.w.forEach(w => { w.om = 0; w.stopAt = null; }); LAB.msg = ["lab1.start"]; labSay(); });
  document.querySelectorAll(".l2s").forEach(b => b.addEventListener("click", () => { LAB.n = +b.dataset.n; lab2UI(); }));
  $("l2Heavy").addEventListener("change", e => { LAB.heavy = e.target.checked; lab2UI(); });
  lab2UI(); labSay();
  requestAnimationFrame(labStep);
}
function labSay() {
  const [k, v] = LAB.msg; const el = $("sayLab1");
  el.textContent = t(k, v ? { a: fmt(v.a, 1), b: fmt(v.b, 1) } : undefined); el.className = "say" + (k === "lab1.braked" || k === "lab1.samed" ? " good" : "");
}
function lab2UI() {
  document.querySelectorAll(".l2s").forEach(b => b.classList.toggle("ghost", +b.dataset.n !== LAB.n));
  const nn = LAB.n * LAB.n, b = nn * (LAB.heavy ? 2 : 1);
  let s = t("lab2.txt", { n: LAB.n, nn });
  if (LAB.heavy) s += t("lab2.txtH", { nn, b });
  if (LAB.n > 1) s += t("lab2.tip");
  $("sayLab2").textContent = s; $("sayLab2").className = "say good";
}
function labLang() { if (c1) { labSay(); lab2UI(); } }
function labStep() {
  const BR = 0.3;   // aceeași frână (moment de frânare) pe amândouă
  if (LAB.brake) LAB.bt += DT;
  LAB.w.forEach(w => {
    if (LAB.brake && w.om > 0) { w.om = Math.max(0, w.om - BR / w.I * DT); if (w.om === 0) w.stopAt = LAB.bt; }
    else if (!LAB.brake) w.om *= 0.9995;
    w.ang += w.om * DT * 2 * Math.PI * 0.5;
  });
  if (LAB.brake && LAB.w.every(w => w.om === 0)) {
    LAB.brake = false; LAB.msg = ["lab1.braked", { a: LAB.w[0].stopAt, b: LAB.w[1].stopAt }]; labSay();
  }
  drawLab1(); drawLab2();
  requestAnimationFrame(labStep);
}
function drawLab1() {
  const c = c1, Wd = 900, Hd = 300;
  c.clearRect(0, 0, Wd, Hd);
  const ink = isDark() ? "#e8eef6" : "#16202b", soft = isDark() ? "#9fb0c4" : "#55657a";
  LAB.w.forEach((w, i) => {
    const cx = 225 + i * 450, cy = 130;
    drawFlywheel(c, cx, cy, 95, w.ang, 30, i ? "rim" : "mid");
    c.fillStyle = ink; c.font = "bold 15px system-ui, sans-serif"; c.textAlign = "center";
    c.fillText("6 kg · " + t(i ? "lab1.r" : "lab1.l"), cx, 248);
    c.fillStyle = soft; c.font = "14px system-ui, sans-serif";
    c.fillText(t("lab1.rpm", { v: Math.round(w.om * 60) }) + (w.stopAt !== null ? " · " + t("lab1.stopAt", { s: fmt(w.stopAt, 1) }) : ""), cx, 268);
    // bara de energie: E = ½ I ω²
    const E = 0.5 * w.I * w.om * w.om, maxE = 0.5 * 1 * 3 * 3;
    c.fillStyle = isDark() ? "#2b3746" : "#d6dee9"; c.fillRect(cx - 120, 280, 240, 12);
    c.fillStyle = "#eab308"; c.fillRect(cx - 120, 280, 240 * clamp(E / maxE, 0, 1), 12);
    c.fillStyle = soft; c.font = "11px system-ui, sans-serif"; c.textAlign = "left"; c.fillText("⚡ " + t("lab1.en"), cx + 126, 290);
  });
}
function drawLab2() {
  const c = c2, Wd = 900, Hd = 250, ink = isDark() ? "#e8eef6" : "#16202b";
  c.clearRect(0, 0, Wd, Hd);
  LAB.ang2 += 0.05 * LAB.n;
  drawFlywheel(c, 140, 125, 95, LAB.ang2, LAB.heavy ? 60 : 20, "rim");
  c.fillStyle = ink; c.font = "bold 16px system-ui, sans-serif"; c.textAlign = "center";
  c.fillText("× " + LAB.n, 140, 245);
  const b = LAB.n * LAB.n * (LAB.heavy ? 2 : 1);
  for (let i = 0; i < b; i++) {
    const col = i % 9, row = Math.floor(i / 9), x = 300 + col * 62, y = 40 + row * 62;
    c.fillStyle = "#facc15"; c.strokeStyle = "#a16207"; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x, y, 52, 52, 8); c.fill(); c.stroke();
    c.fillStyle = "#713f12"; c.font = "24px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("⚡", x + 26, y + 28); c.textBaseline = "alphabetic";
  }
  c.fillStyle = ink; c.font = "bold 15px system-ui, sans-serif"; c.textAlign = "left";
  c.fillText(b === 1 ? t("lab2.cube1") : t("lab2.cubes", { b }), 300, 28);
}

/* ---------- HUD și lista de misiuni ---------- */
function updHUD() {
  if (!S) return;
  const L = S.L, sp = speed();
  if (L.kind === "fly") { flyHUD(); return; }
  $("hSpeedK").textContent = t("hud.speed"); $("hLimitK").textContent = t("hud.limit");
  $("hMassK").textContent = t("hud.mass"); $("hDvK").textContent = t("hud.dv");
  $("hSpeed").textContent = fmt(sp, 2) + " m/s";
  const bar = $("hSpeedBar"), meter = bar.parentElement;
  bar.style.width = clamp(sp / (L.limit * 2) * 100, 0, 100) + "%";
  meter.classList.toggle("over", sp > L.limit);
  $("hLimitMark").style.left = "50%";
  $("hLimit").textContent = t("hud.under", { v: fmt(L.limit, 1) });
  if (L.kind === "ship") {
    const m = shipMass();
    $("hMass").textContent = m + " t";
    $("hDv").textContent = fmt(J / m, 2) + " m/s";
    $("hFuelK").textContent = t("hud.fuel");
    $("hFuel").textContent = S.fuel;
  } else {
    $("hMass").textContent = astroMass() + " kg";
    $("hDv").textContent = "—";
    $("hFuelK").textContent = t("hud.items");
    $("hFuel").textContent = S.items.filter(x => !x.used).length;
  }
}
function renderMissions() {
  const box = $("missions"); box.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const b = document.createElement("button"); b.className = "mcard"; b.setAttribute("aria-pressed", i === LV);
    b.innerHTML = `<span class="st">${"★".repeat(BEST[i])}${"☆".repeat(3 - BEST[i])}</span><span class="n">${t("mission", { n: L.id })}</span>
      <span class="tt">${t("m" + L.id + ".t")}</span><span class="tag">${t("m" + L.id + ".tag")}</span>`;
    b.addEventListener("click", () => startLevel(i));
    box.appendChild(b);
  });
  $("totalStars").textContent = t("total", { s: BEST.reduce((a, b) => a + b, 0) });
}

/* ---------- taburi, temă, limbă ---------- */
const TABS = [["tab-game", "p-game"], ["tab-lab", "p-lab"], ["tab-quiz", "p-quiz"]];
TABS.forEach(([tb, pn]) => $(tb).addEventListener("click", () => {
  TABS.forEach(([t2, p2]) => { $(t2).setAttribute("aria-selected", t2 === tb); $(p2).classList.toggle("hidden", p2 !== pn); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}));
function isDark() {
  const a = document.documentElement.getAttribute("data-theme");
  if (a) return a === "dark";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
$("themeBtn").addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next); localStorage_set("fd05-theme", next);
});
(function () { const s = localStorage_get("fd05-theme"); if (s) document.documentElement.setAttribute("data-theme", s); })();
$("langRo").addEventListener("click", () => setLang("ro"));
$("langEn").addEventListener("click", () => setLang("en"));

/* ---------- quiz ---------- */
const QUIZ = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
let answered = {}, score = 0;
function buildQuiz() {
  answered = {}; score = 0; $("vScore").textContent = "";
  const box = $("quizBox"); box.innerHTML = "";
  QUIZ.forEach(q => {
    const opts = [["a", true], ["b", false], ["c", false]].sort(() => Math.random() - .5);
    const d = document.createElement("div"); d.className = "q";
    d.innerHTML = `<p class="qt">${t(q + ".q")}</p><div class="opts"></div><div class="fb"></div>`;
    const wrap = d.querySelector(".opts");
    opts.forEach(([k, ok]) => {
      const b = document.createElement("button");
      b.textContent = t(q + "." + k);
      b.addEventListener("click", () => {
        if (answered[q]) return;
        answered[q] = true; b.classList.add(ok ? "ok" : "no");
        if (!ok) wrap.querySelectorAll("button").forEach(x => { if (x.textContent === t(q + ".a")) x.classList.add("ok"); });
        if (ok) score++;
        d.querySelector(".fb").textContent = t(q + ".f");
        $("vScore").textContent = t("quiz.score", { a: score, b: QUIZ.length }) +
          (Object.keys(answered).length === QUIZ.length && score === QUIZ.length ? " — " + t("quiz.perfect") : "");
      });
      wrap.appendChild(b);
    });
    box.appendChild(d);
  });
}
$("btnQuizReset").addEventListener("click", buildQuiz);

/* ---------- pornire ---------- */
function onLangChange() {
  buildQuiz();
  if (!S) return;
  renderMissions();
  $("brief").innerHTML = t("m" + S.L.id + ".brief");
  if (S.L.kind === "astro") buildThrowPad();
  if (S.L.kind === "fly") flyPadUI();
  labLang();
  if (S.state === "over") showOverlay();
  if (LAST_SAY) say(LAST_SAY[0](), LAST_SAY[1]);
}
startLevel(0);
labInit();
applyI18n();
requestAnimationFrame(step);
