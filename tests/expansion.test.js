import test from "node:test";
import assert from "node:assert/strict";
import { Game, clearSight } from "../src/engine.js";
import { sanitizeProgress, mergeProgress, createWorld } from "../src/world.js";
import { growth, TOKEN_TYPES, SERVICES } from "../src/progression.js";
import { RESIDENTS, residentProgress } from "../src/town.js";
import { regionMapMarkup } from "../src/region-renderer.js";
globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function game(r = 0, p = {}) {
  const g = new Game(
    { focus() {} },
    {},
    { viewWidth: 1100, prepare() {} },
    { toast() {}, sound() {}, save() {}, hud() {}, pause() {}, complete() {} },
  );
  g.start(r, sanitizeProgress({ ...p, region: r }));
  return g;
}
const tick = (g, n = 1) => {
  for (let i = 0; i < n; i++) g.step(1 / 60);
};
test("old saves migrate without losing any tokens, heroes or completed regions", () => {
  const old = {
    version: 1,
    hero: 1,
    region: 4,
    tokens: { 0: [0, 1, 2, 3, 4], 4: [1, 3] },
    cleared: [0, 1, 2],
    defeated: [0, 1, 2, 3],
    checkpoint: true,
  };
  const p = sanitizeProgress(old);
  assert.equal(p.version, 2);
  assert.deepEqual(p.tokens[4], [1, 3]);
  assert.equal(p.hero, 1);
  assert.deepEqual(p.secrets[4], []);
  assert.deepEqual(p.services, []);
  assert.ok(p.checkpoint);
});
test("cloud reconciliation unions discoveries, broken walls and services with strict bounds", () => {
  const a = {
    secrets: { 0: [0, 1, 8] },
    revealed: { 0: [1] },
    discovered: { 0: ["fields", "unknown"] },
    broken: { 0: [20, -1] },
    services: ["forge", "admin"],
    quests: ["child"],
    visited: [4],
    updatedAt: 20,
  };
  const b = {
    secrets: { 0: [2] },
    revealed: { 0: [2] },
    discovered: { 0: ["roots"] },
    broken: { 0: [31] },
    services: ["compass"],
    quests: ["dar"],
    visited: [5],
    updatedAt: 10,
  };
  const p = mergeProgress(a, b);
  assert.deepEqual(p.secrets[0], [0, 1, 2]);
  assert.deepEqual(p.revealed[0], [1, 2]);
  assert.deepEqual(p.discovered[0], ["fields", "roots"]);
  assert.deepEqual(p.broken[0], [20, 31]);
  assert.deepEqual(p.services, ["forge", "compass"]);
  assert.deepEqual(p.visited, [4, 5]);
});
test("all thirty tokens and thirty secrets reach level ten, derived from IDs", () => {
  const p = sanitizeProgress({
    tokens: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i, [0, 1, 2, 3, 4]]),
    ),
    secrets: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i, [0, 1, 2, 3, 4]]),
    ),
  });
  assert.deepEqual(
    [growth(p).level, growth(p).flies, growth(p).secrets],
    [10, 30, 30],
  );
  assert.equal(growth(sanitizeProgress({ level: 99 })).level, 1);
  assert.equal(TOKEN_TYPES.length, 5);
  assert.equal(growth(p).wallJump, -640);
});
test("twelve residents have unique identities and six services gate on real discoveries", () => {
  assert.equal(RESIDENTS.length, 12);
  assert.equal(new Set(RESIDENTS.map((n) => n.name)).size, 12);
  assert.equal(
    new Set(RESIDENTS.map((n) => n.service).filter(Boolean)).size,
    SERVICES.length,
  );
  const p = sanitizeProgress({ tokens: { 0: [2], 1: [2] }, defeated: [0, 1] });
  assert.ok(residentProgress(RESIDENTS[0], p).ready);
  assert.ok(residentProgress(RESIDENTS[10], p).ready);
  assert.equal(residentProgress(RESIDENTS[6], p).ready, false);
});
test("town walking and conversations do not overwrite the current region save", () => {
  const p = sanitizeProgress({
    region: 3,
    tokens: { 3: [1, 2] },
    checkpoint: true,
  });
  const g = game(3, p);
  let spoke;
  g.cb.interact = (n) => {
    spoke = n.id;
  };
  g.startTown(p);
  g.player.x = 380;
  tick(g, 40);
  g.press("attack");
  tick(g);
  assert.equal(spoke, "rong");
  assert.ok(g.paused);
  g.persist();
  assert.deepEqual(p.tokens[3], [1, 2]);
  assert.ok(p.checkpoint);
});
test("hidden items and secrets cannot be seen or collected through solid walls", () => {
  const g = game();
  g.world.enemies = [];
  const t = g.world.tokens[3];
  g.player.x = 2350;
  g.player.y = 300;
  t.x = 2430;
  t.y = 325;
  tick(g);
  assert.equal(t.revealed, false);
  assert.equal(t.collected, false);
  assert.equal(clearSight(g.player, t, g.world.platforms), false);
  assert.ok(!regionMapMarkup(g).includes('cx="2430"'));
  g.press("attack");
  tick(g, 20);
  g.player.x = 2415;
  tick(g);
  assert.equal(t.collected, true);
});
test("broken secret barriers and discoveries survive world recreation", () => {
  const g = game();
  g.world.enemies = [];
  g.player.x = 2330;
  g.player.y = 280;
  g.press("attack");
  tick(g);
  const barrier = g.progress.broken[0];
  assert.ok(barrier.length);
  const restored = createWorld(0, sanitizeProgress(g.progress));
  assert.ok(!restored.platforms.some((s) => barrier.includes(s.id)));
});
test("cursed tokens require their nearby guardian to be defeated", () => {
  const g = game();
  g.player.x = 2650;
  g.player.y = 310;
  const t = g.world.tokens[3];
  g.world.enemies = [
    { ...g.world.enemies[0], x: 2740, y: 340, min: 2740, max: 2740, hp: 2 },
  ];
  tick(g);
  assert.equal(t.collected, false);
  g.world.enemies[0].hp = 0;
  tick(g);
  assert.ok(t.collected);
});
test("bell platforms fall after a warning and return instead of permanently blocking progress", () => {
  const g = game(3);
  g.world.enemies = [];
  const s = g.world.platforms.find((s) => s.crumble);
  g.player.x = s.x + 20;
  g.player.y = s.y - 54;
  tick(g, 52);
  assert.ok(s.absent);
  g.player.x = 110;
  g.player.y = g.world.spawn.y;
  tick(g, 190);
  assert.equal(s.absent, false);
});
test("town upgrades affect health, damage, map clues and one shield per encounter", () => {
  const g = game(2, {
    services: ["forge", "medicine", "compass", "mercenary"],
  });
  assert.equal(g.maxHealth(), 8);
  assert.equal(g.attackPower(), 2);
  assert.ok(regionMapMarkup(g).includes("Пещера за водопадом"));
  g.world.boss.active = true;
  g.player.invulnerable = 0;
  g.damage();
  assert.equal(g.player.health, 8);
  g.player.invulnerable = 0;
  g.damage();
  assert.equal(g.player.health, 7);
});
test("all expanded maps keep secret names concealed until cartographer or discovery", () => {
  for (let r = 0; r < 6; r++) {
    const g = game(r);
    const markup = regionMapMarkup(g);
    assert.equal((markup.match(/Неизвестная тайна/g) || []).length, 5);
    assert.ok(!markup.includes('cx="4195"'));
    assert.equal(g.world.secrets.length, 5);
  }
});
import { readFileSync } from "node:fs";
import { regionBossFrame } from "../src/region-boss.js";
const secretRoutes = JSON.parse(
  readFileSync(new URL("./secret-routes.json", import.meta.url)),
);
for (let r = 0; r < 6; r++)
  test(`all five secrets in region ${r + 1} are reachable with legal keyboard actions`, () => {
    const g = game(r);
    tick(g, 30);
    for (const index of secretRoutes.regions[r]) {
      const a = secretRoutes.actions[index];
      g.release("left");
      g.release("right");
      if (a.dir) g.press(a.dir < 0 ? "left" : "right");
      if (a.jump === "press") {
        g.release("jump");
        g.press("jump");
      }
      g.press("attack");
      tick(g, 10);
    }
    assert.deepEqual(
      g.world.secrets.filter((s) => s.found).map((s) => s.id),
      [0, 1, 2, 3, 4],
    );
    assert.deepEqual(sanitizeProgress(g.progress).secrets[r], [0, 1, 2, 3, 4]);
  });
test("all 24 boss poses are reachable through attack, awakening, hit and defeat timelines", () => {
  const frames = new Set();
  for (let moveIndex = 0; moveIndex < 4; moveIndex++) {
    for (const timer of [1, 0.2])
      frames.add(regionBossFrame({ state: "windup", moveIndex, timer }));
    for (const elapsed of [0.1, 0.6])
      frames.add(regionBossFrame({ state: "strike", moveIndex, elapsed }));
  }
  for (const elapsed of [0, 0.5, 1, 1.5])
    frames.add(regionBossFrame({ state: "awaken", elapsed }));
  for (const hit of [0.15, 0.04]) frames.add(regionBossFrame({ hit }));
  for (const deathTime of [0.1, 0.6])
    frames.add(regionBossFrame({ dead: true, deathTime }));
  assert.deepEqual(
    [...frames].sort((a, b) => a - b),
    Array.from({ length: 24 }, (_, i) => i),
  );
});
