// Draft F2: headline layout. Tracker, tabs, section subtabs, podium, race-to-majority
// chambers, receipts, everyone's-picks grid. On election night it runs on data.json
// fetched every 60 s.
let P = window.POOL;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const last = n => n.replace(/\*|\s\((D|R|I)\)/g, "").trim().split(" ").slice(-1)[0];
const clean = n => n.replace(/\*/g, "");
const pty = n => ((n || "").match(/\((D|R|I)\)/) || [])[1] || "";
const pcls = n => "pc-" + (pty(n) || "N");
const place = s => s.replace(" (special)", "");
const SHORT = { "North Carolina": "N. Carolina", "South Carolina": "S. Carolina", "New Hampshire": "N. Hampshire", "Ohio (special)": "Ohio", "Florida (special)": "Florida", Mississippi: "Mississippi" };
const ABBR = { "North Carolina": "NC", Maine: "ME", Georgia: "GA", Michigan: "MI", "Ohio (special)": "OH", Ohio: "OH", Texas: "TX", Iowa: "IA",
  Alaska: "AK", "New Hampshire": "NH", Kansas: "KS", Minnesota: "MN", "South Carolina": "SC", Louisiana: "LA", "Florida (special)": "FL",
  Nebraska: "NE", Mississippi: "MS", Arizona: "AZ", Wisconsin: "WI", Nevada: "NV", California: "CA" };
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0] || "th");

// ---- who is viewing (remembered on this phone; ?me=Name also works) ----
// The Crowd (the pool's most common picks) is scored but never ranked, so it can't take a place.
const withRanks = lb => { let r = 0, n = 0, prev = null; return lb.map(e => { if (e.crowd) return { ...e, rank: null }; n++; if (e.points !== prev) { r = n; prev = e.points; } return { ...e, rank: r }; }); };
let RK = withRanks(P.leaderboard);
const tied = e => !e.crowd && RK.filter(x => x.rank === e.rank).length > 1;
const rankText = e => e.crowd ? "Not ranked" : `${tied(e) ? "Tied for " : ""}${ord(e.rank)}`;
const CTAG = `<span class="ctag">The pool's most popular picks</span>`;
const byName = (a, b) => (a.crowd - b.crowd) || a.name.localeCompare(b.name);  // The Crowd sorts last
// Personal view only from a personal link (?me=Name). Nothing is remembered, so
// tapping around never changes who "you" are.
const ME = new URLSearchParams(location.search).get("me");
// Match loosely: names may carry stray spaces or different case in the sheet.
const norm = s => String(s || "").trim().toLowerCase();
// Renamed after links went out: old ?me= names still open the right card.
const ALIAS = { "jessica giles": "jess like that" };
const me = () => { const k = ALIAS[norm(ME)] || norm(ME); return RK.find(e => norm(e.name) === k) || null; };

// ---- races: decided, or still counting ----
const buildAll = () => [...P.sections.flatMap(s => s.races.map(r => ({ ...r, sec: s.title }))), ...P.corner.races.map(r => ({ ...r, sec: "Superintendents" }))];
let ALL = buildAll();
const myPick = r => { const m = me(); if (!m) return null; const i = ALL.findIndex(x => x.state === r.state && x.cands[0].name === r.cands[0].name); /* state alone collides: Senate and governor races share states */ return i < 0 ? null : m.picks[i]; };
const ORDER = { called: 0, counting: 1, waiting: 2 };

