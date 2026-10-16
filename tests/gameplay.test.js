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
function jumpTo(g, x) {
  g.clearInput();
  const dir = x > g.player.x ? "right" : "left";
  g.press(dir);
  g.press("jump");
  let doubled = false;
  let i = 0;
  while (i++ < 140) {
    if (i === 20 && !doubled) {
      g.release("jump");
      g.press("jump");
      doubled = true;
    }
    if (Math.abs(g.player.x - x) < 5) g.release(dir);
    g.step(1 / 60);
    if (i > 22 && g.player.grounded) break;
  }
  g.clearInput();
  return i;
}
for (let region = 0; region < 6; region++)
  test(`chapter ${region + 1} is traversable using movement, double jumps and attacks`, () => {
    const { game: g, completed } = setup(region);
    ticks(g, 30);
    walk(g, 345);
    jumpTo(g, 490);
    assert.equal(g.world.tokens[0].collected, true, "first high token");
    jumpTo(g, 730);
    jumpTo(g, 1010);
    assert.equal(g.world.tokens[1].collected, true, "second high token");
    jumpTo(g, 1280);
    jumpTo(g, 1570);
    jumpTo(g, 1845);
    assert.equal(g.world.tokens[2].collected, true, "third high token");
    jumpTo(g, 2100);
    jumpTo(g, 2360);
    jumpTo(g, 2595);
    assert.equal(g.world.tokens[3].collected, true, "fourth high token");
    jumpTo(g, 2890);
    jumpTo(g, 3150);
    jumpTo(g, 3380);
    jumpTo(g, 3630);
    walk(g, 3930);
    g.press("attack");
    for (let i = 0; i < 1200 && !g.world.boss.dead; i++) {
      if (
        g.world.boss.phase === 1 &&
        g.world.boss.timer < 0.3 &&
        g.player.grounded
      )
        g.press("jump");
      if (g.player.vy > 0) g.release("jump");
      if (g.player.x < 3925) g.press("right");
      else g.release("right");
      g.step(1 / 60);
    }
    g.clearInput();
    assert.equal(
      g.world.boss.dead,
      true,
      "guardian can be defeated without contact damage",
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
