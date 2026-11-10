/* ===== Data: edit these lists to change the timetable, plans and class types ===== */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TYPES = ["Strength", "Cardio", "Mobility"];
const BASE = [ /* time, name, type, coach, capacity */
  ["06:30", "Barbell Basics", "Strength", "Maya", 12],
  ["07:45", "Spin Intervals", "Cardio", "Jon", 14],
  ["08:30", "Core and Stretch", "Mobility", "Aiden", 16],
  ["12:15", "Express HIIT", "Cardio", "Priya", 16],
  ["17:30", "Power Lifting", "Strength", "Maya", 10],
  ["18:30", "Mobility Flow", "Mobility", "Aiden", 18],
  ["19:30", "Boxing Fit", "Cardio", "Jon", 14],
];
const PLANS = [
  { name: "Starter", m: 29, list: ["4 classes a month", "Book 3 days ahead", "Locker access"] },
  { name: "Unlimited", m: 59, pick: true, list: ["Unlimited classes", "Book 7 days ahead", "1 guest pass a month"] },
  { name: "Duo", m: 99, list: ["Unlimited for two people", "Book 7 days ahead", "Shared guest passes"] },
];

/* ===== Helpers ===== */
const $ = (s, r = document) => r.querySelector(s);
const qs = () => new URLSearchParams(location.search);
const TODAY = (new Date().getDay() + 6) % 7;
const store = {
  get() { try { return JSON.parse(localStorage.getItem("tempo-bookings")) || []; } catch { return []; } },
  set(v) { try { localStorage.setItem("tempo-bookings", JSON.stringify(v)); } catch {} },
};
const booked = new Set(store.get());

function classesFor(d) {
  return [0, 1, 2, 3].map((i) => {
    const [time, name, type, coach, cap] = BASE[(d * 2 + i) % BASE.length];
    const left = Math.max(0, cap - ((d * 5 + i * 7 + 3) % (cap + 2)));
    return { id: d + "-" + time, time, name, type, coach, left, cap };
  }).sort((a, b) => a.time.localeCompare(b.time));
}

const pips = (cap, on) => Array.from({ length: cap }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("");

function rowsHTML(d, type) {
  const list = classesFor(d).filter((c) => !type || c.type === type);
  if (!list.length) return `<li class="row empty">No ${type} classes on this day. Try another day.</li>`;
  return list.map((c) => {
    const mine = booked.has(c.id);
    const left = mine ? c.left - 1 : c.left;
    return `<li class="row"><div class="time">${c.time}</div>
      <div><div class="name">${c.name}</div><div class="sub">${c.type} with ${c.coach}</div><div class="pips" aria-hidden="true">${pips(c.cap, c.cap - left)}</div></div>
      <div class="act"><div class="left ${left <= 3 ? "low" : ""}">${c.left === 0 ? "No spots" : left + " spots left"}</div>
      <button type="button" class="book" data-id="${c.id}" aria-pressed="${mine}" ${c.left === 0 ? "disabled" : ""}>${mine ? "Booked" : c.left === 0 ? "Full" : "Book"}</button></div></li>`;
  }).join("");
}

function wireBooking(list, rerender) {
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".book");
    if (!b) return;
    booked.has(b.dataset.id) ? booked.delete(b.dataset.id) : booked.add(b.dataset.id);
    store.set([...booked]);
    rerender();
  });
}

/* ===== Menu and current page link ===== */
const here = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll("nav a").forEach((a) => a.getAttribute("href") === here && a.setAttribute("aria-current", "page"));
const menu = $(".menu");
menu.addEventListener("click", () => menu.setAttribute("aria-expanded", $("#nav").classList.toggle("open")));

/* ===== Heart-rate zones: the page warms up as you scroll ===== */
const ZONES = ["#0c1424", "#0b2a33", "#16332a", "#3a2210", "#4a1414"];
const zoneLabel = $("#zoneLabel");
function heat() {
  const p = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  const z = Math.min(4, Math.floor(p * 5));
  document.documentElement.style.setProperty("--bg", ZONES[z]);
  zoneLabel.textContent = `Zone ${z + 1} \u00b7 ${Math.round(96 + p * 88)} bpm`;
}
addEventListener("scroll", heat, { passive: true });
heat();