function bar(r) {
  if (r.status === "waiting") return `<div class="bar off"><span class="half"></span></div>`;
  const [a, b] = r.cands, np = !pty(a.name) && !pty(b.name);
  return `<div class="bar"><i class="${np ? "pc-A" : pcls(a.name)}" style="width:${a.share}%"></i><b></b><i class="${np ? "pc-B" : pcls(b.name)}" style="width:${b.share}%"></i><span class="half"></span></div>${np ? `<div class="barnames"><span>◼ ${esc(last(a.name))}</span><span class="b">${esc(last(b.name))} ◼</span></div>` : ""}`;
}
function youLine(r, pick) {
  if (!pick) return "";
  const st = r.winner ? (pick === r.winner ? ["ok", "✓ right"] : ["no", "✗ wrong"]) : r.leader ? (pick === r.leader ? ["up", "▲ ahead"] : ["dn", "▼ behind"]) : ["pend", "Not started"];
  return `<span class="you ${st[0]}">You picked ${esc(last(pick))} · ${st[1]}</span>`;
}
function race(r, opts = {}) {
  const called = r.status === "called", waiting = r.status === "waiting";
  const kick = called ? (r.flip ? "Seat changes party" : "") : waiting ? "" : `${r.pct_in}% of votes in`;
  const where = opts.title || place(r.state);
  const head = called ? `<span class="${pcls(r.winner)}">${esc(last(r.winner))}</span> wins ${esc(where)}`
    : waiting ? esc(where) : `<span class="${pcls(r.leader)}">${esc(last(r.leader))}</span> ahead in ${esc(where)}`;
  const detail = waiting ? esc(r.note || "Polls still open")
    : r.cands.map(c => `<span class="${c.name === r.winner ? "w" : ""}">${esc(clean(c.name))} ${c.share}%</span>`).join(" · ");
  const upset = "";
  return `<div class="race hl ${called ? "is-called" : waiting ? "is-wait" : "is-count"}">
    ${kick ? `<div class="kick">${kick}</div>` : ""}<div class="head">${head}</div><div class="sub">${detail}</div>${upset}
    ${bar(r)}<div class="poolrow"><span class="pool">${opts.watch ? "Not in the pool · just watching" : `Pool: ${r.cands.map(c => `<b>${c.picks}</b> picked ${esc(last(c.name))}`).join(" · ")}`}</span></div>
    <div class="meta">${(!opts.watch && youLine(r, myPick(r))) || "<span></span>"}
    <a class="follow" href="${r.follow}" target="_blank" rel="noopener">Full results ↗</a></div></div>`;
}
const grouped = (list, fn) => {
  const by = k => list.filter(r => r.status === k);
  return [["called", "Decided"], ["counting", "Still counting"], ["waiting", "Not started"]]
    .map(([k, l]) => by(k).length ? `<div class="grp-l">${l} <span>${by(k).length}</span></div>${by(k).map(fn).join("")}` : "").join("");
};

// ---- chambers: a race to the majority line ----
function chamber(c, i) {
  const won = c.majority > 0 && c.d_won >= c.majority ? "D" : c.majority > 0 && c.r_won >= c.majority ? "R" : null;
  const party = p => p === "D" ? "Democrats" : "Republicans";
  const lead = c.d_won > c.r_won ? "D" : c.r_won > c.d_won ? "R" : null;
  const lane = (p, n) => `<div class="lane"><span class="ln-l pc-${p}">${p === "D" ? "Dem" : "Rep"}</span>
      <div class="track"><div class="fill f-${p}" style="width:${Math.min(n / c.majority * 100, 100)}%"></div></div>
      <span class="ln-n"><b>${n}</b> <small>${won === p ? "✓ majority" : `${Math.max(c.majority - n, 0)} to go`}</small></span></div>`;
  const head = won ? `<span class="pc-${won}">${party(won)}</span> win control`
    : c.status === "waiting" ? esc(c.note || "Not started") : lead ? `<span class="pc-${lead}">${party(lead)}</span> lead ${Math.max(c.d_won, c.r_won)}–${Math.min(c.d_won, c.r_won)}` : "Even so far";
  const m = me(), pick = m ? m.extra.chambers[i] : null;
  const st = won ? (pick === won ? ["ok", "✓ right"] : ["no", "✗ wrong"]) : lead ? (pick === lead ? ["up", "▲ ahead"] : ["dn", "▼ behind"]) : ["pend", "Not started"];
  const you = (pick ? `<span class="you ${st[0]}">You picked ${party(pick)} · ${st[1]}</span>` : "<span></span>");
  const poolrow = `<div class="poolrow"><span class="pool">Pool: <b>${c.picks_d}</b> picked Dems · <b>${c.picks_r}</b> picked Reps</span></div>`;
  const before = c.now.startsWith("Tied") ? c.now : c.now.replace(/^([DR]) (\d+)–(\d+)$/, (_, p, a, b) => p === "D" ? `Democrats ${a}, Republicans ${b}` : `Republicans ${a}, Democrats ${b}`);
  return `<div class="race hl chamber ${won ? "is-called" : "is-count"}">
    <div class="kick">${esc(c.name)}</div><div class="head sm">${head}</div>
    <div class="sub">First party to ${c.majority} seats wins control · ${c.uncalled} seats not decided yet${c.holdover ? `<br>${esc(c.holdover)}` : ""}</div>
    <div class="lanes">${lane("D", c.d_won)}${lane("R", c.r_won)}<span class="goal" title="${c.majority} seats for control">${c.majority}</span></div>
    <div class="fine">Before tonight: ${esc(before)}${c.total % 2 === 0 ? ` · ${c.total / 2}–${c.total / 2} tie: no point` : ""}</div>
    ${poolrow}<div class="meta">${you}<a class="follow" href="${c.follow}" target="_blank" rel="noopener">Full results ↗</a></div></div>`;
}

