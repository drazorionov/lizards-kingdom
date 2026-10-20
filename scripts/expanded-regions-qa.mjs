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

for (let region = 1; region < 6; region++) {
  await page.evaluate((r) => window.fixture.start(r), region);
  for (const position of ["entry", "deep", "summit"]) {
    const result = await page.evaluate(
      ({ position }) => {
        const { game: g, renderer: r } = window.fixture;
        const camp =
          g.world.checkpoints[
            position === "entry" ? 0 : position === "deep" ? 2 : 4
          ];
        g.player.x = camp.x;
        g.player.y = camp.y - 4;
        g.camera = Math.max(
          0,
          Math.min(g.world.width - r.viewWidth, g.player.x - r.viewWidth / 2),
        );
        g.cameraY = Math.max(
          0,
          Math.min(g.world.height - 620, g.player.y - 350),
        );
        g.time = 3;
        const start = performance.now();
        r.draw(g);
        const first = performance.now() - start;
        const warm = performance.now();
        for (let i = 0; i < 30; i++) {
          g.camera += 0.1;
          r.draw(g);
        }
        const frame = (performance.now() - warm) / 30;
        document.querySelector("#game h2")?.replaceChildren(g.region.name);
        return {
          first,
          frame,
          width: g.world.width,
          height: g.world.height,
          material: !!r.assets[g.world.artKey + "-surface-v1"],
        };
      },
      { position },
    );
    assert.ok(result.material);
    assert.ok(result.frame < 100, `region ${region}: cached terrain too slow`);
    console.log(region, position, JSON.stringify(result));
    await page.screenshot({ path: `/tmp/expanded-${region}-${position}.png` });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => {
    const { game: g, renderer: r } = window.fixture;
    r.draw(g);
  });
  await page.screenshot({ path: `/tmp/expanded-${region}-tablet.png` });
  await page.setViewportSize({ width: 1194, height: 834 });
}
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Five expanded biomes: entry, deep route, summit and tablet rendering verified.",
);
