import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Game } from "../src/engine.js";
import { createWorld, sanitizeProgress, overlaps } from "../src/world.js";

globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const ticks = (g, n = 1) => {
  for (let i = 0; i < n; i++) g.step(1 / 60);
};
function game(progress = {}) {
  const g = new Game(
    { focus() {} },
    {},
    { viewWidth: 1100, prepare() {} },
    { toast() {}, sound() {}, save() {}, hud() {}, pause() {}, complete() {} },
  );
  g.start(0, sanitizeProgress(progress));
  return g;
}
function replay(g, name) {
  const route = JSON.parse(readFileSync(new URL(name, import.meta.url)));
  ticks(g, 30);
  for (const index of route.route) {
    const a = route.actions[index];
    g.release("left");
    g.release("right");
    if (a.dir) g.press(a.dir < 0 ? "left" : "right");
    if (a.jump === "press") {
      g.release("jump");
      g.press("jump");
    }
    g.press("attack");
    ticks(g, route.framesPerAction);
    const p = g.player;
    assert.ok(
      !g.world.platforms.some(
        (s) =>
          s.solid &&
          overlaps({ x: p.x + 0.5, y: p.y + 0.5, w: p.w - 1, h: p.h - 1 }, s),
      ),
      "route stays outside solid terrain",
    );
  }
  return g.world.discovered;
}
test("forest has exactly triple the map area and 24 distinct rooms", () => {
  const w = createWorld(0);
  assert.equal(w.width * w.height, 4550 * 1600 * 3);
  assert.equal(w.rooms.length, 24);
  assert.equal(new Set(w.rooms.map((r) => r.id)).size, 24);
  assert.ok(w.caverns.length > 70);
  assert.equal(w.tokens[1].y, 2200, "new exploration reaches the deep route");
  assert.ok(w.tokens[4].x > 8500, "the guardian token moves with the arena");
});
test("every forest rest point restores after reload and death, including legacy saves", () => {
  const legacy = game({ checkpoint: true, tokens: { 0: [0, 1] } });
  assert.equal(legacy.player.x, 2240);
  assert.ok(
    legacy.world.tokens[1].collected,
    "previously earned tokens stay credited",
  );
  for (const c of createWorld(0).checkpoints) {
    const g = game();
    g.world.enemies = [];
    g.world.boss.dead = true;
    Object.assign(g.player, { x: c.x, y: c.y - 4, vx: 0, vy: 0 });
    ticks(g);
    assert.equal(g.progress.forestCamp, c.id);
    const loaded = game(g.progress);
    ticks(loaded, 30);
    assert.equal(loaded.player.x, c.x);
    assert.equal(loaded.player.y + loaded.player.h, c.y + 50);
    loaded.player.x = 6000;
    loaded.player.invulnerable = 0;
    loaded.damage(true);
    assert.equal(loaded.player.x, c.x);
    assert.ok(
      !loaded.world.platforms.some(
        (s) => s.solid && overlaps(loaded.player, s),
      ),
    );
  }
});
test("new shortcut IDs survive save sanitizing and cannot erase permanent terrain", () => {
  const w = createWorld(0),
    seals = w.platforms.filter((s) => s.breakable && s.x > 3500);
  assert.equal(seals.length, 3);
  const p = sanitizeProgress({ broken: { 0: seals.map((s) => s.id) } });
  const loaded = createWorld(0, p);
  assert.ok(seals.every((s) => !loaded.platforms.some((q) => q.id === s.id)));
  assert.deepEqual(
    loaded.platforms.filter((s) => s.terrain),
    w.platforms.filter((s) => s.terrain),
  );
});
test("boss activation and knockback use the expanded world coordinates", () => {
  const g = game();
  Object.assign(g.player, { x: 3650, y: 446 });
  ticks(g);
  assert.equal(g.world.boss.active, false);
  Object.assign(g.player, { x: 7000, y: 1000, invulnerable: 0 });
  g.damage();
  assert.ok(
    g.player.x > 6900,
    "damage cannot snap the player to the former world edge",
  );
  Object.assign(g.player, { x: 8200, y: 446 });
  ticks(g);
  assert.equal(g.world.boss.active, true);
});
for (const hero of [0, 1])
  test(`hero ${hero}: optional loops and main route reach all 24 forest rooms`, () => {
    const main = game({ hero });
    const seen = new Set(
      replay(
        main,
        hero
          ? "./forest-expanded-urmasa-route.json"
          : "./forest-expanded-route.json",
      ),
    );
    const branch = game({ hero });
    // Isolate geometry for optional loops; the main fixture above includes live enemies.
    branch.world.enemies = [];
    branch.world.tokens = [];
    branch.world.secrets = [];
    branch.world.springs = [];
    branch.world.boss.dead = true;
    branch.player.invulnerable = 100000;
    for (const id of replay(branch, "./forest-branches-route.json"))
      seen.add(id);
    for (const room of branch.world.rooms)
      assert.ok(seen.has(room.id), room.id);
    assert.ok(
      branch.player.x > 5200 && branch.player.x < 5400,
      "survey returns to the eastern fork",
    );
  });

test("each biome shares healing and saving in one shrine instead of neighboring duplicates", () => {
  for (let region = 0; region < 6; region++) {
    const w = createWorld(region);
    for (const camp of w.checkpoints || [w.checkpoint]) {
      const nearby = w.springs.filter(
        (spring) => Math.hypot(camp.x - spring.x, camp.y + 50 - spring.y) < 150,
      );
      assert.equal(
        nearby.length,
        1,
        `region ${region}: one healing effect per shrine`,
      );
      assert.equal(nearby[0].x, camp.x);
      assert.equal(nearby[0].y, camp.y + 50);
    }
  }
});

test("merged forest shrine still heals on return and preserves the saved camp", () => {
  const g = game({ checkpoint: true, forestCamp: "lanterns" });
  const camp = g.world.checkpoint;
  g.player.x = camp.x;
  g.player.y = camp.y + 50 - g.player.h;
  g.player.health = 1;
  g.player.invulnerable = 2;
  ticks(g);
  assert.equal(g.player.health, g.maxHealth());
  assert.equal(g.world.checkpoint, camp);
  assert.equal(g.progress.forestCamp, "lanterns");
});