// ---- numbers: current value on the pool's guess range ----
const NUM_PLAIN = ["How many House seats Democrats gain (+) or lose (−)", "How many Senate seats Democrats will have", "How many governors will be Democrats (they had 24 before tonight)"];
const plainBasis = b => b.replace(/\s*\(baseline \d+\)/, "").replace(/called/g, "decided");
function closeness(i, mine, n) {
  const v = parseFloat(mine), now = n.now_n, left = n.remaining ?? 0;
  if (Number.isNaN(v)) return ["pend", ""];
  if (n.status === "final" || !left) { const d = x => Math.abs(parseFloat(x) - now); const better = RK.filter(e => !e.crowd && d(e.extra.numbers[i]) < d(v)).length;
    return [better === 0 ? "ok" : "pend", better === 0 ? "✓ Closest guess" : `${ord(better + 1)} closest`]; }
  return ["pend", ""]; }  // only distance from the final number counts, so no status until it's final
const nfmt = (i, v) => i === 0 ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) : String(v);
const MAJ_LABEL = ["House control", "Senate control"];
// Below every guess, "closest" just means "guessed lowest", so gold waits until the count reaches the guesses.
const lowGuess = n => Math.min(...(n.guesses || []).filter(g => !g.c).map(g => g.v));
const goldOn = n => n.status === "final" || n.now_n >= lowGuess(n);
// Every guess as a dot on the number line; dots that land together stack up. The current number,
// and the majority line run through it. Gold = closest to the current number.
function swarm(n, i) {
  const W = Math.min(document.documentElement.clientWidth, 720) - 32, D = 10, gs = n.guesses || [];
  if (!gs.length) return "";
  const lo = n.lo, hi = n.hi, gLo = Math.min(...gs.map(g => g.v)), a = gLo - 1;
  const brk = (a - lo) / (hi - lo) > 0.3;  // current number far below every guess: squeeze the empty stretch
  const f = v => !brk ? (v - lo) / (hi - lo) : v <= a ? 0.08 * (v - lo) / Math.max(a - lo, 1) : 0.15 + 0.85 * (v - a) / (hi - a);
  const x = v => Math.round(Math.max(0, Math.min(1, f(v))) * W);
  const real = gs.filter(g => !g.c), target = goldOn(n) ? n.now_n : null;
  const best = target == null ? null : Math.min(...real.map(g => Math.abs(g.v - target)));
  const isLead = g => !g.c && best != null && Math.abs(g.v - target) === best, m = me();
  const rows = [];
  const placed = [...gs].sort((p, q) => p.v - q.v || (p.c ? 1 : 0) - (q.c ? 1 : 0)).map(g => {
    const px = x(g.v); let r = 0; while ((rows[r] || []).some(q => Math.abs(q - px) < D + 1)) r++;
    (rows[r] = rows[r] || []).push(px); return { ...g, px, r }; });
  const H = rows.length * (D + 2);
  const cls = g => ["d", m && norm(m.name) === norm(g.n) ? "me" : "", g.c ? "crowd" : "", isLead(g) ? "lead" : ""].join(" ");
  const dots = placed.map(g => `<span class="${cls(g)}" data-numv="${i}|${g.v}" style="left:${g.px}px;bottom:${g.r * (D + 2)}px"></span>`).join("");
  const side = px => px < 50 ? "l" : px > W - 50 ? "r" : "";
  const vl = (k, v, label, extra = "") => v == null ? "" : `<span class="vl ${k}${extra}" style="left:${x(v)}px;top:0;height:${H + 2}px"><i class="${side(x(v))}">${label}</i></span>`;
  const over = n.majority != null && n.now_n >= n.majority;
  const lines = vl("maj", n.majority, over ? `✓ ${nfmt(i, n.majority)} = ${MAJ_LABEL[i]}` : `${nfmt(i, n.majority)} = ${MAJ_LABEL[i]}`, over ? " over" : "")
    + vl("now", n.now_n, `Now ${nfmt(i, n.now_n)}`);
  const ticks = `${brk ? `<span class="brk" style="left:${Math.round(0.115 * W)}px">⫽</span>` : ""}<span class="tk r" style="left:${W}px">${nfmt(i, hi)}</span>`;
  return `<div class="swarm" style="padding-bottom:6px"><div class="dw" style="height:${H}px">${dots}</div>${lines}<div class="axis">${ticks}</div></div>`;
}
function leadLine(n, i) {
  const target = n.now_n;
  if (!goldOn(n)) return `<div class="lead-line">Gold marks the closest guesses once the count reaches the lowest guess (${nfmt(i, lowGuess(n))}).</div>`;
  const real = (n.guesses || []).filter(g => !g.c), best = Math.min(...real.map(g => Math.abs(g.v - target)));
  const who = real.filter(g => Math.abs(g.v - target) === best), names = who.slice(0, 4).map(g => esc(g.n)).join(", ") + (who.length > 4 ? ` +${who.length - 4} more` : "");
  return `<div class="lead-line">${n.status === "final" ? "✓ Closest guess" : `Closest to the count right now (${nfmt(i, target)})`}: <b>${names}</b> · guessed ${nfmt(i, who[0].v)}</div>`;
}
function number(n, i) {
  const m = me(), mine = m ? m.extra.numbers[i] : null;
  return `<div class="race num">
    <div class="kick">${esc(plainBasis(n.basis))}</div>
    <div class="q">${esc(NUM_PLAIN[i])}</div>
    <div class="val">${esc(n.now)}<em>so far</em></div>
    ${swarm(n, i)}
    <div class="dkey"><span><i></i>a guess</span>${m ? `<span><i class="me"></i>you</span>` : ""}<span><i class="lead"></i>closest now</span><span><i class="crowd"></i>The Crowd</span><span>Tap a dot to see who</span></div>
    ${leadLine(n, i)}<div class="tap-line" id="tap-${i}"></div>
    <div class="poolrow"><span class="pool">Pool guessed <b>${esc(n.picks_range)}</b></span></div>
    ${mine ? (c => `<div class="meta"><span class="you ${c[0]}">You guessed ${esc(mine)}${c[1] ? " · " + c[1] : ""}</span></div>`)(closeness(i, mine, n)) : ""}</div>`;
}

