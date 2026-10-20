import test from "node:test";
import assert from "node:assert/strict";
import { carveCaverns, organicOpening, sculptIsland } from "../src/caverns.js";
import { caveContours, contourSkins } from "../src/cave-contours.js";
import { exposedTerrainEdges } from "../src/wall-surfaces.js";
import { movePlayer, overlaps } from "../src/world.js";
const faces = (solids) =>
  solids.map((s) => ({ s, edges: exposedTerrainEdges(s, solids) }));

test("organic rooms have vaulted roofs and bowed walls while preserving landing centers", () => {
  const r = { x: 100, y: 150, w: 820, h: 400 };
  const air = organicOpening(r);
  assert.ok(Math.min(...air.map((p) => p.y)) < r.y - 50);
  assert.ok(Math.min(...air.map((p) => p.x)) < r.x - 20);
  assert.ok(new Set(air.map((p) => p.x)).size > 15);
  assert.equal(Math.max(...air.map((p) => p.y + p.h)), 550);
  assert.deepEqual(air, organicOpening(r));
});

test("both directions can walk the rolling passage without jumping or entering earth", () => {
  const solids = carveCaverns(1000, 650, [
    { x: 50, y: 120, w: 900, h: 330, rolling: true },
  ]);
  for (const dir of [-1, 1]) {
    const p = {
      x: dir > 0 ? 150 : 800,
      y: 396,
      w: 31,
      h: 54,
      vx: 0,
      vy: 0,
      grounded: true,
      jumps: 0,
    };
    for (let i = 0; i < 160; i++) {
      p.vx = dir * 240;
      movePlayer(p, solids, 1 / 60, 1000);
      assert.ok(
        !solids.some((s) =>
          overlaps(
            { ...p, x: p.x + 0.05, y: p.y + 0.05, w: p.w - 0.1, h: p.h - 0.1 },
            s,
          ),
        ),
      );
    }
    assert.ok(
      dir > 0 ? p.x > 750 : p.x < 200,
      `walk completed in direction ${dir}: ${p.x}`,
    );
  }
});

test("narrow wall curvature pushes a rising shoulder aside without clipping", () => {
  const solids = [
    { x: 100, y: 80, w: 100, h: 12, solid: true, terrain: true, wall: true },
    { x: 102, y: 92, w: 98, h: 80, solid: true, terrain: true, wall: true },
  ];
  const p = {
    x: 71,
    y: 95,
    w: 31,
    h: 54,
    vx: 0,
    vy: -350,
    grounded: false,
    jumps: 1,
  };
  for (let i = 0; i < 4; i++) {
    movePlayer(p, solids, 1 / 60, 400);
    assert.ok(!solids.some((s) => overlaps(p, s)));
  }
  assert.equal(p.x, 69);
  assert.equal(p.wall, 1);
});

test("contours connect sampled bands and apply material along diagonal tangents", () => {
  const solid = carveCaverns(1000, 700, [{ x: 120, y: 160, w: 740, h: 400 }]);
  const f = faces(solid),
    contours = caveContours(f),
    skins = contourSkins(f);
  assert.ok(contours.every((c) => c.closed));
  assert.ok(
    skins.filter((s) => Math.abs(s.tx) > 0.1 && Math.abs(s.ty) > 0.1).length >
      20,
  );
  assert.ok(skins.every((s) => s.depth > 0 && s.depth <= 36));
  for (const s of skins) assert.ok(Math.abs(s.tx * s.nx + s.ty * s.ny) < 1e-8);
});

test("curved skin ownership preserves a dark center in narrow walls", () => {
  const f = faces([{ x: 100, y: 100, w: 55, h: 400, solid: true }]);
  for (const s of contourSkins(f).filter(
    (s) => !s.horizontal && s.y > 140 && s.y < 440,
  ))
    assert.ok(Math.abs(s.depth - 55 * 0.38) < 0.001);
});

test("mountain and tower islands preserve their landing and curve underneath", () => {
  const r = {
    x: 200,
    y: 300,
    w: 220,
    h: 180,
    solid: true,
    ground: true,
    terrain: true,
  };
  const parts = sculptIsland(r);
  assert.deepEqual(parts[0], { ...r, h: 12 });
  assert.ok(parts.at(-1).w < r.w * 0.7);
  assert.ok(new Set(parts.map((p) => p.x)).size > 8);
});
