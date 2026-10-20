import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
});
await context.route("**/api/progress", (r) =>
  r.fulfill({ json: { configured: false } }),
);
await context.addInitScript(() =>
  localStorage.setItem(
    "lizards-kingdom-save-v1",
    JSON.stringify({
      region: 0,
      checkpoint: true,
      forestCamp: "last-root",
      updatedAt: Date.now(),
    }),
  ),
);
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://127.0.0.1:5208");
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
for (const [width, height] of [
  [1194, 834],
  [844, 390],
]) {
  await page.setViewportSize({ width, height });
  await page.click("#pause");
  await page.click("#map-pause");
  await page.waitForFunction(
    () => document.querySelector(".map-viewport")?.scrollLeft > 0,
  );
  const bounds = await page.evaluate(() => {
    const map = document.querySelector(".map-viewport"),
      marker = map.querySelector("svg > circle:last-child");
    const m = map.getBoundingClientRect(),
      p = marker.getBoundingClientRect();
    return {
      width: map.scrollWidth,
      client: map.clientWidth,
      left: p.left - m.left,
      right: p.right - m.left,
    };
  });
  assert.ok(bounds.width > bounds.client);
  assert.ok(
    bounds.left >= 0 && bounds.right <= bounds.client,
    "map opens with the player visible",
  );
  await page.screenshot({ path: `/tmp/forest-map-${width}.png` });
  await page.click("#modal-close");
}
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Desktop and landscape mobile maps retain readable scale and pan to the active rest point.",
);
