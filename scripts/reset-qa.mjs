import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
});
const key = "lizards-kingdom-save-v1";
const old = {
  hero: 1,
  mode: "adventure",
  region: 0,
  tokens: { 0: [0, 1, 2] },
  cleared: [0, 1],
  services: ["forge"],
  quests: ["child"],
  checkpoint: true,
  updatedAt: Date.now() - 1000,
};
let remote = old;
await context.route("**/api/progress", async (route) => {
  if (route.request().method() === "PUT")
    remote = route.request().postDataJSON();
  await route.fulfill({
    json:
      route.request().method() === "PUT"
        ? { saved: true }
        : { configured: true, progress: remote },
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(
  ({ key, old }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(old));
  },
  { key, old },
);
const url = process.env.QA_URL || "http://127.0.0.1:5188";
await page.goto(url);
const saved = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
await page.click("#pause");
await page.click("#reset-progress");
await page.waitForSelector("#reset-cancel:focus");
await page.screenshot({ path: "/tmp/kingdom-reset-confirmation.png" });
await page.click("#reset-cancel");
assert.deepEqual((await saved()).tokens[0], [0, 1, 2]);
await page.click("#reset-progress");
await page.click("#reset-confirm");
assert.equal(await page.locator("#start span").textContent(), "Начать путь");
let value = await saved();
assert.ok(value.resetAt > 0);
assert.equal(value.hero, 1);
assert.equal(value.mode, "adventure");
assert.deepEqual(value.cleared, []);
assert.deepEqual(value.tokens[0], []);
// Reload while a stale cloud record is returned. This must not undo the reset.
remote = old;
await page.reload();
await page.waitForFunction(() =>
  document.querySelector("#save-status").textContent.includes("облаке"),
);
assert.deepEqual((await saved()).tokens[0], []);
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.click("#pause");
await page.click("#reset-progress");
await page.click("#reset-cancel");
assert.equal(
  await page.evaluate(() => window.__kingdom.snapshot().paused),
  true,
);
await page.click("#reset-progress");
await page.click("#reset-confirm");
assert.equal(
  await page.evaluate(() => window.__kingdom.snapshot().running),
  false,
);
assert.equal(await page.locator("#game").isVisible(), false);
assert.equal(await page.locator("#start span").textContent(), "Начать путь");
// Reset in another tab must stop a running old journey without persisting it.
const other = await context.newPage();
await other.goto(url);
await other.click("#start");
await other.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.click("#pause");
await page.click("#reset-progress");
await page.click("#reset-confirm");
await other.waitForFunction(() => !window.__kingdom.snapshot()?.running);
assert.equal(await other.locator("#game").isVisible(), false);
assert.deepEqual(errors, []);
console.log(
  "Reset cancellation, confirmation, active play, reload, stale cloud and second-tab behavior verified.",
);
await browser.close();
