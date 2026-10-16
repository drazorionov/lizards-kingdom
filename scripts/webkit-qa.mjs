import { webkit } from "@playwright/test";
const browser = await webkit.launch({
  executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173/");
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.waitForTimeout(800);
await page.keyboard.down("ArrowRight");
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(300);
await page.keyboard.up("ArrowUp");
await page.keyboard.up("ArrowRight");
console.log(
  "WebKit iPad:",
  await page.evaluate(() => ({
    state: window.__kingdom.snapshot().player,
    performance: window.__kingdom.performance(),
    touchVisible: getComputedStyle(document.querySelector("#touch-controls"))
      .display,
  })),
);
await page.screenshot({ path: "/tmp/lizards-webkit.png" });
await page.click("#pause");
await page.locator("#resume").waitFor();
await page.click("#resume");
await browser.close();
console.log("WebKit errors:", errors);
if (errors.length) process.exit(1);
