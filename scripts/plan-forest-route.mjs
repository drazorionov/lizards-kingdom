// Offline route fixture authoring: search legal inputs through the production
// Game simulation. No teleport, noclip or alternate movement model is used.
import { Game } from "../src/engine.js";
import { sanitizeProgress } from "../src/world.js";
import { readFileSync, writeFileSync } from "node:fs";
globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const g = new Game(
  { focus() {} },
  {},
  { viewWidth: 1100, prepare() {} },
  { toast() {}, sound() {}, save() {}, hud() {}, pause() {}, complete() {} },
);
const returning = process.argv.includes("--return");
const survey = process.argv.includes("--survey");
const expanded = process.argv.includes("--expanded") || survey;
const hero = process.argv.includes("--urmasa") ? 1 : 0;
g.start(0, sanitizeProgress({ checkpoint: returning, hero }));
const solids = g.world.platforms,
  seals = solids.filter((s) => s.breakable);
if (!expanded || survey) {
  g.world.enemies = [];
  g.world.tokens = [];
  g.world.secrets = [];
  g.world.springs = [];
}
g.world.boss.dead = true;
if (!expanded || survey) g.player.invulnerable = 100000;
for (let i = 0; i < 30; i++) g.step(1 / 60);
const actions = [-1, 0, 1].flatMap((dir) => [
  { dir, jump: "hold" },
  { dir, jump: "press" },
]);
const goals = survey
  ? [
      [4100, 446],
      [4650, 2180],
      [4400, 2190],
      [3880, 2050],
      [3370, 2180],
      [2800, 2060],
      [2300, 2180],
      [1800, 2060],
      [1200, 2180],
      [920, 1900],
      [1070, 1750],
      [1500, 1800],
      [2020, 1800],
      [2900, 1810],
      [3500, 1810],
      [4200, 1800],
      [4200, 1540],
      [4650, 2000],
      [5480, 2050],
      [6300, 2180],
      [7000, 2010],
      [7600, 2190],
      [8400, 2050],
      [8600, 1850],
      [8660, 1720],
      [8600, 1590],
      [8660, 1460],
      [8600, 1330],
      [8660, 1200],
      [8550, 1090],
      [8350, 960],
      [7800, 1080],
      [7860, 950],
      [7800, 820],
      [7860, 690],
      [7800, 560],
      [7850, 446],
      [8200, 446],
      [7850, 446],
      [7500, 370],
      [7250, 350],
      [7000, 500],
      [6750, 540],
      [6450, 480],
      [6200, 350],
      [5910, 220],
      [5610, 390],
      [5300, 480],
    ]
  : expanded
    ? [
        [4100, 446],
        [4810, 446],
        [5100, 480],
        [5340, 1200],
        [5650, 1340],
        [6030, 1340],
        [6200, 2180],
        [6350, 2173],
        [6790, 2050],
        [7210, 2000],
        [7270, 1860],
        [7210, 1730],
        [7270, 1600],
        [7210, 1470],
        [7270, 1340],
        [7300, 1250],
        [7010, 1240],
        [7010, 1240],
        [7070, 1100],
        [7000, 970],
        [7070, 840],
        [7000, 710],
        [7070, 580],
        [7250, 350],
        [7500, 370],
        [7850, 446],
        [8130, 446],
      ]
    : returning
      ? [
          [2460, 1000],
          [2505, 1383],
          [1405, 1368],
          [1370, 1140],
          [1370, 990],
          [1050, 980],
          [815, 860],
          [955, 720],
          [815, 580],
          [730, 430],
          [505, 428],
        ]
      : [
          [505, 428],
          [730, 223],
          [1040, 315],
          [1410, 415],
          [1825, 365],
          [2240, 320],
          [2675, 298],
          [2240, 320],
          [1840, 700],
          [1840, 990],
          [1370, 1000],
          [1405, 1368],
          [1530, 1363],
          [2505, 1383],
          [2460, 1180],
          [2460, 950],
          [2240, 990],
          [2650, 720],
          [2870, 600],
          [3080, 470],
          [3370, 440],
          [3580, 446],
        ];
function snapshot() {
  return {
    p: { ...g.player, animation: { ...g.player.animation } },
    enemies: g.world.enemies.map((e) => ({ ...e })),
    projectiles: g.world.projectiles.map((e) => ({ ...e })),
    tokens: g.world.tokens.map((t) => ({ ...t })),
    secrets: g.world.secrets.map((t) => ({ ...t })),
    progress: structuredClone(g.progress),
    checkpoint: g.world.checkpoint,
    checkpointUsed: g.checkpointUsed,
    time: g.time,
    serial: g.attackSerial,
  };
}
function advance(state, index) {
  if (expanded && state.enemies) {
    g.world.enemies = state.enemies.map((e) => ({ ...e }));
    g.world.projectiles = state.projectiles.map((e) => ({ ...e }));
    g.world.tokens = state.tokens.map((t) => ({ ...t }));
    g.world.secrets = state.secrets.map((t) => ({ ...t }));
    g.progress = structuredClone(state.progress);
    g.world.checkpoint = state.checkpoint;
    g.checkpointUsed = state.checkpointUsed;
    g.time = state.time;
    g.attackSerial = state.serial;
  }

  const a = actions[index];
  g.player = { ...state.p, animation: { ...state.p.animation } };
  g.progress.broken[0] = seals
    .filter((_, i) => state.mask & (1 << i))
    .map((s) => s.id);
  g.world.platforms = solids
    .filter((s) => !s.breakable || !g.progress.broken[0].includes(s.id))
    .map((s) => (s.breakable ? { ...s, broken: false } : s));
  g.particles = [];
  g.wallDebris = [];
  g.finished = false;
  g.paused = false;
  g.keys = new Set([
    "attack",
    ...(a.dir ? [a.dir < 0 ? "left" : "right"] : []),
  ]);
  g.pressed = new Set();
  if (a.jump === "press") {
    g.release("jump");
    g.press("jump");
  }
  for (let i = 0; i < 10; i++) g.step(1 / 60);
  const mask = seals.reduce(
    (m, s, i) => (g.progress.broken[0].includes(s.id) ? m | (1 << i) : m),
    0,
  );
  return {
    ...(expanded
      ? snapshot()
      : { p: { ...g.player, animation: { ...g.player.animation } } }),
    mask,
  };
}
class Queue {
  a = [];
  push(n) {
    let i = this.a.length;
    this.a.push(n);
    while (i) {
      let p = (i - 1) >> 1;
      if (this.a[p].score <= n.score) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = n;
  }
  pop() {
    const out = this.a[0],
      n = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1].score < this.a[c].score) c++;
        if (this.a[c].score >= n.score) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = n;
    }
    return out;
  }
}
const key = (s) =>
  [
    Math.round(s.p.x / 10),
    Math.round(s.p.y / 10),
    Math.round(s.p.vy / 100),
    s.p.jumps,
    s.p.wall,
    s.p.wallKick > 0 ? 1 : 0,
    s.mask,
    expanded ? s.p.health : 0,
  ].join(",");
