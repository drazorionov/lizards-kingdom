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
    await load(`save-shrine-${r}-v1`);
    await Promise.all(
      (r === 0
        ? [
            "canopy",
            "roots",
            "sanctum",
            "terrain",
            "ledges",
            "mother-attacks-atlas",
            "cave-edges-v2",
            "cave-walls-v2",
            "cave-joins-floor-v2",
            "cave-joins-ceiling-v2",
            "cave-overlays-v1",
          ]
        : [
            "background",
            "terrain",
            "ledges",
            "boss-attacks-atlas",
            "surface-v1",
          ]
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
  await page.evaluate((region) => window.fixture.start(region), region);
  const result = await page.evaluate(() => {
    const { game: g, renderer: r } = window.fixture;
    const camp = g.world.checkpoints?.[2] || g.world.checkpoint;
    g.world.checkpoint = camp;
    g.checkpointUsed = true;
    g.player.x = camp.x - 140;
    g.player.y = camp.y + 50 - g.player.h;
    g.camera = Math.max(0, camp.x - r.viewWidth / 2);
    g.cameraY = Math.max(0, Math.min(g.world.height - 620, camp.y + 50 - 450));
    g.time = 2;
    const captions = [],
      beacons = [];
    const fill = r.ctx.fillText.bind(r.ctx),
      beacon = r.beacon.bind(r);
    r.ctx.fillText = (text, ...args) => {
      captions.push(text);
      fill(text, ...args);
    };
    r.beacon = (x, y, ...args) => {
      beacons.push([x, y]);
      beacon(x, y, ...args);
    };
    r.draw(g);
    r.ctx.fillText = fill;
    r.beacon = beacon;
    return {
      localShrines: beacons.filter(
        ([x, y]) => Math.hypot(x - camp.x, y - camp.y - 50) < 150,
      ).length,
      clutter: captions.filter(
        (text) =>
          ["ТЁПЛЫЙ СВЕТ", "ПУТЬ СОХРАНЁН"].includes(text) ||
          g.world.signs.some((s) => s.text === text),
      ),
      artLoaded: !!r.assets[`save-shrine-${g.world.region}-v1`]?.complete,
    };
  });
  assert.equal(result.localShrines, 1);
  assert.deepEqual(result.clutter, []);
  assert.ok(result.artLoaded);
  await page.screenshot({ path: `/tmp/save-shrine-${region}.png` });
}
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Six biome shrines render, healing/save markers are merged, and persistent spot labels are absent.",
);
