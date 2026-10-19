import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine.js";
import { createWorld, sanitizeProgress } from "../src/world.js";
import { exposedTerrainEdges } from "../src/wall-surfaces.js";
import { movePlayer } from "../src/world.js";
import { stepWallDebris } from "../src/terrain.js";

globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

for (let region = 0; region < 6; region++) {
  test(`region ${region}: broken wall animates once, clears collision and persists`, () => {
    const g = new Game(
      { focus() {} },
      {},
      { viewWidth: 1100, prepare() {} },
      {
        toast() {},
        sound() {},
        save() {},
        hud() {},
        complete() {},
        pause() {},
      },
    );
    g.start(region, sanitizeProgress({ region }));
    const wall = g.world.platforms.find((s) => s.shortcut);
    Object.assign(g.player, {
      x: wall.x - 40,
      y: wall.y + wall.h - 100,
      dir: 1,
    });
    g.step(1 / 60);
    assert.ok(g.world.platforms.includes(wall));
    assert.equal(g.wallDebris.length, 0);
    g.press("attack");
    g.step(1 / 60);
    assert.ok(!g.world.platforms.includes(wall));
    assert.ok(g.wallDebris.length >= 12);
    assert.ok(g.particles.some((p) => p.dust));
    assert.ok(
      !createWorld(region, g.progress).platforms.some((s) => s.id === wall.id),
    );
    const count = g.wallDebris.length;
    const original = g.wallDebris.map((p) => [p.x, p.y]);
    for (let i = 0; i < 20; i++) g.step(1 / 60);
    assert.equal(
      g.wallDebris.length,
      count,
      "holding attack does not duplicate debris",
    );
    assert.ok(
      g.wallDebris.some(
        (p, i) => Math.hypot(p.x - original[i][0], p.y - original[i][1]) > 10,
      ),
    );
    for (let i = 0; i < 120; i++) stepWallDebris(g.wallDebris, 1 / 60);
    assert.equal(
      g.wallDebris.length,
      0,
      "debris expires independently of collision",
    );
    g.start(region, g.progress);
    assert.equal(g.wallDebris.length, 0, "restart clears transient effects");
    assert.ok(!g.world.platforms.some((s) => s.id === wall.id));
  });
}

test("connected terrain exposes only the playable perimeter, including after a barrier breaks", () => {
  const floor = { x: 100, y: 400, w: 400, h: 100, solid: true };
  const cliff = { x: 450, y: 100, w: 50, h: 300, solid: true };
  const roof = { x: 200, y: 50, w: 300, h: 50, solid: true };
  const seal = { x: 180, y: 100, w: 20, h: 300, solid: true, breakable: true };
  const solids = [floor, cliff, roof, seal];
  assert.deepEqual(exposedTerrainEdges(cliff, solids).bottom, []);
  assert.deepEqual(exposedTerrainEdges(cliff, solids).top, []);
  assert.deepEqual(exposedTerrainEdges(floor, solids).top, [
    [0, 80],
    [100, 350],
  ]);
  assert.deepEqual(exposedTerrainEdges(roof, solids).bottom, [[0, 250]]);
  seal.broken = true;
  assert.deepEqual(exposedTerrainEdges(floor, solids).top, [[0, 350]]);
});

test("full-height solid faces support sliding and wall-jump contact without a wall tag", () => {
  const cliff = { x: 200, y: 100, w: 250, h: 500, solid: true, ground: true };
  for (const [x, vx, side] of [
    [170, 150, 1],
    [450, -150, -1],
  ]) {
    const p = { x, y: 250, w: 30, h: 54, vx, vy: 400, jumps: 2 };
    movePlayer(p, [cliff], 1 / 60);
    assert.equal(p.wall, side);
    assert.equal(p.lastWall, side);
    assert.equal(p.vy, 105);
    assert.equal(p.wallCoyote, 0.12);
  }
  const p = { x: 170, y: 250, w: 30, h: 54, vx: 150, vy: 400, jumps: 2 };
  movePlayer(p, [{ ...cliff, solid: false, ground: false }], 1 / 60);
  assert.equal(p.wall, 0, "one-way ledges do not become solid climbing walls");
  const lip = { ...cliff, y: 250, h: 100 };
  Object.assign(p, { x: 170, y: 260, vx: 150, vy: 400 });
  movePlayer(p, [lip], 1 / 60);
  assert.equal(p.wall, 0, "shallow floor lips do not catch passing jumps");
  assert.ok(p.vy > 105);
});