// ---- bonus ----
const PROP_PLAIN = [
  ["Will Georgia's Senate race need a Dec. 1 runoff?", "If nobody gets over 50%, Georgia holds a second election on Dec. 1."],
  ["Will the AP declare who controls the House by 2 AM ET?", "AP is the news service that officially declares winners."],
  ["Which Senate seat switches parties first?", "The first state where the winner is from a different party than before."],
  ["Which Senate race ends up closest?", "Smallest gap between the top two, in percentage points. Final in a few days."],
];
function prop(p, i) {
  const m = me(), mine = m ? m.extra.props[i] : null, done = p.status === "decided", hit = done && mine && mine === p.answer;
  const lean = done ? "" : p.lean ? (mine === p.lean ? " · ▲ Looking good" : " · ▼ Not looking good") : " · Too early to tell";
  return `<div class="race hl ${done ? "is-called" : "is-count"}"><div class="kick">${done ? "✓ Decided" : "Not decided yet"}</div>
    <div class="head sm">${esc(PROP_PLAIN[i][0])}</div><div class="fine">${esc(PROP_PLAIN[i][1])}</div>
    <div class="sub now">${esc(p.now.replace("provisional all week", "not final for a few days").replace("— needs 50% + 1 to avoid it", "· needs over 50% to avoid a runoff").replace(/called/g, "decided").replace("Not yet decided", "Not decided yet").replace(" pts —", " percentage points —"))}</div>
    <div class="meta">${mine ? `<span class="you ${done ? (hit ? "ok" : "no") : "pend"}">You picked ${esc(mine)}${done ? (hit ? " · ✓ You got it" : " · ✗ Not this time") : lean}</span>` : ""}<span class="pool">Pool: ${esc(p.picks.replace("Most picked: ", "top pick ")).replace(/(\d+)/g, "<b>$1</b>")}</span></div></div>`;
}