/* ===== Hero ring: one pip per spot in the next class ===== */
function drawRing() {
  const hm = new Date().toTimeString().slice(0, 5);
  let c = classesFor(TODAY).find((x) => x.time >= hm), when = "Today";
  if (!c) { c = classesFor((TODAY + 1) % 7)[0]; when = "Tomorrow"; }
  const on = c.cap - c.left;
  const pip = Array.from({ length: c.cap }, (_, i) => `<rect class="${i < on ? "on" : ""}" style="--i:${i}" x="-9" y="-166" width="18" height="36" rx="9" transform="translate(180 180) rotate(${(i / c.cap) * 360})"/>`).join("");
  $("#ring").innerHTML = pip + `<text class="s" x="180" y="138">Next up \u00b7 ${when}</text><text class="t" x="180" y="198">${c.time}</text><text class="n" x="180" y="230">${c.name}</text><text class="s" x="180" y="254">${c.left} of ${c.cap} spots left</text>`;
}

/* ===== Metronome: the ring ticks at a tempo you pick; the header heart follows ===== */
const TEMPOS = [60, 90, 120, 150];
let tempo = 2, tick = 0, timer;
function startBeat() {
  clearInterval(timer);
  const ms = 60000 / TEMPOS[tempo];
  document.documentElement.style.setProperty("--beatms", ms * 2 + "ms");
  $("#bpm").textContent = `${TEMPOS[tempo]} bpm \u00b7 tap to change tempo`;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => {
    const r = $("#ring").querySelectorAll("rect");
    r.forEach((x) => x.classList.remove("tick"));
    r[tick++ % r.length].classList.add("tick");
  }, ms);
}
function wireMetronome() {
  const b = document.createElement("button");
  b.type = "button"; b.className = "bpm"; b.id = "bpm";
  $("#ring").after(b);
  b.addEventListener("click", () => { tempo = (tempo + 1) % TEMPOS.length; startBeat(); });
  startBeat();
}

/* ===== Forms ===== */
function wireForm(form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll("[required]").forEach((el) => {
      let msg = "";
      if (!el.value.trim()) msg = "Fill in this field.";
      else if (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) msg = "Enter an email like name@example.com.";
      $("#" + el.id + "-err").textContent = msg;
      el.setAttribute("aria-invalid", !!msg);
      if (msg && ok) { el.focus(); ok = false; }
    });
    if (ok) {
      const name = form.elements.name.value.trim().replace(/[<>&]/g, "");
      form.outerHTML = `<div class="ok" role="status"><h2>Thanks, ${name}.</h2><p>We got your request and will reply within one working day to book your free first class.</p></div>`;
    }
  });
}

/* ===== Pages ===== */
const pages = {
  home() {
    drawRing();
    wireMetronome();
    const draw = () => ($("#today-rows").innerHTML = rowsHTML(TODAY));
    draw();
    wireBooking($("#today-rows"), draw);
  },

  classes() {
    let day = TODAY, type = TYPES.includes(qs().get("type")) ? qs().get("type") : "";
    const draw = () => {
      $("#days").innerHTML = DAYS.map((n, i) => `<button type="button" data-day="${i}" aria-pressed="${i === day}">${n}<small>${i === TODAY ? "Today" : "&nbsp;"}</small></button>`).join("");
      $("#chips").innerHTML = ["", ...TYPES].map((t) => `<button type="button" data-type="${t}" aria-pressed="${t === type}">${t || "All classes"}</button>`).join("");
      $("#rows").innerHTML = rowsHTML(day, type);
      const n = booked.size;
      $("#mine").textContent = n ? `You have booked ${n} ${n === 1 ? "class" : "classes"}.` : "You haven't booked any classes yet.";
    };
    $("#days").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { day = +b.dataset.day; draw(); } });
    $("#chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { type = b.dataset.type; draw(); } });
    wireBooking($("#rows"), draw);
    draw();
  },

  pricing() {
    let yearly = false;
    const draw = () => {
      $("#cards").innerHTML = PLANS.map((p) => `<article class="plan ${p.pick ? "pick" : ""}"><h3>${p.name}</h3>
        <p class="amount">$${yearly ? Math.round((p.m * 10) / 12) : p.m}<small> / month</small></p>
        <p class="note">${yearly ? "Billed yearly. 2 months free." : "Billed monthly. Cancel any time."}</p>
        <ul>${p.list.map((x) => `<li>${x}</li>`).join("")}</ul></article>`).join("");
    };
    $(".toggle").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      yearly = b.dataset.bill === "y";
      document.querySelectorAll(".toggle button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      draw();
    });
    draw();
  },

  coaches() {},
  contact() { wireForm($("form[data-form]")); },
};
pages[document.body.dataset.page]();
