import test from "node:test";
import assert from "node:assert/strict";
import { caveSurfaces, caveCorners } from "../src/cave-decoration.js";
import { exposedTerrainEdges } from "../src/wall-surfaces.js";
import { surfaceFade } from "../src/surface-fade.js";
import { buildForest } from "../src/forest.js";

const surfaces = (solids) =>
  caveSurfaces(
    solids.map((s) => ({ s, edges: exposedTerrainEdges(s, solids) })),
  );
test("join art distinguishes all four inner and outer corner orientations", () => {
  const block = [{ x: 100, y: 100, w: 300, h: 300, solid: true }];
  const outer = caveCorners(surfaces(block));
  assert.equal(outer.length, 4);
  assert.equal(new Set(outer.map((c) => c.kind)).size, 4);
  assert.ok(outer.every((c) => !c.inner && c.frame >= 0 && c.frame < 8));
  const room = [
    { x: 0, y: 0, w: 60, h: 400, solid: true },
    { x: 340, y: 0, w: 60, h: 400, solid: true },
    { x: 60, y: 0, w: 280, h: 60, solid: true },
    { x: 60, y: 340, w: 280, h: 60, solid: true },
  ];
  const inner = caveCorners(surfaces(room)).filter((c) => c.inner);
  assert.equal(inner.length, 4);
  assert.equal(new Set(inner.map((c) => c.kind)).size, 4);
  assert.ok(inner.every((c) => c.frame >= 8 && c.frame < 16));
});

test("short forest steps receive scaled corner art without losing rounded wall joins", () => {
  const solid = buildForest().platforms.filter((s) => s.solid);
  const corners = caveCorners(surfaces(solid));
  const upper = corners.find((c) => c.x === 1530 && c.y === 500);
  const lower = corners.find((c) => c.x === 1542 && c.y === 530);
  assert.ok(upper && lower, "both ends of the 30-pixel step must be dressed");
  assert.equal(upper.kind, "corners-floor-right");
  assert.equal(upper.inner, false);
  assert.equal(lower.kind, "corners-floor-left");
  assert.equal(lower.inner, true);
  assert.ok(upper.scale < 0.3 && lower.scale < 0.3);
  assert.ok(
    corners.some((c) => c.x === 1320 && c.y === 500 && c.inner),
    "a rounded connection still registers to its main wall",
  );
  const ordered = (items) =>
    items.sort(
      (a, b) => a.x - b.x || a.y - b.y || a.kind.localeCompare(b.kind),
    );
  assert.deepEqual(
    ordered(corners),
    ordered(caveCorners(surfaces([...solid].reverse()))),
    "collider order cannot reroll corner variants",
  );
});

test("surface fade has round end caps, a smooth falloff, and a black interior", () => {
  const fade = surfaceFade(400, 400, [
    { horizontal: false, axis: 100, a: 100, b: 300 },
  ]);
  const alpha = (x, y) =>
    fade.pixels[(Math.floor(y / 2) * fade.width + Math.floor(x / 2)) * 4 + 3];
  assert.equal(alpha(100, 200), 255);
  assert.ok(
    alpha(120, 90) > 0,
    "texture fades around the end, without a rectangular cutoff",
  );
  assert.equal(alpha(260, 200), 0);
  for (let x = 102; x <= 246; x += 2) {
    assert.ok(alpha(x, 200) <= alpha(x - 2, 200));
    assert.ok(
      alpha(x - 2, 200) - alpha(x, 200) <= 8,
      "no abrupt brightness step",
    );
  }
  const split = surfaceFade(400, 400, [
    { horizontal: false, axis: 100, a: 100, b: 200 },
    { horizontal: false, axis: 100, a: 200, b: 300 },
  ]);
  assert.deepEqual(
    split.pixels,
    fade.pixels,
    "collider seams do not alter the gradient",
  );
});
