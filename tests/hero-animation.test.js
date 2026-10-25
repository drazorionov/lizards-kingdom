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
test("walk uses all eight frames and preserves its phase across a turn", () => {
  const p = player();
  p.vx = 270;
  const frames = new Set();
  for (let i = 0; i < 100; i++) {
    updateHeroAnimation(p, 1 / 60);
    if (p.animation.state === "walk") frames.add(p.animation.frame);
  }
  assert.deepEqual(
    [...frames].sort((a, b) => a - b),
    [4, 5, 6, 7, 8, 9, 10, 11],
  );
  const phase = p.animation.walkPhase;
  p.vx = -270;
  p.dir = -1;
  updateHeroAnimation(p, 1 / 60);
  assert.ok(Math.abs(p.animation.walkPhase - phase) < 0.3);
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
  assert.equal(p.animation.frame, 13);
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
  assert.deepEqual(frames, [16, 17, 18, 19]);
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
  assert.equal(p.animation.frame, 23);
});

for (const hero of [0, 1]) {
  test(`hero ${hero}: running keeps an even five-tick cadence using the original eight poses`, () => {
    const p = player();
    p.hero = hero;
    p.vx = 270;
    for (let i = 0; i < 120; i++) updateHeroAnimation(p, 1 / 60);
    const changes = [],
      frames = new Set();
    let previous = p.animation.frame;
    for (let tick = 0; tick < 120; tick++) {
      updateHeroAnimation(p, 1 / 60);
      frames.add(p.animation.frame);
      if (p.animation.frame !== previous) changes.push(tick);
      previous = p.animation.frame;
    }
    assert.deepEqual(
      [...frames].sort((a, b) => a - b),
      [4, 5, 6, 7, 8, 9, 10, 11],
    );
    for (let i = 1; i < changes.length; i++)
      assert.equal(changes[i] - changes[i - 1], 5);
  });

  test(`hero ${hero}: moving landings continue running and stops freeze the gait`, () => {
    const p = player();
    p.hero = hero;
    p.vx = 270;
    updateHeroAnimation(p, 1 / 60);
    assert.equal(p.animation.state, "walk");
    assert.ok(p.animation.walkSpeed > 0 && p.animation.walkSpeed < p.vx);
    for (let i = 0; i < 20; i++) updateHeroAnimation(p, 1 / 60);
    const phase = p.animation.walkPhase;
    p.vx = 0;
    updateHeroAnimation(p, 1 / 60);
    assert.equal(p.animation.state, "idle");
    assert.equal(p.animation.walkPhase, phase);
    assert.equal(p.animation.walkSpeed, 0);
    p.grounded = false;
    p.vy = 200;
    updateHeroAnimation(p, 1 / 60);
    p.grounded = true;
    p.vy = 0;
    p.vx = -270;
    p.dir = -1;
    updateHeroAnimation(p, 1 / 60);
    assert.equal(p.animation.state, "walk");
    assert.ok(p.animation.walkPhase > phase);
  });
}

test("run easing produces the same phase at 30, 60, and 120 Hz", () => {
  const phases = [30, 60, 120].map((hz) => {
    const p = player();
    p.vx = 270;
    for (let i = 0; i < hz; i++) updateHeroAnimation(p, 1 / hz);
    return p.animation.walkPhase;
  });
  for (const phase of phases) assert.ok(Math.abs(phase - phases[0]) < 1e-9);
});

test("both widest-stride poses stay visible in each cycle at 30, 60, and 120 Hz", () => {
  for (const hero of [0, 1]) for (const hz of [30, 60, 120]) for (const dir of [-1, 1]) {
    const p = player();
    Object.assign(p, { hero, dir, vx: 270 * dir });
    for (let i = 0; i < hz * 2; i++) updateHeroAnimation(p, 1 / hz);
    const segments = [];
    for (let i = 0; i < hz * 2; i++) {
      updateHeroAnimation(p, 1 / hz);
      const last = segments.at(-1);
      if (last?.frame === p.animation.frame) last.ticks++;
      else segments.push({ frame: p.animation.frame, ticks: 1 });
    }
    // Ignore possibly partial poses at the sample boundaries.
    const complete = segments.slice(1, -1);
    for (const frame of [4, 6, 8, 10]) {
      const extremes = complete.filter((segment) => segment.frame === frame);
      assert.ok(extremes.length >= 2, `hero ${hero}, ${hz} Hz: missing stride extreme ${frame}`);
      for (const pose of extremes) assert.ok(pose.ticks >= Math.floor(hz / 12));
    }
    for (let i = 1; i < segments.length; i++)
      assert.equal(segments[i].frame, 4 + ((segments[i - 1].frame - 4 + 1) % 8));
  }
});

test("corrected legs are used only for running, including the pose shared with Urmasa's attack", () => {
  const atlas = { runAtlas: {} },
    drawn = [];
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    drawImage(image) {
      drawn.push(image);
    },
  };
  const p = player();
  p.hero = 1;
  p.animation.frame = 7;
  p.animation.state = "walk";
  drawHero(ctx, atlas, p);
  p.animation.state = "attack";
  drawHero(ctx, atlas, p);
  p.animation.state = "idle";
  drawHero(ctx, atlas, p);
  assert.deepEqual(drawn, [atlas.runAtlas, atlas, atlas]);
});

test("running keeps both heroes at a steady height throughout the leaping stride", () => {
  for (const hero of [0, 1]) {
    const p = player();
    Object.assign(p, { hero, vx: 270 });
    Object.assign(p.animation, { state: "walk", walkSpeed: 270, frame: 6 });
    const positions = [];
    const ctx = {
      save() {}, restore() {}, scale() {}, drawImage() {},
      translate(x, y) { positions.push([x, y]); },
    };
    for (const phase of [0, 1, 1.5, 2.5, 3.5, 4, 6.5, 7.5]) {
      p.animation.walkPhase = phase;
      drawHero(ctx, {}, p);
    }
    assert.ok(positions.every((v) => v[1] === 154));
    assert.ok(positions.every((v) => v[0] === 25.5));
    assert.equal(p.y, 100);
    assert.equal(p.grounded, true);
    p.animation.walkPhase = 2.5;
    p.animation.walkSpeed = 135;
    drawHero(ctx, {}, p);
    assert.equal(positions.at(-1)[1], 154);
    p.animation.walkSpeed = 270;
    drawHero(ctx, {}, p, { size: HERO_ATLAS.size * 2 });
    assert.equal(positions.at(-1)[1], 154);
    p.animation.state = "idle";
    drawHero(ctx, {}, p);
    assert.equal(positions.at(-1)[1], 154);
    p.animation.state = "fall";
    p.grounded = false;
    drawHero(ctx, {}, p);
    assert.equal(positions.at(-1)[1], 154);
  }
});
