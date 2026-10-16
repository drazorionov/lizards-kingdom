import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const type = process.env.QA_WEBKIT ? webkit : chromium;
const browser = await type.launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173/");
assert.equal(await page.locator("html").getAttribute("lang"), "ru");
await page.screenshot({ path: "/tmp/lizards-painted-menu.png" });
await page.click("#bestiary-menu");
for (let r = 0; r < 6; r++) {
  await page.click(`[data-beasts="${r}"]`);
  await page.waitForFunction(() =>
    document.querySelector("#beast-status")?.textContent.startsWith("Выбери"),
  );
  for (const motion of ["idle", "move", "attack", "hit", "defeat"]) {
    await page.click(`[data-beast-motion="${motion}"]`);
    await page.waitForTimeout(180);
  }
  await page.click('[data-beast-motion="move"]');
  await page.screenshot({ path: `/tmp/lizards-beasts-${r}.png` });
}
await page.click("#modal-close");
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.waitForTimeout(1400);
const snapshot = await page.evaluate(() => window.__kingdom.snapshot());
assert.equal(new Set(snapshot.enemies.map((e) => e.key)).size, 3);
assert.ok(snapshot.platforms.some((p) => p.wall));
assert.ok(await page.locator("#touch-controls").isVisible());
// Real touch events exercise pointer capture and simultaneous fingers.
if (!process.env.QA_WEBKIT) {
  const cdp = await context.newCDPSession(page);
  const right = await page.locator('[data-control="right"]').boundingBox();
  const jump = await page.locator('[data-control="jump"]').boundingBox();
  const point = (r, id) => ({
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
    id,
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(right, 1)],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(right, 1), point(jump, 2)],
  });
  await page.waitForTimeout(180);
  const moved = await page.evaluate(() => window.__kingdom.snapshot().player);
  assert.ok(moved.x > snapshot.player.x);
  assert.ok(moved.y < snapshot.player.y);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
} else {
  await page.keyboard.down("ArrowRight");
  await page.locator('[data-control="jump"]').tap();
  await page.waitForTimeout(100);
  const moved = await page.evaluate(() => window.__kingdom.snapshot().player);
  assert.ok(moved.x > snapshot.player.x);
  assert.ok(moved.y < snapshot.player.y);
  await page.keyboard.up("ArrowRight");
}
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/lizards-painted-game.png" });
await page.waitForTimeout(2500);
const perf = await page.evaluate(() => window.__kingdom.performance());
console.log(type.name(), perf);
assert.ok(perf.fps >= 45, "desktop browser animation frame rate");
await context.close();
await browser.close();
assert.deepEqual(errors, []);
console.log(
  "Russian UI, 18 creature previews and two-pointer controls passed.",
);
