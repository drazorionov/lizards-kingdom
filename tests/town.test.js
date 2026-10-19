import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine.js";
import { sanitizeProgress } from "../src/world.js";
import { createTown, nearbyResident } from "../src/town.js";
globalThis.window = { addEventListener() {} };
globalThis.document = {
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
function setup(hero = 0) {
  const g = new Game(
    { focus() {} },
    {},
    { viewWidth: 1100, prepare() {} },
    { toast() {}, sound() {}, save() {}, hud() {} },
  );
  g.startTown(sanitizeProgress({ hero, region: 3, checkpoint: true }));
  for (let i = 0; i < 5; i++) g.step(1 / 60);
  return g;
}
function move(g, x, jump = false, y) {
  g.clearInput();
  if (jump) g.press("jump");
  for (let i = 0; i < 700; i++) {
    g.release("left");
    g.release("right");
    if (Math.abs(g.player.x - x) > 3)
      g.press(g.player.x < x ? "right" : "left");
    if (jump && i === 16) {
      g.release("jump");
      g.press("jump");
    }
    g.step(1 / 60);
    if (
      i > 3 &&
      Math.abs(g.player.x - x) <= 3 &&
      g.player.grounded &&
      (y == null || g.player.y + g.player.h === y)
    ) {
      g.clearInput();
      return;
    }
  }
  assert.fail(
    `Cannot reach ${x},${y}: at ${g.player.x},${g.player.y + g.player.h}`,
  );
}
for (const hero of [0, 1])
  test(`hero ${hero} can climb all four town levels and meet every resident`, () => {
    const g = setup(hero),
      met = new Set();
    function meet(id) {
      const n = g.world.npcs.find((n) => n.id === id);
      move(g, n.x - 15, false, n.y);
      assert.equal(nearbyResident(g.world, g.player)?.id, id);
      met.add(id);
    }
    for (const id of ["vart", "rong", "gruk", "dar"]) meet(id);
    move(g, 255);
    move(g, 255, true, 1240);
    move(g, 425, true, 1150);
    move(g, 580, true, 1060);
    for (const id of ["neli", "sola", "keeper"]) meet(id);
    move(g, 2370);
    move(g, 2370, true, 970);
    move(g, 2210, true, 880);
    move(g, 2050, true, 790);
    for (const id of ["child", "kai"]) meet(id);
    move(g, 705);
    move(g, 635, true, 700);
    move(g, 805, true, 610);
    move(g, 975, true, 520);
    for (const id of ["tess", "elder", "stranger"]) meet(id);
    assert.equal(met.size, 12);
    assert.ok(g.cameraY < 300);
    assert.equal(g.progress.region, 3);
    assert.equal(g.progress.checkpoint, true);
    // Return via the open sides, with no fall damage in the settlement.
    move(g, 2550);
    assert.equal(g.player.y + g.player.h, 1330);
    move(g, 110);
    assert.ok(Math.abs(g.world.portals[0].y - g.player.y - 27) < 65);
  });
test("conversation uses NPC elevation and pauses on every level", () => {
  const g = setup();
  let spoke;
  g.cb.interact = (n) => (spoke = n.id);
  for (const n of g.world.npcs) {
    Object.assign(g.player, { x: n.x - 15, y: n.y - 54, vx: 0, vy: 0 });
    assert.equal(
      nearbyResident(g.world, { ...g.player, y: g.player.y + 135 }),
      undefined,
    );
    g.press("attack");
    g.step(1 / 60);
    assert.equal(spoke, n.id);
    assert.equal(g.paused, true);
    g.resume();
  }
});
test("every home has a supported doorstep and worlds do not share mutable residents", () => {
  const w = createTown(0);
  for (const n of w.npcs)
    assert.ok(
      w.platforms.some((s) => s.y === n.y && n.x > s.x && n.x < s.x + s.w),
      n.id,
    );
  w.npcs[0].x = 0;
  assert.notEqual(createTown(0).npcs[0].x, 0);
});
test("fall recovery returns to the root gate with a bounded vertical camera", () => {
  const g = setup();
  g.player.y = g.world.height + 100;
  g.player.vy = 800;
  g.step(1 / 60);
  assert.equal(g.player.y, g.world.spawn.y);
  assert.equal(g.player.x, g.world.spawn.x);
  assert.equal(g.player.vy, 0);
  assert.ok(g.cameraY >= 0 && g.cameraY <= g.world.height - 620);
});
