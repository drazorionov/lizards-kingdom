import { chromium, webkit } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const type = process.env.QA_WEBKIT ? webkit : chromium;
const browser = await type.launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1194, height: 834 },
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173");
await page.click("#start");
await page.waitForFunction(() => window.__kingdom.snapshot()?.running);
await page.keyboard.press("Escape");
assert.equal(await page.locator("#forest-rematch").count(), 1);
await page.click("#forest-rematch");
await page.waitForTimeout(300);
assert.ok(
  (await page.evaluate(() => window.__kingdom.snapshot().player.x)) >= 3480,
);
await page.keyboard.press("Escape");
await page.click("#home");
// Test fixture imports production classes in the local browser only. No mutation
// API is shipped; screenshots use the same renderer, physics and source assets.
await page.evaluate(async () => {
  const [{ Game }, { Renderer }, { sanitizeProgress }, { forestMapMarkup }] =
    await Promise.all([
      import("/src/engine.js"),
      import("/src/renderer.js"),
      import("/src/world.js"),
      import("/src/forest-renderer.js"),
    ]);
  const assets = {};
  const keys = [
    "background-0",
    "token",
    "elder-atlas",
    "hero-quirel-painted-atlas",
    "hero-urmasa-painted-atlas",
    "forest-canopy",
    "forest-roots",
    "forest-sanctum",
    "forest-terrain",
    "forest-ledges",
    "forest-cave-edges-v2",
    "forest-cave-walls-v2",
    "forest-cave-joins-floor-v2",
    "forest-cave-joins-ceiling-v2",
    "forest-cave-overlays-v1",
    "forest-mother-attacks-atlas",
  ];
  await Promise.all(
    [
      ...keys,
      ...[
        "mushroom-stomper",
        "flying-spore",
        "masked-corvid",
        "spore-mother",
      ].map((k) => k + "-atlas"),
    ].map(async (k) => {
      const im = new Image();
      im.src = "/assets/" + k + ".webp";
      await im.decode();
      assets[
        k.endsWith("-atlas") &&
        ["mushroom", "flying", "masked", "spore"].some((a) => k.startsWith(a))
          ? "creature-" + k.slice(0, -6)
          : k
      ] = im;
    }),
  );
  document.querySelector("#menu").classList.add("hidden");
  document.querySelector("#game").classList.remove("hidden");
  const canvas = document.querySelector("#canvas"),
    renderer = new Renderer(canvas, assets);
  const g = new Game(canvas, assets, renderer, {
    toast() {},
    sound() {},
    save() {},
    hud({ tokens, boss }) {
      document
        .querySelector("#boss-hud")
        .classList.toggle("hidden", !boss.active || boss.dead);
      document.querySelector("#boss-health").style.width =
        (boss.hp / boss.maxHp) * 100 + "%";
      document.querySelector("#token-count").innerHTML = tokens
        .map(
          (t) =>
            '<span class="token-pip ' +
            (t.collected ? "found" : "") +
            '">✧</span>',
        )
        .join("");
    },
    complete() {},
    pause() {},
  });
  document.querySelector("#toast").classList.remove("visible");
  g.start(0, sanitizeProgress({}));
  g.stop();
  renderer.resize();
  window.forestQA = { g, renderer, map: () => forestMapMarkup(g) };
  for (let i = 0; i < 30; i++) g.step(1 / 60);
  renderer.draw(g);
});
await page.waitForTimeout(100);
await page.evaluate(() => window.forestQA.renderer.draw(window.forestQA.g));
await page.screenshot({ path: "/tmp/forest-fields.png" });
const routes = JSON.parse(
  readFileSync(new URL("../tests/forest-expanded-route.json", import.meta.url)),
);
const checkpoints = [40, 100, 170, 220, 280, routes.route.length];
let done = 0;
for (const end of checkpoints) {
  const state = await page.evaluate(
    ({ indices, actions, frames }) => {
      const { g, renderer } = window.forestQA;
      for (const index of indices) {
        const a = actions[index];
        g.release("left");
        g.release("right");
        if (a.dir) g.press(a.dir < 0 ? "left" : "right");
        if (a.jump === "press") {
          g.release("jump");
          g.press("jump");
        }
        g.press("attack");
        for (let i = 0; i < frames; i++) g.step(1 / 60);
      }
      renderer.draw(g);
      return g.snapshot();
    },
    {
      indices: routes.route.slice(done, end),
      actions: routes.actions,
      frames: routes.framesPerAction,
    },
  );
  done = end;
  await page.screenshot({ path: `/tmp/forest-route-${end}.png` });
  assert.ok(state.player.health > 0);
}
assert.equal(
  await page.evaluate(
    () => window.forestQA.g.world.tokens.filter((t) => t.collected).length,
  ),
  4,
);
// Each attack is captured in both its warning and its release pose.
for (const [i, move] of ["roots", "spores", "burrow", "sweep"].entries()) {
  await page.evaluate((i) => {
    const { g, renderer } = window.forestQA;
    g.clearInput();
    g.rematchMother();
    g.player.x = 4350 + g.world.arenaOffset;
    g.player.invulnerable = 30;
    g.world.boss.moveIndex = i;
    for (let n = 0; n < 190; n++) g.step(1 / 60);
    renderer.draw(g);
  }, i);
  await page.screenshot({ path: `/tmp/forest-${move}-warning.png` });
  await page.evaluate(() => {
    const { g, renderer } = window.forestQA;
    for (let n = 0; n < 35; n++) g.step(1 / 60);
    renderer.draw(g);
  });
  await page.screenshot({ path: `/tmp/forest-${move}-attack.png` });
}
await page.evaluate(() => {
  const { g, renderer } = window.forestQA;
  g.world.boss.hp = 12;
  g.world.boss.state = "rest";
  g.world.boss.timer = 0.01;
  g.step(1 / 60);
  for (let n = 0; n < 90; n++) g.step(1 / 60);
  renderer.draw(g);
});
await page.screenshot({ path: "/tmp/forest-awakening.png" });
await page.evaluate(() => {
  document.querySelector("#modal-content").innerHTML =
    "<h2>Туннели Дремучего леса</h2>" + window.forestQA.map();
  document.querySelector("#modal").classList.remove("hidden");
});
await page.screenshot({ path: "/tmp/forest-map.png" });
await page.evaluate(() => {
  document.querySelector("#modal").classList.add("hidden");
  const { g } = window.forestQA;
  g.player.invulnerable = 30;
  g.running = true;
  g.resume();
  g.raf = requestAnimationFrame(g.loop);
});
await page.waitForTimeout(3000);
const perf = await page.evaluate(() => ({
  fps: window.forestQA.renderer.fps,
  pixels:
    document.querySelector("#canvas").width *
    document.querySelector("#canvas").height,
  particles: window.forestQA.g.particles.length,
}));
assert.ok(perf.fps >= 45, JSON.stringify(perf));
assert.ok(perf.pixels <= 1501000);
assert.deepEqual(errors, []);
console.log(
  type.name(),
  perf,
  "Forest route, rematch UI, all attack previews and map passed.",
);
await browser.close();
