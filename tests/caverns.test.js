import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine.js";
import { createWorld, sanitizeProgress, overlaps } from "../src/world.js";
import route from "./forest-route.json" with { type: "json" };
import returnRoute from "./forest-return-route.json" with { type: "json" };

globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function game(hero, checkpoint = false) {
  const g = new Game(
    { focus() {} },
    {},
    { viewWidth: 1100, prepare() {} },
    { toast() {}, sound() {}, save() {}, hud() {}, pause() {}, complete() {} },
  );
  g.start(0, sanitizeProgress({ hero, checkpoint }));
  for (let i = 0; i < 30; i++) g.step(1 / 60);
  return g;
}
function replay(g, fixture) {
  for (const index of (g.player.hero === 0 && fixture.quirel) ||
    fixture.route) {
    const a = fixture.actions[index];
    g.release("left");
    g.release("right");
    if (a.dir) g.press(a.dir < 0 ? "left" : "right");
    if (a.jump === "press") {
      g.release("jump");
      g.press("jump");
    }
    g.press("attack");
    for (let i = 0; i < fixture.framesPerAction; i++) {
      g.step(1 / 60);
      const p = g.player;
      assert.ok(
        !g.world.platforms.some(
          (s) =>
            s.solid &&
            overlaps({ x: p.x + 0.5, y: p.y + 0.5, w: p.w - 1, h: p.h - 1 }, s),
        ),
        "hero never enters enclosing terrain",
      );
    }
  }
}
test("forest is enclosed earth around playable rooms; landmarks and encounter spawns occupy air", () => {
  const w = createWorld(0),
    solid = (x, y) =>
      w.platforms.some(
        (s) =>
          s.solid && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h,
      );
  for (let x = 5; x < w.width; x += 25) {
    assert.ok(solid(x, 5));
    assert.ok(solid(x, w.height - 5));
  }
  for (let y = 5; y < w.height; y += 25) {
    assert.ok(solid(5, y));
    assert.ok(solid(w.width - 5, y));
  }
  for (const t of w.tokens)
    assert.ok(!solid(t.x, t.y), `token ${t.id} is outside the rock`);
  for (const e of w.enemies)
    assert.ok(
      !w.platforms.some((s) => s.solid && overlaps(e, s)),
      "encounters are not buried",
    );
  assert.ok(w.caverns.length >= 20);
});
for (const hero of [0, 1]) {
  test(`hero ${hero} traverses both forest loops without clipping the curved boundaries`, () => {
    const g = game(hero);
    replay(g, route);
    assert.equal(g.world.secrets.filter((s) => s.found).length, 5);
    assert.ok(
      g.world.tokens
        .filter((t) => [0, 2, 3].includes(t.id))
        .every((t) => t.collected),
    );
    assert.ok(g.checkpointUsed);
  });
  test(`hero ${hero} can backtrack from the refuge through the shortcut to the starting fields`, () => {
    const g = game(hero, true);
    replay(g, returnRoute);
    assert.ok(Math.abs(g.player.x - 505) < 35);
    assert.ok(Math.abs(g.player.y - 446) < 10);
    assert.ok(!g.world.platforms.some((s) => s.shortcut && s.x === 1510));
    assert.ok(g.player.health > 0);
  });
}
test("legacy broken IDs cannot remove enclosing earth or permanent floors", () => {
  const clean = createWorld(0);
  const loaded = createWorld(0, {
    broken: { 0: clean.platforms.map((s) => s.id) },
  });
  assert.equal(
    loaded.platforms.length,
    clean.platforms.filter((s) => !s.breakable).length,
  );
  assert.deepEqual(
    loaded.platforms.filter((s) => s.terrain),
    clean.platforms.filter((s) => s.terrain),
  );
});
