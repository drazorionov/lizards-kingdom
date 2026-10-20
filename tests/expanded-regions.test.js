import test from "node:test";
import assert from "node:assert/strict";
import { buildLevel } from "../src/levels.js";
import { createWorld, sanitizeProgress, overlaps } from "../src/world.js";
import { Game } from "../src/engine.js";

globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

test("all expanded rooms, detours and summit arenas belong to a connected route graph", () => {
  for (let region = 1; region < 6; region++) {
    const level = buildLevel(region),
      visited = new Set([level.startNode]);
    for (let pass = 0; pass < level.nodes.length; pass++)
      for (const { a, b } of level.links)
        if (visited.has(a) || visited.has(b)) {
          visited.add(a);
          visited.add(b);
        }
    assert.equal(visited.size, level.nodes.length);
    for (const p of [...level.nodes, ...level.links.flatMap((e) => e.via)]) {
      assert.ok(
        p.x >= 0 &&
          p.x + 30 <= level.width &&
          p.y >= 0 &&
          p.y + 54 <= level.height,
      );
      assert.ok(
        !level.platforms.some(
          (s) => s.solid && !s.breakable && overlaps({ ...p, w: 30, h: 54 }, s),
        ),
        `region ${region}: clear landing at ${p.x},${p.y}`,
      );
    }
    assert.ok(level.nodes.at(-1).floor < level.nodes[level.startNode].floor);
    assert.ok(
      level.links.length >= level.nodes.length,
      "branches reconnect into loops",
    );
  }
});

test("each regional refuge restores its own position and rejects invalid camp IDs", () => {
  for (let region = 1; region < 6; region++) {
    for (const camp of createWorld(region).checkpoints) {
      const progress = sanitizeProgress({
        region,
        checkpoint: true,
        regionCamps: { [region]: camp.id },
      });
      const world = createWorld(region, progress);
      assert.equal(world.checkpoint.id, camp.id);
      assert.equal(world.checkpoint.x, camp.x);
      assert.equal(world.checkpoint.y, camp.y);
      assert.ok(
        world.springs.some(
          (s) => s.x === camp.x && s.y === camp.y + 50 && s.refuge,
        ),
      );
    }
    assert.equal(
      sanitizeProgress({ regionCamps: { [region]: "bogus" } }).regionCamps[
        region
      ],
      "crossroads",
    );
  }
});

test("old broken-wall IDs do not remove new regional geometry", () => {
  for (let r = 1; r < 6; r++) {
    const fresh = createWorld(r);
    const migrated = createWorld(
      r,
      sanitizeProgress({
        broken: { [r]: Array.from({ length: 100 }, (_, i) => i) },
      }),
    );
    assert.equal(migrated.platforms.length, fresh.platforms.length);
  }
});

test("the right-hand side of a lower mountain or tower tier never completes the summit", () => {
  for (const region of [2, 3]) {
    const completed = [];
    const g = new Game(
      { focus() {} },
      {},
      { viewWidth: 1100, prepare() {} },
      {
        toast() {},
        sound() {},
        save() {},
        hud() {},
        pause() {},
        complete(r) {
          completed.push(r);
        },
      },
    );
    g.start(
      region,
      sanitizeProgress({
        region,
        tokens: { [region]: [0, 1, 2, 3, 4] },
        defeated: [region],
      }),
    );
    g.player.x = 4400;
    g.player.y = g.world.height - 600;
    g.step(1 / 60);
    assert.deepEqual(completed, []);
    assert.equal(g.finished, false);
  }
});