const SECTIONS = [
  { id: "senate", tab: "Senate", ...pick(P.sections[0]), html: () => grouped(P.sections[0].races, r => race(r)) },
  { id: "upset", tab: "Upset Watch", ...pick(P.sections[1]), rule: "Races the favorite should win. The underdog pays 3 pts if they win; the favorite pays 1.", html: () => grouped(P.sections[1].races, r => race(r)) },
  { id: "governor", tab: "Governors", ...pick(P.sections[2]), html: () => grouped(P.sections[2].races, r => race(r)) + ((P.watch_gov || []).length ? `<div class="grp-l">Also watching · not scored <span>${P.watch_gov.length}</span></div>${P.watch_gov.map(r => race(r, { watch: true })).join("")}` : "") },
  { id: "numbers", tab: "Numbers", menu: P.numbers.menu, title: "The big numbers", rule: "Closest guess wins 3 pts · a tie for closest gets 3 pts each · scored once every race is decided", html: () => P.numbers.items.map(number).join("") },
  { id: "legislatures", tab: "Statehouses", menu: P.legislatures.menu, title: "Statehouses", rule: "Which party wins control of each state House and Senate · 1 pt each", html: () => P.legislatures.chambers.map(chamber).join("") },
  { id: "bonus", tab: "Bonus", menu: P.props.menu, title: "Bonus round", rule: P.props.rule, html: () => P.props.items.map(prop).join("") },
  { id: "corner", tab: "Schools", menu: P.corner.menu, title: "School superintendents", rule: "The top schools official in each state · 1 pt each",
    html: () => P.corner.races.map(r => race(r, { title: `${r.state} (schools)` })).join("") },
];
function pick(s) { return { menu: s.menu, title: s.title, rule: s.rule }; }

// ---- slim "you" line, only for people who opened their personal link ----
function youBar() {
  const m = me(); if (!m) return "";
  return `<div class="youbar" data-who="${esc(m.name)}"><span class="lbl">You</span><b>${esc(m.name)}</b><span class="yb-r">${rankText(m)} · ${m.points} pts</span><span class="go">›</span></div>`;
}

// ---- standings: podium once 1st, 2nd and 3rd are each held; plain list before ----
const podiumReady = () => [1, 2, 3].every(k => { const n = RK.filter(e => e.rank === k).length; return n >= 1 && n <= 2; });
function podium() {
  const step = (rank, cls) => { const ppl = RK.filter(e => e.rank === rank);
    return `<div class="step ${cls}"><div class="block"><div class="place">${ord(rank)}</div><div class="pts">${ppl[0].points}<small> pts</small></div></div>
      <div class="who">${ppl.map(e => `<span data-who="${esc(e.name)}" class="${e.name === (me() || {}).name ? "is-me" : ""}">${esc(e.name)}</span>`).join("")}</div></div>`; };
  return `<div class="podium">${step(2, "s2")}${step(1, "s1")}${step(3, "s3")}</div>`;
}
function standings() {
  const show = podiumReady(), rest = show ? RK.filter(e => e.crowd || e.rank > 3) : RK;
  if (RK.every(e => !e.points)) return `${youBar()}<div class="pre">No races decided yet. Standings start with the first AP call after polls close at 6 PM ET.</div>
    <ol class="board">${[...RK].sort(byName).map(e => `<li data-who="${esc(e.name)}" class="${e.name === (me() || {}).name ? "is-me" : ""}${e.crowd ? " is-crowd" : ""}">
      <span class="rk">–</span><span class="who">${esc(e.name)}${e.crowd ? CTAG : ""}</span><span class="pts">0<small> pts</small></span><span class="go">›</span></li>`).join("")}</ol>
    <button class="sbs-link" data-grid="1">See everyone's picks side by side <span>›</span></button>`;
  return `${youBar()}${show ? podium() : ""}
    <ol class="board">${rest.map(e => `<li data-who="${esc(e.name)}" class="${e.name === (me() || {}).name ? "is-me" : ""} ${e.rank === 1 ? "is-top" : ""}${e.crowd ? " is-crowd" : ""}">
      <span class="rk">${e.crowd ? "–" : e.rank}${tied(e) ? "<small>tied</small>" : ""}</span><span class="who">${esc(e.name)}${e.name === (me() || {}).name ? ` <em>you</em>` : ""}${e.crowd ? CTAG : ""}</span>
      <span class="pts">${e.points}<small> pts</small></span><span class="go">›</span></li>`).join("")}</ol>
    <button class="sbs-link" data-grid="1">See everyone's picks side by side <span>›</span></button>`;
}

