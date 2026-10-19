import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://127.0.0.1:5175");
await page.click("#town-menu");
await page.waitForFunction(() => window.__kingdom.snapshot()?.town);
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/town-entry.png" });
// Render the production scene at each elevation, independent of UI overlays.
await page.evaluate(async () => {
  const [{ Game }, { Renderer }, { sanitizeProgress }] = await Promise.all([
    import("/src/engine.js"),
    import("/src/renderer.js"),
    import("/src/world.js"),
  ]);
  const assets = {};
  for (const key of [
    "hero-quirel-painted-atlas",
    "town-tree-painted",
    "town-homes-painted",
    "town-platforms-painted",
    "forest-terrain",
    "town-npcs-0-atlas",
    "town-npcs-1-atlas",
    "town-npcs-2-atlas",
  ]) {
    const im = new Image();
    im.src = "/assets/" + key + ".webp";
    await im.decode();
    assets[key] = im;
  }
  const canvas = document.createElement("canvas");
  canvas.id = "town-fixture";
  canvas.width = 1440;
  canvas.height = 900;
  canvas.style = "position:fixed;inset:0;width:100vw;height:100vh;z-index:1000";
  document.body.append(canvas);
  const renderer = new Renderer(canvas, assets);
  const game = new Game(canvas, assets, renderer, {
    toast() {},
    sound() {},
    save() {},
    hud() {},
  });
  game.startTown(sanitizeProgress({}));
  game.stop();
  window.townFixture = { game, renderer };
});
for (const [name, x, y] of [
  ["roots", 650, 1276],
  ["gardens", 1250, 1006],
  ["homes", 1450, 736],
  ["crown", 1550, 466],
]) {
  await page.evaluate(
    ({ x, y }) => {
      const { game: g, renderer: r } = window.townFixture;
      g.player.x = x;
      g.player.y = y;
      g.camera = Math.max(
        0,
        Math.min(g.world.width - r.viewWidth, x - r.viewWidth * 0.5),
      );
      g.cameraY = Math.max(0, Math.min(g.world.height - 620, y - 330));
      r.draw(g);
    },
    { x, y },
  );
  await page.screenshot({ path: `/tmp/town-${name}.png` });
}
await page.evaluate(() => document.querySelector("#town-fixture").remove());
await page.keyboard.press("KeyM");
await page.waitForSelector(".forest-map svg");
assert.equal(await page.locator(".forest-map svg g").count(), 12);
await page.screenshot({ path: "/tmp/town-map.png" });
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1180, height: 820 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/town-tablet.png" });
assert.ok(await page.evaluate(() => window.__kingdom.performance().fps >= 44));
assert.deepEqual(errors, []);
console.log(
  "Town entry, four elevations, tablet viewport and resident map rendered without browser errors.",
);
await browser.close();
