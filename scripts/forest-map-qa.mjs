import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
  hasTouch: true,
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
  await page.screenshot({ path: `/tmp/forest-controls-${width}.png` });
  const ui = await page.evaluate(() => {
    const style = (selector) =>
      getComputedStyle(document.querySelector(selector));
    const toast = document.querySelector(".toast").getBoundingClientRect();
    return {
      controls: Number(style(".touch-controls button").opacity),
      caption: Number(style(".touch-caption").opacity),
      menu: Number(style(".menu-toggle").opacity),
      toastBackground: style(".toast").backgroundColor,
      toastSize: parseFloat(style(".toast").fontSize),
      toastCenter: toast.left + toast.width / 2,
    };
  });
  assert.ok(ui.controls >= 0.65 && ui.caption >= 0.7 && ui.menu >= 0.7);
  assert.equal(ui.toastBackground, "rgba(0, 0, 0, 0)");
  assert.ok(
    ui.toastSize >= 14 &&
      ui.toastSize <= 20 &&
      Math.abs(ui.toastCenter - width / 2) < 1,
  );
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
      background: getComputedStyle(map.parentElement).backgroundColor,
      border: getComputedStyle(map.parentElement).borderTopWidth,
      filledBackdrop: !!map.querySelector("svg > rect"),
      boxedLabels: !!map.querySelector("text[stroke]"),
      centeredLabels: [...map.querySelectorAll("text")].every(
        (label) => label.getAttribute("text-anchor") === "middle",
      ),
    };
  });
  assert.ok(bounds.width > bounds.client);
  assert.equal(bounds.background, "rgba(0, 0, 0, 0)");
  assert.equal(bounds.border, "0px");
  assert.ok(
    !bounds.filledBackdrop && !bounds.boxedLabels && bounds.centeredLabels,
  );
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