function plan(state, [x, y]) {
  const h = (s) => Math.abs(s.p.x - x) / 45 + Math.abs(s.p.y - y) / 38;
  const q = new Queue(),
    visited = new Map();
  q.push({ s: state, cost: 0, score: h(state), parent: null });
  let iterations = 0,
    best;
  while (q.a.length && iterations++ < 45000) {
    const n = q.pop(),
      p = n.s.p;
    if (!best || h(n.s) < h(best.s)) best = n;
    if (Math.abs(p.x - x) < 28 && Math.abs(p.y - y) < 35) {
      const path = [];
      let at = n;
      while (at.parent) {
        path.push(at.action);
        at = at.parent;
      }
      return { state: n.s, path: path.reverse(), iterations };
    }
    for (let i = 0; i < 6; i++) {
      const s = advance(n.s, i);
      if (
        s.p.y > g.world.height - 50 ||
        (!expanded && s.p.health < n.s.p.health) ||
        (expanded &&
          (Math.abs(s.p.x - n.s.p.x) > 110 ||
            Math.abs(s.p.y - n.s.p.y) > 200)) ||
        s.p.x < 40 ||
        s.p.x > g.world.width - 200
      )
        continue;
      const k = key(s),
        cost = n.cost + 1;
      if (visited.has(k) && visited.get(k) <= cost) continue;
      visited.set(k, cost);
      q.push({ s, cost, score: cost + h(s) * 2.1, parent: n, action: i });
    }
  }
  throw new Error(
    `No route to ${x},${y}; closest ${best?.s.p.x},${best?.s.p.y}; ${iterations} states`,
  );
}
let state = { ...(expanded ? snapshot() : { p: { ...g.player } }), mask: 0 };
const route = [];
if (expanded) {
  const first = JSON.parse(
    readFileSync(new URL("../tests/forest-route.json", import.meta.url)),
  );
  for (const i of first.route) {
    state = advance(state, i);
    route.push(i);
  }
  console.log("Original route reached", state.p.x, state.p.y);
}
for (const goal of goals) {
  const r = plan(state, goal);
  state = r.state;
  route.push(...r.path);
  console.log(
    goal.join(","),
    "actions",
    r.path.length,
    "searched",
    r.iterations,
    "at",
    state.p.x.toFixed(0),
    state.p.y.toFixed(0),
  );
}
const fixture = { actions, framesPerAction: 10, route, goals };
// Check Quirel's slower sweep against live enemy patrols as well as geometry.
// A brief safe wait at the refuge changes encounter timing without changing physics.
if (returning) {
  for (let wait = 0; wait <= 24; wait++) {
    const real = new Game(
      { focus() {} },
      {},
      { viewWidth: 1100, prepare() {} },
      {
        toast() {},
        sound() {},
        save() {},
        hud() {},
        pause() {},
        complete() {},
      },
    );
    real.start(0, sanitizeProgress({ hero: 0, checkpoint: true }));
    for (let i = 0; i < 30; i++) real.step(1 / 60);
    const inputs = [...Array(wait).fill(2), ...route];
    for (const index of inputs) {
      const a = actions[index];
      real.release("left");
      real.release("right");
      if (a.dir) real.press(a.dir < 0 ? "left" : "right");
      if (a.jump === "press") {
        real.release("jump");
        real.press("jump");
      }
      real.press("attack");
      for (let i = 0; i < 10; i++) real.step(1 / 60);
    }
    if (
      Math.abs(real.player.x - 505) < 35 &&
      Math.abs(real.player.y - 446) < 10
    ) {
      fixture.quirel = inputs;
      break;
    }
  }
  if (!fixture.quirel)
    throw new Error("Return route fails with live encounters");
}

writeFileSync(
  new URL(
    survey
      ? "../tests/forest-branches-route.json"
      : expanded
        ? hero
          ? "../tests/forest-expanded-urmasa-route.json"
          : "../tests/forest-expanded-route.json"
        : returning
          ? "../tests/forest-return-route.json"
          : "../tests/forest-route.json",
    import.meta.url,
  ),
  JSON.stringify(fixture, null, 2) + "\n",
);
console.log("Saved", route.length, "legal input actions.");
