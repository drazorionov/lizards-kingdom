import forestRoute from "./forest-route.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Game } from "../src/engine.js";
import { sanitizeProgress, overlaps } from "../src/world.js";
import { MOTHER_MOVES } from "../src/forest-boss.js";
const routes = JSON.parse(
  readFileSync(new URL("./routes.json", import.meta.url)),
);
globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function setup(hero = 0, mode = "gentle") {
  const g = new Game(
    { focus() {} },
    {},
    { viewWidth: 1100, prepare() {} },
    { toast() {}, sound() {}, save() {}, hud() {}, complete() {}, pause() {} },
  );
  g.start(0, sanitizeProgress({ hero, mode }));
  return g;
}
const tick = (g, n = 1) => {
  for (let i = 0; i < n; i++) g.step(1 / 60);
};
function replay(g) {
  tick(g, 30);
  for (const index of (g.player.hero === 1 && forestRoute.urmasa) ||
    forestRoute.route) {
    const a = forestRoute.actions[index];
    g.release("left");
    g.release("right");
    if (a.dir) g.press(a.dir < 0 ? "left" : "right");
    if (a.jump === "press") {
      g.release("jump");
      g.press("jump");
    }
    g.press("attack");
    tick(g, routes.framesPerAction);
  }
  g.clearInput();
}
test("both heroes traverse the forest, discover both routes and break the secret entrance", () => {
  for (const hero of [0, 1]) {
    const g = setup(hero);
    replay(g);
    assert.ok(
      g.world.tokens
        .filter((t) => [0, 2, 3].includes(t.id))
        .every((t) => t.collected),
    );
    for (const id of [
      "fields",
      "roots",
      "undercroft",
      "shaft",
      "secret",
      "hearth",
      "canopy",
      "old-heart",
    ])
      assert.ok(g.world.discovered.has(id), id);
    assert.ok(!g.world.platforms.some((s) => s.secret && s.breakable));
    assert.equal(g.checkpointUsed, true);
    assert.ok(g.player.health > 0);
  }
});
test("a lower-tunnel ceiling blocks a jump and checkpoint restores the correct floor", () => {
  const g = setup();
  g.player.x = 1600;
  g.player.y = 1141;
  g.player.vy = -550;
  tick(g);
  assert.equal(g.player.y, 1140);
  assert.equal(g.player.vy, 0);
  g.checkpointUsed = true;
  g.player.y = g.world.height + 100;
  tick(g);
  assert.equal(g.player.x, 2240);
  assert.equal(g.player.y, 946);
  tick(g, 30);
  assert.equal(g.player.y + g.player.h, 1050);
  assert.ok(!g.world.platforms.some((s) => s.solid && overlaps(g.player, s)));
});
test("root shortcut opens only after an attack and stays open through a fall", () => {
  const g = setup();
  const seal = g.world.platforms.find((s) => s.shortcut);
  g.player.x = seal.x - 40;
  g.player.y = 1330;
  tick(g);
  assert.ok(g.world.platforms.includes(seal));
  g.press("attack");
  tick(g);
  assert.ok(!g.world.platforms.includes(seal));
  g.player.y = g.world.height + 100;
  tick(g);
  assert.ok(!g.world.platforms.includes(seal));
});
test("Mother cycles four different telegraphed attacks, moves underground and exposes recovery frames", () => {
  const g = setup();
  g.player.x = 4350 + g.world.arenaOffset;
  g.player.y = 446;
  g.player.invulnerable = 100;
  const warned = new Set(),
    strikes = new Set(),
    poses = new Set();
  let moved = false,
    fan = false,
    wave = false;
  for (let i = 0; i < 1600; i++) {
    tick(g);
    const b = g.world.boss;
    if (b.state === "windup") {
      warned.add(b.move);
      if (b.move === "roots")
        assert.ok(g.world.hazards.every((a) => a.delay >= -1 / 60));
    }
    if (b.state === "strike") {
      assert.ok(warned.has(b.move));
      strikes.add(b.move);
    }
    if (b.pose != null) poses.add(b.pose);
    if (b.x !== 4020 + g.world.arenaOffset) moved = true;
    if (g.world.projectiles.some((a) => a.kind === "spore")) fan = true;
    if (g.world.projectiles.some((a) => a.kind === "wave")) wave = true;
    assert.ok(g.world.projectiles.length <= 24);
    assert.ok(g.world.hazards.length <= 16);
  }
  assert.deepEqual([...strikes], MOTHER_MOVES);
  assert.ok(moved && fan && wave);
  for (const pose of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    assert.ok(poses.has(pose), "pose " + pose);
});
test("half-health awakening has four poses and increases root pattern without removing warnings", () => {
  const g = setup();
  g.player.x = 3650 + g.world.arenaOffset;
  g.player.y = 446;
  g.player.invulnerable = 100;
  g.world.boss.hp = 12;
  const poses = new Set();
  let warning = 0;
  for (let i = 0; i < 600; i++) {
    tick(g);
    const b = g.world.boss;
    if (b.state === "awaken") poses.add(b.pose);
    if (b.state === "windup" && b.move === "roots")
      warning = Math.max(warning, g.world.hazards.length);
  }
  assert.deepEqual(
    [...poses].filter((p) => p >= 16 && p <= 19),
    [16, 17, 18, 19],
  );
  assert.equal(warning, 3);
  assert.equal(g.world.boss.enraged, true);
});
test("both heroes can defeat the pilot boss in both difficulty modes without losing a life", () => {
  for (const hero of [0, 1])
    for (const mode of ["gentle", "adventure"]) {
      const g = setup(hero, mode);
      g.rematchMother();
      let respawned = false;
      g.press("attack");
      for (let i = 0; i < 2400 && !g.world.boss.dead; i++) {
        const b = g.world.boss,
          p = g.player;
        g.release("left");
        g.release("right");
        const target = b.x - 65;
        if (p.x < target - 5) g.press("right");
        else if (p.x > target + 5) g.press("left");
        if (p.grounded && b.phase === 1 && b.timer < 0.3) g.press("jump");
        if (p.vy > 0) g.release("jump");
        tick(g);
        if (p.x < 3400 + g.world.arenaOffset) {
          respawned = true;
          break;
        }
      }
      assert.equal(respawned, false, `${hero}/${mode}: no respawn`);
      assert.equal(
        g.world.boss.dead,
        true,
        `${hero}/${mode}: guardian defeated`,
      );
      assert.equal(g.world.hazards.length, 0);
      assert.equal(g.world.projectiles.length, 0);
    }
});
test("rematch preserves earned progression; fatal root damage clears hazards and resets the encounter", () => {
  const g = setup();
  g.progress.cleared = [0];
  g.progress.defeated = [0];
  g.world.tokens.forEach((t) => (t.collected = true));
  g.rematchMother();
  assert.deepEqual(g.progress.cleared, [0]);
  assert.ok(g.world.tokens.every((t) => t.collected));
  g.player.health = 1;
  g.player.invulnerable = 0;
  g.world.hazards.push({
    x: g.player.x,
    y: 400,
    w: 100,
    h: 100,
    delay: 0,
    life: 1,
    total: 1,
  });
  tick(g);
  assert.equal(g.world.hazards.length, 0);
  assert.equal(g.world.boss.active, false);
  assert.equal(g.world.boss.hp, g.world.boss.maxHp);
  assert.equal(g.player.x, 110);
});

test("Mother renders her new hit and defeat poses on a fixed foot anchor", async () => {
  const { drawMother } = await import("../src/forest-renderer.js");
  const g = setup(),
    calls = [],
    renderer = {
      assets: { "forest-mother-attacks-atlas": {} },
      ctx: {
        save() {},
        restore() {},
        translate() {},
        scale() {},
        drawImage(...args) {
          calls.push(args);
        },
      },
    };
  for (const [hit, dead, deathTime] of [
    [0.17, false, 0],
    [0.05, false, 0],
    [0, true, 0.1],
    [0, true, 0.5],
  ]) {
    Object.assign(g.world.boss, { hit, dead, deathTime, pose: null });
    assert.equal(drawMother(renderer, g), true);
  }
  assert.deepEqual(
    calls.map((a) => (a[2] / 320) * 4 + a[1] / 320),
    [20, 21, 22, 23],
  );
  assert.ok(calls.every((a) => a[6] === (-235 * 304) / 320));
});
