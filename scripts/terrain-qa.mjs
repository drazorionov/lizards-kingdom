import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await (process.env.QA_WEBKIT ? webkit : chromium).launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://localhost:5173");
await page.evaluate(async () => {
  const [
    { Game },
    { Renderer },
    { sanitizeProgress },
    { REGION_KEYS },
    { BOSSES, REGION_CREATURES },
  ] = await Promise.all([
    import("/src/engine.js"),
    import("/src/renderer.js"),
    import("/src/world.js"),
    import("/src/regions.js"),
    import("/src/creatures.js"),
  ]);
  const assets = {
    expansion: await fetch("/assets/expansion.json").then((r) => r.json()),
  };
  const load = async (key, path = key) => {
    if (assets[key]) return;
    const im = new Image();
    im.src = "/assets/" + path + ".webp";
    await im.decode();
    assets[key] = im;
  };
  await Promise.all(
    [
      "hero-quirel-painted-atlas",
      "hero-urmasa-painted-atlas",
      "elder-atlas",
      "vertical-walls-painted",
      ...Array.from({ length: 5 }, (_, i) => "token-type-" + i),
    ].map((k) => load(k)),
  );
  document.querySelector("#menu").classList.add("hidden");
  document.querySelector("#game").classList.remove("hidden");
  const renderer = new Renderer(document.querySelector("#canvas"), assets);
  window.fixture = { renderer, load, assets };
  window.fixture.start = async (r) => {
    const prefix = REGION_KEYS[r];
    const { terrainArtKeys } = await import("/src/terrain-art.js");
    await Promise.all(terrainArtKeys(r).map((key) => load(key)));
    await Promise.all(
      (r === 0
        ? [
            "canopy",
            "roots",
            "sanctum",
            "terrain",
            "ledges",
            "cave-edges-v2",
            "cave-walls-v2",
            "cave-joins-floor-v2",
            "cave-joins-ceiling-v2",
            "cave-overlays-v1",
            "mother-attacks-atlas",
          ]
        : ["background", "terrain", "ledges", "boss-attacks-atlas"]
      ).map((k) => load(prefix + "-" + k)),
    );
    await Promise.all(
      [...REGION_CREATURES[r], BOSSES[r]].map((k) =>
        load("creature-" + k, k + "-atlas"),
      ),
    );
    const g = new Game(document.querySelector("#canvas"), assets, renderer, {
      toast() {},
      sound() {},
      save() {},
      hud() {},
      pause() {},
      complete() {},
    });
    g.start(r, sanitizeProgress({ region: r }));
    g.stop();
    window.fixture.game = g;
  };
});

for (let region = 0; region < 6; region++) {
  await page.evaluate((r) => window.fixture.start(r), region);
  await page.evaluate(() => {
    const { game: g, renderer } = window.fixture;
    g.world.enemies = [];
    const wall = g.world.platforms.find((s) => s.secret && s.breakable);
    Object.assign(g.player, {
      x: wall.x - 40,
      y: wall.y + wall.h - 70,
      dir: 1,
      invulnerable: 100,
    });
    g.camera = wall.x - 380;
    g.cameraY = 0;
    renderer.draw(g);
  });
  await page.screenshot({ path: `/tmp/terrain-${region}-intact.png` });
  for (const [phase, frames] of [
    ["impact", 8],
    ["falling", 22],
    ["settled", 40],
    ["clear", 65],
  ]) {
    const count = await page.evaluate(
      ({ frames, phase }) => {
        const { game: g, renderer } = window.fixture;
        if (phase === "impact") g.press("attack");
        for (let i = 0; i < frames; i++) g.step(1 / 60);
        g.clearInput();
        g.camera = 2000;
        g.cameraY = 0;
        renderer.draw(g);
        return g.wallDebris.length;
      },
      { frames, phase },
    );
    assert.equal(
      count > 0,
      phase !== "clear",
      `${region}: ${phase} debris lifecycle`,
    );
    await page.screenshot({ path: `/tmp/terrain-${region}-${phase}.png` });
  }
}
assert.deepEqual(errors, []);
console.log(
  "All six terrain palettes and intact, impact, falling, settled and cleared wall states rendered without errors.",
);
await browser.close();