// Bonus questions and statehouses score as soon as they're decided, so they get real rows on the check.
function extras(e) {
  const x = e.extra || {}, row = (st, pk, res, cls, pts) => `<div class="rl ${cls}"><span class="st">${esc(st)}</span><span class="pk">${esc(pk || "—")}</span><span class="res">${res}</span><span class="pt">${pts}</span></div>`;
  const SHORTQ = ["GA runoff", "House by 2 AM", "First flip", "Closest race"];
  const bonus = (P.props.items || []).map((q, i) => { const pk = (x.props || [])[i];
    if (q.answer) { const hit = norm(pk) === norm(q.answer); return row(SHORTQ[i] || q.q, pk, hit ? "✓ WON" : `✗ ${esc(q.answer)}`, hit ? "ok" : "no", hit ? "+1" : "0"); }
    return row(SHORTQ[i] || q.q, pk, "· open", "pend", ""); }).join("");
  const chs = P.legislatures.chambers || [];
  const ch = chs.map((c, i) => { const won = c.d_won >= c.majority && c.majority > 0 ? "D" : c.r_won >= c.majority && c.majority > 0 ? "R" : null; const pk = (x.chambers || [])[i];
    return won ? row(c.name, pk, pk === won ? "✓ WON" : `✗ ${won}`, pk === won ? "ok" : "no", pk === won ? "+1" : "0") : ""; }).join("");
  const open = chs.filter(c => !(c.majority > 0 && (c.d_won >= c.majority || c.r_won >= c.majority))).length;
  return `<div class="cat">Bonus round</div>${bonus}
    <div class="cat">Statehouses</div>${ch}${open ? `<div class="rl pend"><span class="st" style="grid-column:1/4">${open} of ${chs.length} chambers still counting</span><span class="pt"></span></div>` : ""}
    <div class="cat">Big numbers</div>${(P.numbers.items || []).map((n, i) => { const v = (x.numbers || [])[i], SHORTN = ["House net", "Senate seats", "Dem governors"];
      if (n.status !== "final") return row(SHORTN[i], v, "· open", "pend", "");
      const d = y => Math.abs(parseFloat(y) - n.now_n), best = Math.min(...RK.filter(r => !r.crowd).map(r => d((r.extra.numbers || [])[i])).filter(z => !Number.isNaN(z)));
      const hit = !Number.isNaN(d(v)) && d(v) <= best; return row(SHORTN[i], v, hit ? "✓ CLOSEST" : "✗ not closest", hit ? "ok" : "no", hit ? "+3" : "0"); }).join("")}`;
}

// ---- receipt ----
function receipt(name) {
  const e = RK.find(x => x.name === name); let cur = "";
  const rows = ALL.map((r, i) => {
    const pk = e.picks[i]; let res, cls, pts = "";
    if (r.winner) { const hit = pk === r.winner; const val = hit ? (r.upset_pick ? (pk === r.upset_pick ? 3 : 1) : 1) : 0;
      res = hit ? "✓ WON" : `✗ ${last(r.winner)}`; cls = hit ? "ok" : "no"; pts = hit ? `+${val}` : "0"; }
    else if (r.leader) { const up = pk === r.leader; res = (up ? "▲ ahead" : "▼ behind") + (r.upset_pick && pk === r.upset_pick ? " ·3" : ""); cls = up ? "up" : "dn"; }
    else { res = "· not started"; cls = "pend"; }
    const head = r.sec !== cur ? `<div class="cat">${esc(r.sec)}</div>` : ""; cur = r.sec;
    return `${head}<div class="rl ${cls}"><span class="st">${esc(SHORT[r.state] || r.state)}</span><span class="pk">${esc(last(pk))}</span><span class="res">${res}</span><span class="pt">${pts}</span></div>`; }).join("");
  const won = ALL.filter((r, i) => r.winner && e.picks[i] === r.winner).length, lost = ALL.filter((r, i) => r.winner && e.picks[i] !== r.winner).length;
  return `<div class="receipt"><div class="rh">the 2026 Midterms Pool</div><div class="rc">${me() && me().name === name ? "Your check" : e.crowd ? "The pool's most popular pick in every race" : "Guest check"}</div><div class="rname">${esc(name)}</div>
    <div class="standing">${e.crowd ? "Not ranked" : `${rankText(e)} place`} · <b>${e.points} points</b></div>
    <div class="rc">Races: ${won} right · ${lost} wrong · the rest still being decided</div>
    <div class="cols"><span>Race</span><span>Your pick</span><span>Result</span><span>Pts</span></div><div class="legend">✓ you got it · ✗ wrong, winner shown · ▲ ahead · ▼ behind · ·3 = underdog pick worth 3</div>${rows}
    ${extras(e)}
    <div class="tot"><span>Total so far</span><span>${e.points}</span></div><div class="rc thanks">Thank you for dining with us.</div></div>`;
}

