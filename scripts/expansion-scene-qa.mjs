import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await (process.env.QA_WEBKIT ? webkit : chromium).launch({
  executablePath: process.env.QA_WEBKIT
    ? process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE
    : process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({
  viewport: { width: 1194, height: 834 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
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
      ["background", "terrain", "ledges", "boss-attacks-atlas"].map((k) =>
        load(prefix + "-" + k),
      ),
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
for (let r = 1; r < 6; r++) {
  await page.evaluate((r) => window.fixture.start(r), r);
  for (const scene of ["tunnel", "secret", "arena"]) {
    await page.evaluate((scene) => {
      const { game: g, renderer } = window.fixture;
      const p = g.player;
      p.x = scene === "tunnel" ? 1200 : scene === "secret" ? 2570 : 3650;
      p.y = scene === "tunnel" ? 1396 : scene === "secret" ? 326 : 446;
      g.camera = Math.max(
        0,
        Math.min(g.world.width - renderer.viewWidth, p.x - 400),
      );
      g.cameraY = scene === "tunnel" ? 980 : 0;
      if (scene === "secret")
        g.world.platforms = g.world.platforms.filter((s) => !s.breakable);
      if (scene === "arena") {
        Object.assign(g.world.boss, {
          active: true,
          state: "windup",
          moveIndex: 0,
          timer: 0.4,
          phase: 1,
          elapsed: 0.6,
          label: "ПРИГОТОВЬСЯ",
        });
        g.world.hazards = [
          { x: 3640, y: 380, w: 70, h: 120, delay: 0, total: 1, life: 0.5 },
        ];
      }
      renderer.draw(g);
    }, scene);
    await page.screenshot({ path: `/tmp/expansion-${r}-${scene}.png` });
  }
  // Render every source frame through the production atlas path.
  await page.evaluate(() => {
    const { game: g, renderer } = window.fixture,
      b = g.world.boss;
    for (let moveIndex = 0; moveIndex < 4; moveIndex++)
      for (const state of ["windup", "strike"])
        for (const q of [0, 1]) {
          Object.assign(b, {
            moveIndex,
            state,
            phase: state === "windup" ? 1 : 2,
            timer: q ? 0.2 : 1,
            elapsed: q ? 0.6 : 0.1,
          });
          renderer.draw(g);
        }
    for (const elapsed of [0, 0.5, 1, 1.5]) {
      Object.assign(b, { state: "awaken", elapsed });
      renderer.draw(g);
    }
    for (const hit of [0.15, 0.04]) {
      b.hit = hit;
      renderer.draw(g);
    }
    b.hit = 0;
    for (const deathTime of [0.1, 0.6]) {
      b.dead = true;
      b.deathTime = deathTime;
      renderer.draw(g);
    }
  });
}
assert.deepEqual(errors, []);
console.log(
  "All regional tunnel, secret chamber and boss scenes rendered; 120 new attack poses checked.",
);
await browser.close();
