import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173/");
await page.waitForFunction(() => document.fonts.status === "loaded");
await page.screenshot({ path: "/tmp/lizards-home.png", fullPage: true });
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/lizards-game.png" });
console.log("Initial:", await page.evaluate(() => window.__kingdom.snapshot()));
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(650);
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(180);
await page.keyboard.up("ArrowUp");
await page.waitForTimeout(80);
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(250);
await page.keyboard.up("ArrowUp");
await page.keyboard.up("ArrowRight");
await page.waitForTimeout(700);
console.log(
  "After movement:",
  await page.evaluate(() => window.__kingdom.snapshot()),
);
console.log(
  "Performance:",
  await page.evaluate(() => window.__kingdom.performance()),
);
await page.keyboard.press("Escape");
await page.locator("#resume").waitFor();
const before = await page.evaluate(() => window.__kingdom.snapshot().player.x);
await page.waitForTimeout(500);
if (
  before !== (await page.evaluate(() => window.__kingdom.snapshot().player.x))
)
  throw new Error("Pause failed");
await page.click("#resume");
await page.keyboard.press("KeyM");
await page.locator(".map-image").waitFor();
await page.keyboard.press("Escape");
const tablet = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const tp = await tablet.newPage();
tp.on("pageerror", (e) => errors.push(e.message));
await tp.goto(process.env.QA_URL || "http://localhost:5173/");
await tp.click("#start");
await tp.waitForFunction(() => window.__kingdom.snapshot()?.running);
await tp.waitForTimeout(500);
if (!(await tp.locator("#touch-controls").isVisible()))
  throw new Error("Touch controls hidden");
await tp.screenshot({ path: "/tmp/lizards-ipad.png" });
await tp
  .locator('[data-control="right"]')
  .dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    bubbles: true,
  });
await tp.waitForTimeout(400);
await tp
  .locator('[data-control="right"]')
  .dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    bubbles: true,
  });
console.log(
  "Tablet position:",
  await tp.evaluate(() => window.__kingdom.snapshot().player.x),
);
console.log("Browser errors:", errors);
await browser.close();
if (errors.length) process.exit(1);