// ---- everyone's picks, side by side ----
function grid() {
  const groups = []; ALL.forEach(r => { const g = groups[groups.length - 1]; if (g && g.sec === r.sec) g.n++; else groups.push({ sec: r.sec, n: 1 }); });
  const gs = i => i === 0 || ALL[i].sec !== ALL[i - 1].sec ? " gs" : "";
  const colHead = (r, i) => { const w = r.winner || r.leader;
    return `<th class="${r.winner ? "is-called" : ""}${gs(i)}"><span class="ab">${ABBR[r.state] || r.state}</span><span class="wl">${w ? (r.winner ? "✓ " : "") + esc(last(w)) : "—"}</span></th>`; };
  const cell = (r, pk, i) => { const k = r.winner ? (pk === r.winner ? "ok" : "no") : r.leader ? (pk === r.leader ? "up" : "dn") : "pend";
    return `<td class="${k}${gs(i)}">${{ ok: "✓ ", no: "✗ ", up: "▲ ", dn: "▼ ", pend: "" }[k]}${esc(last(pk))}</td>`; };
  return `<div class="ghint">Swipe sideways for more races →</div><div class="gridwrap"><table class="pgrid">
    <thead><tr class="grp"><th class="nm"></th>${groups.map(g => `<th colspan="${g.n}" class="gs">${esc(g.sec)}</th>`).join("")}</tr>
    <tr><th class="nm">Player</th>${ALL.map(colHead).join("")}</tr></thead>
    <tbody>${RK.map(e => `<tr class="${e.name === (me() || {}).name ? "is-me" : ""}${e.crowd ? " is-crowd" : ""}"><th class="nm" data-who="${esc(e.name)}">${esc(e.name).replace(" (", "<br>(")}<small>${e.crowd ? "Most popular picks" : rankText(e)} · ${e.points} pts</small></th>${ALL.map((r, i) => cell(r, e.picks[i], i)).join("")}</tr>`).join("")}</tbody>
  </table></div>
  <div class="gkey"><span class="k ok">✓ right</span><span class="k no">✗ wrong</span><span class="k up">▲ ahead</span><span class="k dn">▼ behind</span><span class="k pend">not started</span> Tap a name to open their check.</div>`;
}

// ---- shell ----
const tracker = () => P.bop.map(b => `<button class="trk" data-jump="${b.target}"><span class="tl">${b.label}</span>
  <span class="tv"><span class="pc-D">D ${b.d}</span> <span class="pc-R">R ${b.r}</span></span><span class="tc">${b.called.replace("called", "decided")}</span></button>`).join("");

