import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await (process.env.QA_WEBKIT ? webkit : chromium).launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173");
await page.click("#town-menu");
await page.waitForFunction(() => window.__kingdom.snapshot()?.town);
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/expansion-town.png" });
await page.keyboard.down("ArrowRight");
await page.waitForFunction(() => window.__kingdom.snapshot().player.x > 350);
await page.keyboard.up("ArrowRight");
await page.keyboard.press("Space");
await page.waitForSelector("#resident-done");
assert.match(await page.locator("#modal-title").textContent(), /Ронг/);
await page.screenshot({ path: "/tmp/expansion-resident.png" });
await page.click("#resident-done");
await page.keyboard.down("ArrowRight");
await page.waitForFunction(() => window.__kingdom.snapshot().player.x > 865);
await page.keyboard.up("ArrowRight");
await page.keyboard.press("Space");
await page.waitForSelector("#resident-reward");
await page.click("#resident-reward");
assert.match(
  await page.locator("#modal-content").textContent(),
  /Дар уже с тобой/,
);
await page.click("#resident-done");
await page.keyboard.press("Escape");
await page.click("#growth-pause");
await page.screenshot({ path: "/tmp/expansion-growth.png" });
assert.equal(await page.locator(".token-types article").count(), 5);
await page.click("#modal-close");
await page.keyboard.press("Escape");
await page.click("#home");
// Seed ordinary persisted unlocks, then use public travel buttons to load each area.
await page.evaluate(() => {
  const key = "lizards-kingdom-save-v1",
    p = JSON.parse(localStorage.getItem(key));
  p.cleared = [0, 1, 2, 3, 4, 5];
  p.defeated = [];
  p.checkpoint = false;
  localStorage.setItem(key, JSON.stringify(p));
});
await page.reload();
for (let r = 0; r < 6; r++) {
  await page.click(`[data-region="${r}"]`);
  await page.waitForFunction(
    (r) =>
      window.__kingdom.snapshot()?.region === r &&
      window.__kingdom.snapshot()?.running &&
      !window.__kingdom.snapshot()?.town,
    r,
  );
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `/tmp/expansion-region-${r}.png` });
  await page.waitForTimeout(1500);
  const perf = await page.evaluate(() => window.__kingdom.performance());
  assert.ok(perf.fps >= 44, JSON.stringify({ r, perf }));
  await page.keyboard.press("KeyM");
  assert.equal(await page.locator(".secret-list span").count(), 5);
  await page.screenshot({ path: `/tmp/expansion-map-${r}.png` });
  await page.click("#modal-close");
  await page.keyboard.press("Escape");
  await page.click("#forest-rematch");
  await page.waitForTimeout(4200);
  assert.ok(
    (await page.evaluate(() => window.__kingdom.snapshot())).boss.active,
  );
  await page.keyboard.press("Escape");
  await page.click("#home");
}
assert.deepEqual(errors, []);
console.log(
  "Town, NPC rewards, progression, six region maps and frame rates passed",
  process.env.QA_WEBKIT ? "WebKit" : "Chromium",
);
await browser.close();
