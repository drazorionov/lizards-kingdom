import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  movePlayer,
  PHYSICS,
  sanitizeProgress,
  mergeProgress,
  REGIONS,
} from "../src/world.js";
test("all six lands contain five unique reachable tokens and a guarded final token", () => {
  for (let i = 0; i < 6; i++) {
    const world = createWorld(i);
    assert.equal(world.tokens.length, 5);
    assert.equal(new Set(world.tokens.map((t) => t.id)).size, 5);
    assert.equal(world.tokens.filter((t) => t.boss).length, 1);
    for (const t of world.tokens) {
      assert.ok(
        world.platforms.some(
          (p) => t.x >= p.x && t.x <= p.x + p.w && p.y > t.y && p.y - t.y < 200,
        ),
      );
    }
  }
});
test("landing resolves to the platform top without tunneling", () => {
  const p = { x: 20, y: 400, w: 30, h: 50, vx: 0, vy: 830, jumps: 2 };
  for (let i = 0; i < 10; i++)
    movePlayer(p, [{ x: 0, y: 500, w: 500, h: 100, ground: true }], 1 / 60);
  assert.equal(p.y, 450);
  assert.equal(p.vy, 0);
  assert.equal(p.jumps, 0);
  assert.equal(p.grounded, true);
});
test("one-way platforms allow rising from underneath", () => {
  const p = { x: 20, y: 400, w: 30, h: 50, vx: 0, vy: -550, jumps: 1 };
  for (let i = 0; i < 20; i++)
    movePlayer(p, [{ x: 0, y: 360, w: 200, h: 24 }], 1 / 60);
  assert.ok(p.y + p.h < 360);
});
test("expanded regions have vertical climbs, sealed chambers and return tunnels", () => {
  const ascent =
    (PHYSICS.jump ** 2 + PHYSICS.doubleJump ** 2) / (2 * PHYSICS.gravity);
  assert.ok(ascent > 180);
  for (let i = 0; i < 6; i++) {
    const w = createWorld(i);
    assert.equal(w.height, i === 0 ? 2400 : 1600);
    assert.equal(w.rooms.length, i === 0 ? 24 : 8);
    assert.ok(w.platforms.some((p) => p.y >= 1400 && p.w > 1000));
    assert.ok(w.platforms.some((p) => p.breakable && p.secret));
    assert.ok(w.platforms.filter((p) => p.wall && p.h >= 500).length >= 2);
    assert.equal(w.secrets.length, 5);
  }
});
test("save sanitizer bounds untrusted state and drops unknown fields", () => {
  const p = sanitizeProgress({
    hero: 8,
    region: 99,
    tokens: { 0: [0, 0, 4, 8, -1, "2"] },
    cleared: [1, 1, 9],
    mode: "cheat",
    sql: "bad",
  });
  assert.equal(p.region, 5);
  assert.equal(p.hero, 0);
  assert.deepEqual(p.tokens[0], [0, 4]);
  assert.deepEqual(p.cleared, [1]);
  assert.equal(p.mode, "gentle");
  assert.equal(p.sql, undefined);
  assert.equal(sanitizeProgress(null), null);
});
test("cloud merge preserves tokens earned offline and newer settings", () => {
  const a = { tokens: { 0: [1] }, cleared: [0], hero: 1, updatedAt: 20 };
  const b = { tokens: { 0: [2] }, cleared: [1], hero: 0, updatedAt: 10 };
  const p = mergeProgress(a, b);
  assert.deepEqual(p.tokens[0], [1, 2]);
  assert.deepEqual(p.cleared, [0, 1]);
  assert.equal(p.hero, 1);
});