function render() {
  document.getElementById("t-stand").innerHTML = standings();
  const who = document.getElementById("who");
  if (who) { who.value = who.value || (me() || RK[0]).name; document.getElementById("rcpt").innerHTML = receipt(who.value); }
  const ev = document.getElementById("everyone"); if (ev && ev.open) document.getElementById("gridslot").innerHTML = grid();
  if (CUR) section(CUR);
}
let CUR = null;
const trackerHTML = () => tracker() + `<div class="key"><span class="pc-D">■ D = Democrats</span> <span class="pc-R">■ R = Republicans</span> <span class="pc-I">■ I = Independent</span></div>`;
function mount() {
  document.getElementById("tracker").innerHTML = trackerHTML();
  document.getElementById("subtabs").innerHTML = SECTIONS.map(s => `<button data-sec="${s.id}">${esc(s.tab)}</button>`).join("");
  document.getElementById("t-mine").innerHTML = `<label class="pickme">Whose check? <select id="who">${[...RK].sort(byName).map(e => `<option>${esc(e.name)}</option>`).join("")}</select></label><div id="rcpt"></div>
    <details class="everyone" id="everyone"><summary>See everyone's picks side by side</summary><div id="gridslot"></div></details>`;
  const who = document.getElementById("who");
  who.value = (me() || RK[0]).name;
  who.onchange = () => { document.getElementById("rcpt").innerHTML = receipt(who.value); };
  document.getElementById("everyone").addEventListener("toggle", e => { if (e.target.open) document.getElementById("gridslot").innerHTML = grid(); });
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tab],[data-sec],[data-jump],[data-who],[data-demo],[data-grid],[data-numv]"); if (!t || t.tagName === "SELECT") return;
    if (t.dataset.numv) { const [i, v] = t.dataset.numv.split("|").map(Number), n = P.numbers.items[i];
      const who = n.guesses.filter(g => g.v === v).map(g => g.c ? "<i>The Crowd</i>" : esc(g.n));
      document.getElementById("tap-" + i).innerHTML = `<b>Guessed ${nfmt(i, v)}:</b> ${who.join(", ")}`; return; }
    if (t.dataset.tab) tab(t.dataset.tab);
    if (t.dataset.sec) section(t.dataset.sec);
    if (t.dataset.jump) { tab("results"); section(t.dataset.jump); }
    if (t.dataset.who) { who.value = t.dataset.who; document.getElementById("rcpt").innerHTML = receipt(who.value); tab("mine"); }
    if (t.dataset.demo) demo(t.dataset.demo);
    if (t.dataset.grid) { tab("mine", false); const ev = document.getElementById("everyone"); ev.open = true;
      document.getElementById("gridslot").innerHTML = grid(); ev.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  const qs = new URLSearchParams(location.search);
  render();
  section(qs.get("sec") || "senate"); tab(qs.get("tab") || "stand", false);
  if (qs.get("demo")) demo(qs.get("demo"));
  if (qs.get("grid")) { document.getElementById("everyone").open = true; document.getElementById("gridslot").innerHTML = grid(); }
  if (qs.get("clean")) document.querySelectorAll(".sample,#demo").forEach(x => x.remove());
  // Live page (window.POOL_URL set): re-fetch the data every 60 s and redraw in place.
  let n = 60; const f = document.getElementById("fresh");
  const tick = () => { f.textContent = `Updated ${P.updated_et} · refreshes in ${n}s`; if (n-- <= 0) { n = 60; refresh(); } };
  tick(); setInterval(tick, 1000);
}
function tab(id, scroll = true) {
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
  document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "t-" + id);
  document.getElementById("subtabs").hidden = id !== "results";
  const d = document.getElementById("demo"); if (d) d.hidden = id !== "stand";
  if (scroll) window.scrollTo({ top: document.getElementById("tabs").offsetTop, behavior: "smooth" });
}
function section(id) {
  CUR = id; const s = SECTIONS.find(x => x.id === id);
  document.querySelectorAll("[data-sec]").forEach(b => { const on = b.dataset.sec === id; b.classList.toggle("on", on); if (on) b.scrollIntoView({ inline: "center", block: "nearest" }); });
  document.getElementById("t-results").innerHTML = `<h2><em>${esc(s.menu)}</em>${esc(s.title)}</h2><div class="rule">${esc(s.rule)}</div>${s.html()}`;
}
// Draft-only: preview the standings early (ties) vs. later in the night (podium).
function demo(k) {
  const lb = P.leaderboard.map(e => ({ ...e }));
  if (k === "later") { const bump = [6, 4, 3, 2, 2, 1, 1]; lb.forEach((e, i) => e.points += bump[i] || 0); lb.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)); }
  RK = withRanks(lb); render();
  document.querySelectorAll("[data-demo]").forEach(b => b.classList.toggle("on", b.dataset.demo === k));
}
async function refresh() {
  if (!window.POOL_URL) return;
  try {
    const d = await (await fetch(`${window.POOL_URL}?t=${Date.now()}`, { cache: "no-store" })).json();
    P = d; RK = withRanks(P.leaderboard); ALL = buildAll();
    document.getElementById("tracker").innerHTML = trackerHTML();
    const open = document.getElementById("everyone")?.open;
    render(); if (open) document.getElementById("gridslot").innerHTML = grid();
  } catch (e) { /* keep showing the last good data */ }
}
mount();
