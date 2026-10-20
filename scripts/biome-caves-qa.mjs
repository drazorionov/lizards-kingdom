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

for (const region of [1, 4, 5]) {
  await page.evaluate((r) => window.fixture.start(r), region);
  const readings = await page.evaluate(async (region) => {
    const { drawCaveTerrain, drawCaveConnections } = await import(
      "/src/forest-cave-surfaces.js"
    );
    const { exposedTerrainEdges } = await import("/src/wall-surfaces.js");
    const { terrainArtKeys } = await import("/src/terrain-art.js");
    const { game, assets } = window.fixture;
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 620;
    const ctx = canvas.getContext("2d");
    const solid = [
      { id: 1, x: 100, y: 100, w: 55, h: 400, solid: true },
      { id: 2, x: 300, y: 100, w: 400, h: 55, solid: true },
    ];
    const world = {
      region,
      artKey: game.world.artKey,
      width: 1000,
      height: 620,
      platforms: solid,
    };
    const faces = solid.map((s) => ({
      s,
      edges: exposedTerrainEdges(s, solid),
    }));
    const renderer = { ctx, assets, viewWidth: 1000 },
      state = { world, camera: 0, cameraY: 0 };
    drawCaveTerrain(renderer, state, faces, solid);
    const peak = (x, y, w, h) => {
      const p = ctx.getImageData(x, y, w, h).data;
      let max = 0;
      for (let i = 0; i < p.length; i += 4)
        max = Math.max(max, p[i], p[i + 1], p[i + 2]);
      return max;
    };
    const result = {
      wallCore: peak(125, 180, 5, 240),
      roofCore: peak(380, 125, 240, 5),
      left: peak(100, 180, 5, 240),
      right: peak(150, 180, 5, 240),
      floor: peak(380, 100, 240, 5),
      ceiling: peak(380, 150, 240, 5),
    };
    const cornerSolids = [
      { id: 3, x: 100, y: 200, w: 150, h: 350, solid: true },
      { id: 4, x: 250, y: 450, w: 300, h: 100, solid: true },
      { id: 5, x: 650, y: 100, w: 200, h: 100, solid: true },
      { id: 6, x: 800, y: 200, w: 50, h: 250, solid: true },
    ];
    const cornerWorld = { ...world, platforms: cornerSolids };
    const cornerFaces = cornerSolids.map((s) => ({
      s,
      edges: exposedTerrainEdges(s, cornerSolids),
    }));
    ctx.clearRect(0, 0, 1000, 620);
    const used = new Set(),
      native = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...args) {
      for (const key of terrainArtKeys(region))
        if (assets[key] === im) used.add(key);
      return native.call(this, im, ...args);
    };
    try {
      drawCaveConnections(
        renderer,
        { ...state, world: cornerWorld },
        cornerFaces,
      );
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = native;
    }
    const pixels = ctx.getImageData(0, 0, 1000, 620).data;
    let coverage = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) coverage++;
    result.joinCoverage = coverage;
    result.cornerSheets = [...used];
    for (const key of terrainArtKeys(region)) {
      const im = assets[key],
        probe = document.createElement("canvas");
      probe.width = im.width;
      probe.height = im.height;
      const c = probe.getContext("2d");
      c.drawImage(im, 0, 0);
      const bytes = c.getImageData(0, 0, im.width, im.height).data;
      let empty = 0;
      for (let i = 3; i < bytes.length; i += 4) if (bytes[i] === 0) empty++;
      if (empty < (bytes.length / 4) * 0.15)
        throw new Error(key + ": expected clear alpha gutters");
    }
    return result;
  }, region);
  assert.equal(readings.wallCore, 12);
  assert.equal(readings.roofCore, 12);
  for (const side of ["left", "right", "floor", "ceiling"])
    assert.ok(readings[side] > 30, `${region} ${side} visible material`);
  assert.equal(
    readings.cornerSheets.length,
    2,
    "both floor and ceiling corner sheets are used",
  );
  assert.ok(
    readings.joinCoverage > 200,
    "corners visibly paint into the terrain mask",
  );
  console.log(region, JSON.stringify(readings));
  await page.evaluate(() => {
    const { game: g, renderer: r } = window.fixture;
    const c = g.world.checkpoints[0];
    g.player.x = c.x;
    g.player.y = c.y - 4;
    g.camera = Math.max(0, c.x - 400);
    g.cameraY = Math.max(0, Math.min(g.world.height - 620, c.y - 400));
    r.draw(g);
    document.querySelector("#game h2")?.replaceChildren(g.region.name);
  });
  await page.screenshot({ path: `/tmp/biome-caves-${region}.png` });
}
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Three biome atlases: directional strips, real corner imagery, transparent gutters and dark thin-wall cores verified.",
);
