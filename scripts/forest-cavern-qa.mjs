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
            "mother-attacks-atlas",
            "cave-floors",
            "cave-ceilings",
            "cave-walls",
            "cave-corners-floor-left",
            "cave-corners-floor-right",
            "cave-corners-ceiling-left",
            "cave-corners-ceiling-right",
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

await page.evaluate(() => window.fixture.start(0));
const joins = await page.evaluate(async () => {
  const { drawCaveConnections } = await import("/src/forest-cave-surfaces.js");
  const { exposedTerrainEdges } = await import("/src/wall-surfaces.js");
  const { game, assets } = window.fixture;
  const solid = game.world.platforms.filter((s) => s.solid);
  const faces = solid.map((s) => ({ s, edges: exposedTerrainEdges(s, solid) }));
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 620;
  const ctx = canvas.getContext("2d");
  ctx.translate(-1000, 0);
  drawCaveConnections(
    { ctx, assets, viewWidth: 1000 },
    { world: game.world, camera: 1000, cameraY: 0 },
    faces,
    solid,
  );
  const coverage = (x, y, w, h) => {
    const pixels = ctx.getImageData(x - 1000, y, w, h).data;
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32) count++;
    return count;
  };
  return {
    shortStep: coverage(1525, 495, 24, 40),
    horizontalArm: coverage(1170, 420, 25, 20),
    verticalArm: coverage(1140, 450, 20, 25),
    paintedRim: coverage(1136, 438, 4, 25),
  };
});
assert.ok(joins.shortStep > 60, "the short step actually draws corner artwork");
assert.ok(
  joins.horizontalArm > 100 && joins.verticalArm > 100,
  "join artwork remains visible along both connecting surfaces",
);
assert.ok(
  joins.paintedRim > 10,
  "the painted rim is not clipped at the collider rectangle",
);
for (const [scene, x, y, camera, cameraY] of [
  ["fields", 280, 446, 0, 0],
  ["upper-loop", 1260, 360, 820, 0],
  ["roots", 1050, 996, 700, 680],
  ["shaft", 1850, 750, 1450, 300],
  ["stream", 2050, 1396, 1700, 980],
  ["refuge", 2250, 996, 1900, 680],
  ["thicket", 2800, 605, 2450, 350],
  ["tree", 3650, 446, 3400, 0],
]) {
  await page.evaluate(
    ({ x, y, camera, cameraY }) => {
      const { game: g, renderer } = window.fixture;
      Object.assign(g.player, { x, y, invulnerable: 100 });
      g.camera = camera;
      g.cameraY = cameraY;
      renderer.draw(g);
    },
    { x, y, camera, cameraY },
  );
  await page.screenshot({ path: `/tmp/forest-cavern-${scene}.png` });
  if (scene === "fields" || scene === "stream")
    await page.screenshot({ path: `art/forest-caverns/${scene}-preview.png` });
  if (scene === "shaft") {
    const interior = await page.evaluate(() => {
      const { game: g, renderer: r } = window.fixture;
      return [
        ...r.ctx.getImageData(
          Math.floor((1600 - g.camera) * r.scale),
          Math.floor((700 - g.cameraY) * r.scale),
          1,
          1,
        ).data,
      ];
    });
    assert.ok(
      Math.max(...interior.slice(0, 3)) < 20,
      "Earth well away from exposed boundaries stays near-black",
    );
  }
}
await page.evaluate(() => {
  const { game: g, renderer } = window.fixture;
  const wall = g.world.platforms.find((s) => s.secret && s.breakable);
  Object.assign(g.player, {
    x: wall.x - 40,
    y: wall.y + wall.h - 70,
    dir: 1,
    invulnerable: 100,
  });
  g.camera = 2000;
  g.cameraY = 0;
  renderer.draw(g);
});
await page.screenshot({ path: "/tmp/forest-cavern-wall-intact.png" });
for (const [phase, frames] of [
  ["impact", 8],
  ["falling", 22],
  ["clear", 105],
]) {
  const count = await page.evaluate(
    ({ phase, frames }) => {
      const { game: g, renderer } = window.fixture;
      if (phase === "impact") g.press("attack");
      for (let i = 0; i < frames; i++) g.step(1 / 60);
      g.clearInput();
      g.camera = 2000;
      g.cameraY = 0;
      renderer.draw(g);
      return g.wallDebris.length;
    },
    { phase, frames },
  );
  assert.equal(
    count > 0,
    phase !== "clear",
    `Forest ${phase} debris lifecycle`,
  );
  await page.screenshot({ path: `/tmp/forest-cavern-wall-${phase}.png` });
}
await page.evaluate(async () => {
  const { cavernMapMarkup } = await import("/src/cavern-renderer.js");
  const g = window.fixture.game;
  g.world.rooms.forEach((r) => g.world.discovered.add(r.id));
  g.world.tokens.forEach((t) => (t.revealed = true));
  document.body.innerHTML =
    '<main style="height:100vh;background:#051112;padding:32px;box-sizing:border-box;display:grid;align-content:center;color:#d9d5b5"><h1 style="font-size:22px;letter-spacing:3px;margin-bottom:30px">ДРЕМУЧИЙ ГРИБНОЙ ЛЕС · ПЕЩЕРЫ И ОБРАТНЫЕ ПУТИ</h1>' +
    cavernMapMarkup(g) +
    "</main>";
  document.querySelector(".secret-list")?.remove();
  document.querySelector("svg").style.maxHeight = "620px";
});
await page.screenshot({ path: "art/forest/forest-layout-preview.png" });
assert.deepEqual(errors, []);
console.log(
  "Forest cavern rooms, shafts, both loops and geometry-derived map rendered.",
);
await browser.close();
