// Offline route fixture authoring: search legal inputs through the production
// Game simulation. No teleport, noclip or alternate movement model is used.
import { Game } from "../src/engine.js";
import { sanitizeProgress } from "../src/world.js";
import { writeFileSync } from "node:fs";
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
const region = Number(process.argv[2] || 1);
const hero = Number(process.argv[3] || 0);
const expanded = true;
g.start(region, sanitizeProgress({ region, hero }));
const { buildLevel } = await import("../src/levels.js");
const level = buildLevel(region);
const solids = g.world.platforms,
  seals = solids.filter((s) => s.breakable);
g.world.boss.dead = true;
for (let i = 0; i < 30; i++) g.step(1 / 60);
const actions = [-1, 0, 1].flatMap((dir) => [
  { dir, jump: "hold" },
  { dir, jump: "press" },
]);
const goals = [];
let current = level.startNode;
function travel(to) {
  const queue = [[current, []]],
    seen = new Set([current]);
  let route;
  while (queue.length) {
    const [at, path] = queue.shift();
    if (at === to) {
      route = path;
      break;
    }
    for (const e of level.links) {
      const next = e.a === at ? e.b : e.b === at ? e.a : null;
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push([next, [...path, { edge: e, reverse: e.b === at, next }]]);
    }
  }
  if (!route) throw new Error("Disconnected graph");
  for (const { edge, reverse, next } of route) {
    const via = reverse ? [...edge.via].reverse() : edge.via;
    for (const p of [...via, level.nodes[next]]) goals.push([p.x, p.y]);
  }
  current = to;
}
for (const [i, node] of level.secretNodes.entries()) {
  travel(node);
  goals.push([level.secretPoints[i][0] - 15, level.nodes[node].y]);
}
for (const node of level.tokenNodes) {
  travel(node);
  goals.push([level.nodes[node].x - 15, level.nodes[node].y]);
}
travel(level.nodes.at(-1).id);
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
    crumble: solids.map((s) => [s.crumbleTime, s.absent, s.restore]),
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
    solids.forEach((s, i) => {
      [s.crumbleTime, s.absent, s.restore] = state.crumble[i];
    });
  }

  const a = actions[index];
  g.player = { ...state.p, animation: { ...state.p.animation } };
  g.progress.broken[region] = seals
    .filter((_, i) => state.mask & (1 << i))
    .map((s) => s.id);
  g.world.platforms = solids
    .filter((s) => !s.breakable || !g.progress.broken[region].includes(s.id))
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
    (m, s, i) => (g.progress.broken[region].includes(s.id) ? m | (1 << i) : m),
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
  while (q.a.length && iterations++ < 8000) {
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
writeFileSync(
  new URL(`../tests/region-${region}-hero-${hero}-route.json`, import.meta.url),
  JSON.stringify(fixture) + "\n",
);
console.log(
  "Saved",
  region,
  hero,
  route.length,
  "actions; tokens",
  state.tokens.map((t) => t.collected),
  "secrets",
  state.secrets.map((t) => t.found),
);
