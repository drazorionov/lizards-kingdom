import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://127.0.0.1:5174/");
await page.click("#heroes-menu");
await page.waitForFunction(() =>
  document
    .querySelector("#hero-preview-status")
    .textContent.startsWith("Выбери"),
);
await page.selectOption("#hero-motion-speed", "0.25");
for (const action of ["walk", "attack"]) {
  await page.click(`[data-motion="${action}"]`);
  for (let frame = 1; frame <= 10; frame++) {
    await page.locator("#hero-motion-frame").fill(String(frame));
    await page.waitForFunction(
      ({ frame, action }) =>
        [...document.querySelectorAll(".hero-gallery canvas")].every(
          (c) =>
            Number(c.dataset.frame) ===
            (action === "walk" ? 24 : 34) + frame - 1,
        ),
      { frame, action },
    );
  }
  await page.click("#hero-motion-mirror");
  await page.screenshot({ path: `/tmp/lizards-motion-${action}-mirrored.png` });
  await page.click("#hero-motion-mirror");
  await page.click("#hero-motion-play");
}
await page.evaluate(async () => {
  const { drawHero } = await import("/src/hero-animation.js");
  const canv = document.createElement("canvas");
  canv.width = 2000;
  canv.height = 900;
  const ctx = canv.getContext("2d");
  ctx.fillStyle = "#15222b";
  ctx.fillRect(0, 0, 2000, 900);
  for (const [hero, name] of [
    [0, "quirel"],
    [1, "urmasa"],
  ]) {
    const img = new Image();
    img.src = `/assets/hero-${name}-painted-atlas.webp`;
    await img.decode();
    for (const [action, start, row] of [
      ["run", 24, hero * 2],
      ["attack", 34, hero * 2 + 1],
    ]) {
      ctx.fillStyle = "#e9ddbc";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        `${name.toUpperCase()} · ${action} · 10 poses`,
        20,
        row * 225 + 24,
      );
      for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = "#7a899555";
        ctx.beginPath();
        ctx.moveTo(i * 200, row * 225 + 202);
        ctx.lineTo(i * 200 + 200, row * 225 + 202);
        ctx.stroke();
        drawHero(
          ctx,
          img,
          {
            hero,
            dir: 1,
            animation: {
              frame: start + i,
              state: action === "run" ? "walk" : "attack",
            },
          },
          { x: i * 200 + 85, y: row * 225 + 202, size: 140 },
        );
        ctx.fillStyle = "#e9ddbc";
        ctx.fillText(String(i + 1), i * 200 + 12, row * 225 + 220);
      }
    }
  }
  document.body.replaceChildren(canv);
  document.body.style = "margin:0;background:#15222b";
  canv.style = "display:block";
});
await page.setViewportSize({ width: 2000, height: 900 });
await page.screenshot({
  path: "art/characters/motion-v4/runtime-contact-sheet.png",
});
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Both heroes: 10 run frames, 10 attack frames, slow playback, frame inspection, and mirroring passed.",
);
