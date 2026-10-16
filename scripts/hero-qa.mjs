import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const type = process.env.QA_WEBKIT ? webkit : chromium;
const browser = await type.launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const errors = [];
for (const hero of [0, 1]) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    hasTouch: !!process.env.QA_WEBKIT,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.QA_URL || "http://localhost:5173/");
  await page.click("#heroes-menu");
  await page.waitForFunction(() =>
    document
      .querySelector("#hero-preview-status")
      .textContent.startsWith("Choose"),
  );
  for (const state of ["idle", "walk", "jump"]) {
    await page.click(`[data-motion="${state}"]`);
    await page.waitForTimeout(300);
    if (hero === 0)
      await page.screenshot({ path: `/tmp/lizards-heroes-${state}.png` });
  }
  await page.click("#modal-close");
  await page.click(`[data-hero="${hero}"]`);
  await page.click("#start");
  await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
  await page.waitForTimeout(1300);
  assert.equal(
    await page.evaluate(
      () => window.__kingdom.snapshot().player.animation.state,
    ),
    "idle",
  );
  await page.screenshot({ path: `/tmp/lizards-hero-${hero}-idle.png` });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(220);
  assert.equal(
    await page.evaluate(
      () => window.__kingdom.snapshot().player.animation.state,
    ),
    "walk",
  );
  await page.screenshot({ path: `/tmp/lizards-hero-${hero}-walk.png` });
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(140);
  assert.equal(
    await page.evaluate(
      () => window.__kingdom.snapshot().player.animation.state,
    ),
    "rise",
  );
  await page.screenshot({ path: `/tmp/lizards-hero-${hero}-jump.png` });
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  const before = await page.evaluate(
    () => window.__kingdom.snapshot().player.animation,
  );
  await page.waitForTimeout(250);
  const after = await page.evaluate(
    () => window.__kingdom.snapshot().player.animation,
  );
  assert.deepEqual(after, before);
  await page.click("#resume");
  console.log(
    hero === 0 ? "Quirel" : "Urmasa",
    await page.evaluate(() => ({
      animation: window.__kingdom.snapshot().player.animation.state,
      ...window.__kingdom.performance(),
    })),
  );
  await context.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log("Hero animation browser checks passed.");
