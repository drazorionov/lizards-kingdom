import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleWalkFoot,
  walkRigPose,
  WALK_STRIDE,
  HERO_LEGS,
} from "../src/hero-walk-rig.js";
import {
  createHeroAnimation,
  updateHeroAnimation,
  drawHero,
} from "../src/hero-animation.js";
const close = (a, b, epsilon = 1e-6) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
test("running cadence is ten percent faster at the same travel speed", () => {
  for (const hero of [0, 1]) {
    const p = {
      hero,
      grounded: true,
      vx: 110,
      vy: 0,
      jumps: 0,
      animation: createHeroAnimation(),
    };
    p.animation.grounded = true;
    updateHeroAnimation(p, 0.25);
    close(p.animation.walkPhase, 2.75); // Previously 2.5 at 110 world units/sec.
  }
});
test("planted feet cancel world movement instead of sliding", () => {
  for (const speed of [80, 210, 270]) {
    const dt = 1 / 600,
      phaseRate = (speed / WALK_STRIDE) * 10;
    for (let phase = 0.1; phase < 2.8; phase += 0.2) {
      const before = sampleWalkFoot(phase),
        after = sampleWalkFoot(phase + phaseRate * dt);
      close(before.lift, 0);
      close(after.lift, 0);
      close(after.x - before.x + speed * dt, 0);
      for (const hero of [0, 1]) {
        const a = walkRigPose(hero, phase, 1).legs[1].contact;
        const b = walkRigPose(hero, phase + phaseRate * dt, 1).legs[1].contact;
        close(a.y, 0);
        close(b.y, 0);
        close(b.x - a.x + speed * dt, 0);
      }
    }
  }
});
test("ten running keys interpolate continuously through contact and heel recovery", () => {
  for (let phase = 0; phase < 10; phase += 0.01) {
    const p = sampleWalkFoot(phase);
    assert.ok(p.lift >= -1e-8 && p.lift <= 26.1);
  }
  for (let key = 0; key < 10; key++) {
    const l = sampleWalkFoot(key - 1e-6),
      r = sampleWalkFoot(key + 1e-6);
    close(l.x, r.x, 0.0001);
    close(l.lift, r.lift, 0.0001);
  }
  close(sampleWalkFoot(10).x, sampleWalkFoot(0).x);
});
test("both legs keep their bone lengths and remain reachable at every phase", () => {
  for (const hero of [0, 1])
    for (const blend of [0, 0.25, 0.5, 0.75, 1])
      for (let phase = 0; phase < 10; phase += 0.025) {
        const pose = walkRigPose(hero, phase, blend);
        for (const leg of pose.legs) {
          close(
            Math.hypot(leg.hip.x - leg.knee.x, leg.hip.y - leg.knee.y),
            HERO_LEGS[hero].thigh,
          );
          close(
            Math.hypot(leg.knee.x - leg.ankle.x, leg.knee.y - leg.ankle.y),
            HERO_LEGS[hero].shin,
          );
          assert.ok(leg.ankle.y < 0);
          const cross =
            (leg.ankle.x - leg.hip.x) * (leg.knee.y - leg.hip.y) -
            (leg.ankle.y - leg.hip.y) * (leg.knee.x - leg.hip.x);
          assert.ok(
            cross < 0,
            "both knees bend to the forward side, never reverse",
          );
        }
        const { idleHip, walkHip, ankleHeight, footScale } = HERO_LEGS[hero];
        assert.ok(
          Math.abs(
            pose.body.y -
              (idleHip +
                (walkHip - idleHip) * blend -
                ankleHeight * (footScale - 1)),
          ) <= 2.01,
        );
      }
});
test("resting legs are nearly straight and feet align beneath the torso", () => {
  for (const hero of [0, 1]) {
    for (const elapsed of [0, 0.8, 2.4]) {
      const pose = walkRigPose(hero, 0, 0, elapsed);
      for (const { hip, knee, ankle } of pose.legs) {
        const length = HERO_LEGS[hero].thigh + HERO_LEGS[hero].shin;
        assert.ok(Math.hypot(ankle.x - hip.x, ankle.y - hip.y) / length > 0.97);
        assert.ok(Math.abs(ankle.x - hip.x) <= 1);
        assert.ok(Math.abs(knee.x - hip.x) < 7);
        assert.ok(knee.y > hip.y && knee.y < ankle.y);
      }
    }
  }
});
test("far and near feet are half a cycle apart", () => {
  for (let phase = 0; phase < 10; phase += 0.1) {
    const [far, near] = walkRigPose(0, phase, 1).legs;
    close(far.pitch, sampleWalkFoot(phase + 5).pitch);
    close(near.pitch, sampleWalkFoot(phase).pitch);
    close(far.contact.y, -sampleWalkFoot(phase + 5).lift - 0.6);
    close(near.contact.y, -sampleWalkFoot(phase).lift);
  }
});
test("run folds the heel behind the knee, passes forward, then extends to land", () => {
  for (const hero of [0, 1]) {
    const recovery = walkRigPose(hero, 5).legs[1];
    assert.ok(recovery.ankle.y < recovery.knee.y);
    assert.ok(recovery.ankle.x < recovery.knee.x);
    const passing = walkRigPose(hero, 7).legs[1];
    assert.ok(passing.knee.x > passing.hip.x);
    assert.ok(passing.ankle.x < passing.knee.x);
    assert.ok(walkRigPose(hero, 4).legs.every((l) => l.contact.y < -1));
    const landing = walkRigPose(hero, 0).legs[1];
    close(landing.contact.y, 0);
    assert.ok(landing.pitch < 0 && recovery.pitch > 0.5);
  }
});
test("walk starts and stops ease geometry; pause cannot advance it", () => {
  const p = {
    hero: 0,
    grounded: true,
    vx: 270,
    vy: 0,
    jumps: 0,
    animation: createHeroAnimation(),
  };
  p.animation.grounded = true;
  updateHeroAnimation(p, 1 / 60);
  assert.ok(p.animation.walkBlend > 0 && p.animation.walkBlend < 0.3);
  for (let i = 0; i < 30; i++) updateHeroAnimation(p, 1 / 60);
  const before = p.animation.walkBlend;
  p.vx = 0;
  updateHeroAnimation(p, 1 / 60);
  assert.ok(p.animation.walkBlend < before && p.animation.walkBlend > 0.5);
  const phase = p.animation.walkPhase;
  for (let i = 0; i < 60; i++) updateHeroAnimation(p, 1 / 60);
  close(p.animation.walkPhase, phase);
  assert.ok(p.animation.walkBlend < 0.001);
  const snapshot = structuredClone(p.animation);
  updateHeroAnimation(p, 0);
  assert.deepEqual(p.animation, snapshot);
});
test("rig keeps both feet and every body layer opaque, including hit tint", () => {
  const calls = [],
    alpha = [],
    filters = [];
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    set globalAlpha(v) {
      alpha.push(v);
    },
    get filter() {
      return "none";
    },
    set filter(v) {
      filters.push(v);
    },
    drawImage(...args) {
      calls.push(args);
    },
  };
  drawHero(
    ctx,
    "legacy",
    {
      hero: 0,
      dir: -1,
      animation: { state: "walk", frame: 24, walkPhase: 2.5, walkBlend: 1 },
    },
    { rig: "rig", x: 0, y: 0, hitTint: true },
  );
  assert.equal(calls.length, 9);
  assert.ok(calls.every((c) => c[0] === "rig"));
  assert.deepEqual(alpha, [1]);
  assert.ok(filters.some((f) => f.includes("sepia")));
  const legRectangles = calls.slice(2, 8).map((c) => c.slice(1, 5).join(","));
  assert.equal(
    new Set(legRectangles).size,
    6,
    "each leg uses its own thigh, shin and foot artwork",
  );
});
