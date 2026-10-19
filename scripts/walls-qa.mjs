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
            "cave-growth-v2",
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
  for (const scene of ["shaft", "chamber", "cliff"]) {
    await page.evaluate((scene) => {
      const { game: g, renderer } = window.fixture;
      g.world.enemies = [];
      const wall =
        scene === "shaft"
          ? g.world.platforms.find((s) => s.wall && s.w === 48)
          : scene === "cliff"
            ? g.world.platforms.find((s) => s.wall && s.w === 250)
            : g.world.platforms.find((s) => s.wall && s.x === 2850);
      Object.assign(g.player, {
        x: wall.x - 30,
        y: wall.y + 160,
        dir: 1,
        vy: 60,
        invulnerable: 100,
      });
      g.camera = wall.x - (scene === "shaft" ? 300 : 580);
      g.cameraY = scene === "cliff" ? 980 : scene === "shaft" ? 350 : 0;
      renderer.draw(g);
    }, scene);
    await page.screenshot({ path: `/tmp/walls-${region}-${scene}.png` });
  }
}
assert.deepEqual(errors, []);
console.log(
  "Six biomes: wall-jump shafts, floor/wall/ceiling chamber joins, and broad cliffs rendered.",
);
await browser.close();
