import test from "node:test";
import assert from "node:assert/strict";
import {
  caveSurfaces,
  caveCorners,
  caveSkins,
  skinOpacity,
  caveGrowth,
  caveOverlays,
} from "../src/cave-decoration.js";
import { exposedTerrainEdges } from "../src/wall-surfaces.js";
import { buildForest } from "../src/forest.js";

const surfaces = (solids) =>
  caveSurfaces(
    solids.map((s) => ({ s, edges: exposedTerrainEdges(s, solids) })),
  );
test("forest growth stays sparse, avoids floors and remains stable on redraw", () => {
  const eligible = Array.from({ length: 100 }, (_, i) => ({
    side: i % 2 ? "left" : "bottom",
    axis: i * 200,
    a: 0,
    b: 180,
    horizontal: i % 2 === 0,
  }));
  const chosen = caveGrowth(eligible);
  assert.equal(chosen.length, 10);
  assert.equal(chosen.filter((p) => p.ceiling).length, 5);
  assert.ok(chosen.every((p) => p.height <= 36 && p.side !== "top"));
  assert.deepEqual(chosen, caveGrowth([...eligible].reverse()));
  assert.deepEqual(
    caveGrowth([{ side: "top", axis: 100, a: 0, b: 1000, horizontal: true }]),
    [],
  );
});
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

test("opposing skins leave a dark core in a 55-pixel wall and a thin roof", () => {
  for (const block of [
    { x: 100, y: 100, w: 55, h: 400, solid: true },
    { x: 100, y: 100, w: 400, h: 55, solid: true },
  ]) {
    const skins = caveSkins(surfaces([block]));
    const pair = skins.filter((s) =>
      block.w === 55 ? !s.horizontal : s.horizontal,
    );
    assert.equal(pair.length, 2);
    assert.ok(pair.every((s) => Math.abs(s.depth - 20.9) < 0.001));
    assert.ok(pair.reduce((total, s) => total + s.depth, 0) < 55 * 0.8);
    assert.ok(pair.every((s) => skinOpacity(27.5, s.depth) === 0));
  }
});

test("skin depth changes where a thin wall meets a broad landmass", () => {
  const skins = caveSkins(
    surfaces([
      { x: 100, y: 100, w: 55, h: 200, solid: true },
      { x: 100, y: 300, w: 300, h: 200, solid: true },
    ]),
  );
  const left = skins.filter((s) => s.side === "left");
  assert.deepEqual(
    left.map(({ a, b, depth }) => [a, b, depth]),
    [
      [100, 300, 55 * 0.38],
      [300, 500, 36],
    ],
  );
});

test("skin falloff reaches black smoothly without seams between colliders", () => {
  assert.equal(skinOpacity(0, 36), 1);
  assert.equal(skinOpacity(36, 36), 0);
  for (let d = 1; d <= 36; d++) {
    assert.ok(skinOpacity(d, 36) <= skinOpacity(d - 1, 36));
    assert.ok(skinOpacity(d - 1, 36) - skinOpacity(d, 36) < 0.06);
  }
  const whole = surfaces([{ x: 100, y: 100, w: 55, h: 400, solid: true }]);
  const split = surfaces([
    { x: 100, y: 100, w: 55, h: 200, solid: true },
    { x: 100, y: 300, w: 55, h: 200, solid: true },
  ]);
  const ordered = (s) =>
    caveSkins(s).sort(
      (a, b) => a.side.localeCompare(b.side) || a.axis - b.axis,
    );
  assert.deepEqual(ordered(whole), ordered(split));
});

test("composed overlays cover all six motifs sparsely with stable anchors", () => {
  const world = buildForest();
  const solid = world.platforms.filter((s) => s.solid && !s.absent);
  const faces = solid.map((s) => {
    const edges = exposedTerrainEdges(s, solid);
    if (s.x === 0) edges.left = [];
    if (s.y === 0) edges.top = [];
    if (s.x + s.w === world.width) edges.right = [];
    if (s.y + s.h === world.height) edges.bottom = [];
    return { s, edges };
  });
  const exposed = caveSurfaces(faces);
  const gardens = caveOverlays(exposed);
  assert.deepEqual(
    [...new Set(gardens.map((p) => p.frame))].sort(),
    [0, 1, 2, 3, 4, 5],
  );
  assert.ok(gardens.length >= 6 && gardens.length <= 12);
  assert.ok(
    gardens.some((p) => p.x === 760 && p.y === 500),
    "opening room gets a corner garden",
  );
  assert.deepEqual(gardens, caveOverlays([...exposed].reverse()));
  for (const [i, p] of gardens.entries()) {
    assert.ok(p.height <= 150 && Math.abs(p.flip) === 1);
    for (const q of gardens.slice(i + 1))
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 240);
  }
});
