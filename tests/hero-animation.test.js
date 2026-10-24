import test from "node:test";
import assert from "node:assert/strict";
import {
  createHeroAnimation,
  updateHeroAnimation,
  drawHero,
  heroFrameRect,
  HERO_ATLAS,
} from "../src/hero-animation.js";
const player = () => ({
  x: 10,
  y: 100,
  w: 31,
  h: 54,
  dir: 1,
  vx: 0,
  vy: 0,
  grounded: true,
  attack: 0,
  dash: 0,
  jumps: 0,
  animation: createHeroAnimation(),
});
test("standing cycles through all breathing poses without walking", () => {
  const p = player(),
    frames = new Set();
  for (let i = 0; i < 150; i++) {
    updateHeroAnimation(p, 1 / 60);
    if (p.animation.state === "idle") frames.add(p.animation.frame);
  }
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3]);
});
test("walk uses all ten frames and preserves its phase across a turn", () => {
  const p = player();
  p.vx = 270;
  const frames = new Set();
  for (let i = 0; i < 100; i++) {
    updateHeroAnimation(p, 1 / 60);
    if (p.animation.state === "walk") frames.add(p.animation.frame);
  }
  assert.deepEqual(
    [...frames].sort((a, b) => a - b),
    [24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  );
  const phase = p.animation.walkPhase;
  p.vx = -270;
  p.dir = -1;
  updateHeroAnimation(p, 1 / 60);
  assert.ok(Math.abs(p.animation.walkPhase - phase) < 0.5);
});
test("airborne movement never uses walking frames; jump follows vertical velocity", () => {
  const p = player();
  updateHeroAnimation(p, 0.2);
  p.grounded = false;
  p.jumps = 1;
  p.vy = -550;
  p.vx = 270;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.state, "takeoff");
  assert.equal(p.animation.frame, 12);
  updateHeroAnimation(p, 0.1);
  assert.equal(p.animation.frame, 13);
  p.vy = 0;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.frame, 14);
  p.vy = 300;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.frame, 15);
  p.grounded = true;
  p.vy = 0;
  p.jumps = 0;
  p.vx = 0;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.state, "land");
  updateHeroAnimation(p, 0.2);
  assert.equal(p.animation.state, "idle");
});
test("double jump restarts takeoff, and combat never switches to the old hero art", () => {
  const p = player();
  p.grounded = false;
  p.jumps = 1;
  p.vy = 200;
  updateHeroAnimation(p, 0.2);
  p.jumps = 2;
  p.vy = -490;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.state, "takeoff");
  p.attack = 0.21;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.state, "attack");
  assert.equal(p.animation.frame, 34);
  p.attack = 0;
  p.dash = 0.18;
  updateHeroAnimation(p, 1 / 60);
  assert.equal(p.animation.state, "dash");
});
test("drawing mirrors around the feet and keeps the registered atlas origin", () => {
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    translate(...v) {
      calls.push(["translate", ...v]);
    },
    scale(...v) {
      calls.push(["scale", ...v]);
    },
    drawImage(...v) {
      calls.push(["drawImage", ...v]);
    },
  };
  const p = player();
  p.dir = -1;
  p.animation.frame = 10;
  drawHero(ctx, "atlas", p);
  assert.deepEqual(calls[0], ["translate", 25.5, 154]);
  assert.deepEqual(calls[1], ["scale", -1, 1]);
  assert.deepEqual(calls[2].slice(2, 6), heroFrameRect(10));
  assert.equal(
    calls[2][6],
    (-HERO_ATLAS.anchorX / HERO_ATLAS.cell) * HERO_ATLAS.size,
  );
});
test("Quirel uses dedicated staff-sweep, wall-cling, wall-kick and double-jump poses", () => {
  const p = player();
  p.hero = 0;
  p.attackDuration = 0.32;
  const frames = [];
  for (const attack of [0.32, 0.23, 0.15, 0.07]) {
    p.attack = attack;
    updateHeroAnimation(p, 0);
    frames.push(p.animation.frame);
  }
  assert.deepEqual(frames, [34, 36, 39, 41]);
  p.attack = 0;
  p.grounded = false;
  p.wall = 1;
  p.vy = 105;
  updateHeroAnimation(p, 0);
  assert.equal(p.animation.frame, 20);
  p.wall = 0;
  p.wallKick = 0.1;
  p.vy = -570;
  updateHeroAnimation(p, 0);
  assert.equal(p.animation.frame, 21);
  p.wallKick = 0;
  p.jumps = 2;
  p.vy = -490;
  updateHeroAnimation(p, 0.2);
  updateHeroAnimation(p, 0.2);
  assert.equal(p.animation.frame, 22);
  p.attack = 0.2;
  updateHeroAnimation(p, 0);
  assert.equal(p.animation.frame, 37);
});

for (const hero of [0, 1]) {
  test(`hero ${hero} plays all ten combat poses on the ground and in the air`, () => {
    const p = player();
    p.hero = hero;
    p.attackDuration = hero === 0 ? 0.32 : 0.21;
    for (const grounded of [true, false]) {
      p.grounded = grounded;
      const frames = new Set();
      for (let elapsed = 0; elapsed < p.attackDuration; elapsed += 1 / 60) {
        p.attack = p.attackDuration - elapsed;
        updateHeroAnimation(p, 1 / 60);
        frames.add(p.animation.frame);
      }
      assert.deepEqual(
        [...frames],
        Array.from({ length: 10 }, (_, i) => 34 + i),
      );
    }
    p.attack = p.attackDuration + 1;
    updateHeroAnimation(p, 0);
    assert.equal(
      p.animation.frame,
      34,
      "oversized timer cannot select an invalid frame",
    );
    p.attack = 0.00001;
    updateHeroAnimation(p, 0);
    assert.equal(p.animation.frame, 43, "recovery reaches the final pose");
  });
}

test("running phase follows distance, freezes at rest, and survives a direction change", () => {
  const p = player();
  p.animation.grounded = true;
  p.vx = 100;
  updateHeroAnimation(p, 0.25);
  assert.equal(p.animation.walkPhase, 2.5);
  p.vx = 0;
  updateHeroAnimation(p, 0.4);
  assert.equal(p.animation.walkPhase, 2.5);
  p.vx = -100;
  updateHeroAnimation(p, 0.25);
  assert.equal(p.animation.walkPhase, 5);
  updateHeroAnimation(p, 0.5);
  assert.equal(p.animation.walkPhase, 0);
});
