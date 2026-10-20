import test from "node:test";
import assert from "node:assert/strict";
import {
  creatureFrame,
  stepCreature,
  REGION_CREATURES,
} from "../src/creatures.js";
import { createWorld, movePlayer } from "../src/world.js";
test("every region has a distinct layout, three species, and dense encounters", () => {
  const layouts = new Set();
  for (let r = 0; r < 6; r++) {
    const w = createWorld(r);
    layouts.add(JSON.stringify(w.platforms));
    assert.equal(new Set(w.enemies.map((e) => e.key)).size, 3);
    assert.ok(w.enemies.length >= 10);
    assert.equal(
      w.platforms.filter((p) => p.wall && !p.terrain).length,
      r === 0 ? 10 : 7,
    );
  }
  assert.equal(layouts.size, 6);
  assert.equal(new Set(REGION_CREATURES.flat()).size, 12);
});
test("bird wingbeat cycles through four flight frames and uses perched idle separately", () => {
  const e = { hp: 2, state: "move", behavior: "bird", id: 0 };
  const frames = new Set();
  for (let t = 0; t < 1; t += 1 / 60) frames.add(creatureFrame(e, t));
  assert.deepEqual([...frames].sort(), [4, 5, 6, 7]);
  e.state = "idle";
  assert.ok(creatureFrame(e, 0.2) < 4);
  e.state = "windup";
  e.timer = 0.6;
  assert.equal(creatureFrame(e, 0), 8);
  e.state = "attack";
  e.timer = 0.3;
  assert.equal(creatureFrame(e, 0), 10);
  e.hp = 0;
  e.deathTime = 0.1;
  assert.equal(creatureFrame(e, 0), 14);
});
test("ranged enemies warn before firing, and defeated creatures stop attacking", () => {
  const e = {
    hp: 2,
    x: 100,
    y: 100,
    w: 38,
    baseY: 100,
    min: 0,
    max: 300,
    dir: 1,
    hit: 0,
    timer: 0,
    state: "idle",
    behavior: "spitter",
    id: 0,
  };
  const w = { region: 1, projectiles: [] },
    p = { x: 200, y: 100 };
  stepCreature(e, p, w, 1 / 60, 0);
  assert.equal(e.state, "windup");
  assert.equal(w.projectiles.length, 0);
  for (let i = 0; i < 46; i++) stepCreature(e, p, w, 1 / 60, i / 60);
  assert.equal(w.projectiles.length, 1);
  e.hp = 0;
  for (let i = 0; i < 200; i++) stepCreature(e, p, w, 1 / 60, i / 60);
  assert.equal(w.projectiles.length, 1);
});
test("solid walls block heads and cap sliding speed; ledges stay one-way", () => {
  const walls = [{ x: 100, y: 100, w: 40, h: 260, solid: true, wall: true }];
  let p = { x: 69, y: 180, w: 31, h: 54, vx: 270, vy: 700 };
  movePlayer(p, walls, 1 / 60);
  assert.equal(p.x, 69);
  assert.equal(p.wall, 1);
  assert.ok(p.vy <= 105);
  p = { x: 105, y: 361, w: 31, h: 54, vx: 0, vy: -550 };
  movePlayer(p, walls, 1 / 60);
  assert.equal(p.y, 360);
  assert.equal(p.vy, 0);
});
