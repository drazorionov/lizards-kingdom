import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createWorld } from "../src/world.js";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
  hasTouch: true,
});
await context.route("**/api/progress", (route) =>
  route.fulfill({ json: { configured: false } }),
);
await context.addInitScript(
  (rooms) =>
    localStorage.setItem(
      "lizards-kingdom-save-v1",
      JSON.stringify({
        region: 0,
        checkpoint: true,
        forestCamp: "lanterns",
        discovered: { 0: rooms },
        updatedAt: Date.now(),
      }),
    ),
  createWorld(0).rooms.map((r) => r.id),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://127.0.0.1:5208");
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
for (const [width, height] of [
  [1194, 834],
  [844, 390],
]) {
  await page.setViewportSize({ width, height });
  await page.screenshot({ path: `/tmp/minimap-${width}.png` });
}
const checks = await page.evaluate(async () => {
  const { createWorld } = await import("/src/world.js");
  const { drawCavernMinimap } = await import("/src/cavern-renderer.js");
  const { minimapLayout, minimapPoint } = await import("/src/minimap.js");
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 620;
  const ctx = canvas.getContext("2d");
  const r = { ctx, viewWidth: 1000, cssScale: 1 };
  const w = createWorld(0);
  const camp = w.checkpoints[2];
  w.checkpoint = camp;
  const game = {
    world: w,
    progress: {},
    checkpointUsed: true,
    player: { x: camp.x, y: camp.y },
  };
  w.discovered = new Set(["lantern-hall"]);
  const labels = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, ...rest) => {
    labels.push(text);
    fillText(text, ...rest);
  };
  drawCavernMinimap(r, game);
  const firstLabels = [...labels];
  const local = minimapLayout(r, w);
  const player = minimapPoint(local, camp.x, camp.y);
  w.discovered = new Set(w.rooms.map((room) => room.id));
  labels.length = 0;
  ctx.clearRect(0, 0, 1000, 620);
  drawCavernMinimap(r, game);
  const full = minimapLayout(r, w);
  const pixels = ctx.getImageData(
    Math.ceil(full.x),
    Math.ceil(full.y),
    Math.floor(full.width),
    Math.floor(full.height),
  ).data;
  let transparent = 0,
    ink = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) transparent++;
    else ink++;
  }
  return {
    firstLabels,
    fullLabels: labels,
    transparent: transparent / (transparent + ink),
    ink,
    localContainsPlayer:
      player[0] >= local.x &&
      player[0] <= local.x + local.width &&
      player[1] >= local.y &&
      player[1] <= local.y + local.height,
    zooms: [local.zoom, full.zoom],
    width: full.width,
  };
});
assert.deepEqual(
  checks.firstLabels.filter((v) => /^\d$/.test(v)),
  ["3"],
  "undiscovered checkpoints stay hidden",
);
assert.deepEqual(
  checks.fullLabels.filter((v) => /^\d$/.test(v)),
  ["1", "2", "3", "4", "5"],
  "all discovered checkpoints appear",
);
assert.ok(
  checks.transparent > 0.65 && checks.ink > 100,
  "readable paths retain a transparent canvas",
);
assert.ok(
  checks.localContainsPlayer && checks.zooms[0] > checks.zooms[1],
  "early discoveries fit the minimap without losing the player",
);
assert.ok(checks.width >= 300);
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Minimap: discovery filtering, checkpoint markers, adaptive zoom, transparent paths, desktop and mobile passed.",
);
