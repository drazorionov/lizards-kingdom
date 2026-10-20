import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { terrainArt, terrainArtKeys } from "../src/terrain-art.js";

test("dungeon biomes select their own complete directional and corner atlas sets", () => {
  for (const [region, biome] of [
    [1, "marsh"],
    [4, "depths"],
    [5, "lake"],
  ]) {
    const set = terrainArt(region);
    assert.equal(set.prefix, `${biome}-cave-`);
    assert.equal(terrainArtKeys(region).length, 4);
    for (const [kind, count] of [
      ["edges", 4],
      ["walls", 4],
      ["joins-floor", 16],
      ["joins-ceiling", 16],
    ]) {
      const name = `${kind}-v3`;
      const frames = set.frames[name];
      assert.equal(frames.length, count);
      const png = readFileSync(
        new URL(
          `../art/biome-caves/${biome}/${name}-source.png`,
          import.meta.url,
        ),
      );
      const width = png.readUInt32BE(16),
        height = png.readUInt32BE(20);
      assert.ok(
        statSync(
          new URL(
            `../public/assets/${biome}-cave-${name}.webp`,
            import.meta.url,
          ),
        ).size > 1000,
      );
      for (const frame of frames) {
        const [x, y, w, h] = frame.rect;
        assert.ok(
          w > 0 &&
            h > 0 &&
            x >= 0 &&
            y >= 0 &&
            x + w <= width &&
            y + h <= height,
        );
        if (frame.anchor) {
          assert.ok(frame.anchor[0] >= 0 && frame.anchor[0] < w);
          assert.ok(frame.anchor[1] >= 0 && frame.anchor[1] < h);
        } else {
          assert.ok(
            frame.surface >= 0 && frame.surface < (kind === "walls" ? w : h),
          );
        }
      }
    }
  }
});

test("forest keeps its existing artwork and open ascents keep their rock materials", () => {
  assert.equal(terrainArt(0).version, "v2");
  assert.ok(terrainArtKeys(0).every((k) => k.startsWith("forest-cave-")));
  for (const region of [2, 3]) {
    assert.equal(terrainArt(region), null);
    assert.deepEqual(terrainArtKeys(region), []);
  }
});
