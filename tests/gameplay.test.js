import { readFileSync } from "node:fs";
const routes = JSON.parse(
  readFileSync(new URL("./routes.json", import.meta.url)),
);
import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine.js";
import { sanitizeProgress } from "../src/world.js";
// Headless deterministic simulation uses the same production input and 60 Hz physics.
globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function setup(region = 0) {
  const messages = [];
  const completed = [];
  const renderer = { viewWidth: 1100, prepare() {} };
  const game = new Game({ focus() {} }, {}, renderer, {
    toast: (m) => messages.push(m),
    pause() {},
    sound() {},
    save() {},
    hud() {},
    complete: (r) => completed.push(r),
  });
  game.start(region, sanitizeProgress({ region }));
  return { game, messages, completed };
}
function ticks(g, n) {
  for (let i = 0; i < n; i++) g.step(1 / 60);
}
function walk(g, x) {
  g.clearInput();
  g.press(x > g.player.x ? "right" : "left");
  let i = 0;
  while (Math.abs(g.player.x - x) > 5 && !g.finished && i++ < 600)
    g.step(1 / 60);
  g.clearInput();
  assert.ok(i < 600, "walk reaches " + x);
}
for (let region = 0; region < 6; region++)
  test(`chapter ${region + 1} is traversable using movement, double jumps and attacks`, () => {
    const { game: g, completed } = setup(region);
    ticks(g, 30);
    // Replay legal keyboard actions against the real production simulation.
    // Fixtures cover each authored route, including gaps and wall-jump shafts.
    for (const index of routes.regions[region]) {
      const action = routes.actions[index];
      g.release("left");
      g.release("right");
      if (action.dir) g.press(action.dir < 0 ? "left" : "right");
      if (action.jump === "press") {
        g.release("jump");
        g.press("jump");
      }
      g.press("attack");
      ticks(g, routes.framesPerAction);
    }
    assert.ok(
      g.world.tokens.slice(0, 4).every((t) => t.collected),
      "all four exploration tokens",
    );
    g.clearInput();
    g.press("attack");
    for (let i = 0; i < 1200 && !g.world.boss.dead; i++) {
      if (
        g.world.boss.phase === 1 &&
        g.world.boss.timer < 0.3 &&
        g.player.grounded
      )
        g.press("jump");
      if (g.player.vy > 0) g.release("jump");
      if (g.player.x < 3940) g.press("right");
      else g.release("right");
      g.step(1 / 60);
    }
    g.clearInput();
    assert.equal(
      g.world.boss.dead,
      true,
      `guardian defeat: x=${g.player.x}, y=${g.player.y}, hp=${g.world.boss.hp}, health=${g.player.health}`,
    );
    walk(g, 4190);
    ticks(g, 10);
    assert.equal(g.world.tokens[4].collected, true, "guarded token");
    walk(g, 4380);
    assert.deepEqual(completed, [region]);
    assert.deepEqual(g.progress.cleared, [region]);
  });
test("falling preserves tokens and respawns at an activated checkpoint", () => {
  const { game: g } = setup();
  g.checkpointUsed = true;
  g.world.tokens[0].collected = true;
  g.player.y = 700;
  ticks(g, 1);
  assert.equal(g.player.x, 2240);
  assert.equal(g.world.tokens[0].collected, true);
  assert.equal(g.player.health, 6);
});
test("clearing a boss alone does not unlock a chapter; defeat persists separately", () => {
  const p = sanitizeProgress({ defeated: [0], cleared: [] });
  const { game: g } = setup();
  g.start(0, p);
  assert.equal(g.world.boss.dead, true);
  assert.equal(g.progress.cleared.length, 0);
});
test("each boss telegraphs before releasing a damaging wave", () => {
  for (let r = 0; r < 6; r++) {
    const { game: g } = setup(r);
    g.player.x = 3650;
    ticks(g, 1);
    assert.equal(g.world.boss.active, true);
    assert.equal(g.world.projectiles.length, 0);
    ticks(g, 128);
    assert.equal(g.world.boss.phase, 1);
    assert.equal(g.world.projectiles.length, 0);
    ticks(g, 62);
    assert.ok(g.world.projectiles.length > 0);
  }
});
test("wall slide and alternating wall kicks climb the shaft using either hero", () => {
  for (const hero of [0, 1]) {
    const { game: g } = setup(0);
    g.player.hero = hero;
    const shaft = g.world.shaft;
    g.player.x = shaft.x;
    g.player.y = 446;
    g.player.invulnerable = 10;
    g.press("right");
    g.press("jump");
    const contacts = new Set();
    let kicks = 0;
    for (let i = 0; i < 240; i++) {
      if (g.player.wall) {
        contacts.add(g.player.wall);
        g.release("jump");
        g.press("jump");
        g.release("left");
        g.release("right");
        g.press(g.player.wall > 0 ? "left" : "right");
        kicks++;
      }
      g.step(1 / 60);
      if (g.player.y + g.player.h < shaft.top + 30) break;
    }
    assert.ok(kicks >= 2);
    assert.equal(contacts.size, 2, "touches both walls");
    assert.ok(g.player.y + g.player.h < shaft.top + 30, "climbs above shaft");
  }
});
test("Quirel sweeps both staff ends; Urmasa attacks forward", () => {
  for (const hero of [0, 1]) {
    const { game: g } = setup();
    g.player.hero = hero;
    g.player.x = 600;
    g.player.y = 446;
    g.player.dir = 1;
    g.world.enemies = [
      {
        key: "mushroom-stomper",
        behavior: "walker",
        x: 565,
        y: 460,
        baseY: 460,
        w: 20,
        h: 40,
        min: 565,
        max: 565,
        hp: 3,
        dir: 1,
        hit: 0,
        state: "idle",
        timer: 5,
        id: 0,
      },
    ];
    g.press("attack");
    ticks(g, 1);
    assert.equal(g.world.enemies[0].hp, hero === 0 ? 2 : 3);
  }
});
test("a fatal projectile clears the volley without breaking the simulation", () => {
  const { game: g } = setup();
  g.player.x = 3500;
  g.player.y = 446;
  g.player.health = 1;
  g.player.invulnerable = 0;
  g.world.projectiles = [0, 1].map(() => ({
    x: 3500,
    y: 450,
    w: 24,
    h: 24,
    vx: 0,
    life: 2,
  }));
  assert.doesNotThrow(() => ticks(g, 1));
  assert.equal(g.world.projectiles.length, 0);
  assert.equal(g.player.x, 110);
});
