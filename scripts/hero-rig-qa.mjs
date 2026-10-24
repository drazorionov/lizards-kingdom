import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.QA_URL || "http://127.0.0.1:5175/");
await page.click("#heroes-menu");
await page.waitForFunction(() =>
  document
    .querySelector("#hero-preview-status")
    ?.textContent.startsWith("Выбери"),
);
await page.click('[data-motion="walk"]');
await page.selectOption("#hero-motion-speed", "0.25");
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/lizards-rig-gallery.png" });
for (const frame of [1, 4, 7, 10]) {
  await page.locator("#hero-motion-frame").fill(String(frame));
  await page.waitForFunction(
    (f) =>
      [...document.querySelectorAll(".hero-gallery canvas")].every(
        (c) => +c.dataset.frame === 23 + f,
      ),
    frame,
  );
}
await page.click("#hero-motion-mirror");
await page.screenshot({ path: "/tmp/lizards-rig-mirrored.png" });
const result = await page.evaluate(async () => {
  const { drawHero } = await import("/src/hero-animation.js");
  const { walkRigPose, RUN_PHASES } = await import("/src/hero-walk-rig.js");
  const assets = {};
  for (const name of ["quirel", "urmasa"])
    for (const suffix of ["painted-atlas", "walk-rig-v5"]) {
      const im = new Image();
      im.src = `/assets/hero-${name}-${suffix}.webp`;
      await im.decode();
      assets[`${name}-${suffix}`] = im;
    }
  const contact = document.createElement("canvas");
  contact.width = 2400;
  contact.height = 800;
  const g = contact.getContext("2d");
  g.fillStyle = "#15222b";
  g.fillRect(0, 0, contact.width, contact.height);
  const standing = document.createElement("canvas");
  standing.width = 1000;
  standing.height = 360;
  const s = standing.getContext("2d");
  s.fillStyle = "#15222b";
  s.fillRect(0, 0, 1000, 360);
  const stats = [];
  for (const [hero, name] of [
    [0, "quirel"],
    [1, "urmasa"],
  ]) {
    const cx = hero * 500 + 250;
    s.strokeStyle = "#667783";
    s.beginPath();
    s.moveTo(cx - 200, 295);
    s.lineTo(cx + 200, 295);
    s.stroke();
    drawHero(
      s,
      assets[`${name}-painted-atlas`],
      {
        hero,
        dir: 1,
        animation: {
          state: "idle",
          frame: 0,
          walkPhase: 0,
          walkBlend: 0,
          elapsed: 0,
        },
      },
      { rig: assets[`${name}-walk-rig-v5`], x: cx, y: 295, size: 230 },
    );
    s.fillStyle = "#eadcbd";
    s.font = "18px sans-serif";
    s.textAlign = "center";
    s.fillText(name.toUpperCase(), cx, 333);
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = "#66778366";
      g.beginPath();
      g.moveTo(i * 240, hero * 400 + 350);
      g.lineTo(i * 240 + 240, hero * 400 + 350);
      g.stroke();
      g.fillStyle = "#eadcbd";
      g.font = "16px sans-serif";
      g.fillText(`${i + 1} · ${RUN_PHASES[i]}`, i * 240 + 12, hero * 400 + 385);
      drawHero(
        g,
        assets[`${name}-painted-atlas`],
        {
          hero,
          dir: 1,
          animation: {
            state: "walk",
            frame: 24 + i,
            walkPhase: i,
            walkBlend: 1,
            elapsed: 0,
          },
        },
        {
          rig: assets[`${name}-walk-rig-v5`],
          x: i * 240 + 120,
          y: hero * 400 + 350,
          size: 185,
        },
      );
    }
    const scratch = document.createElement("canvas");
    scratch.width = 256;
    scratch.height = 180;
    const c = scratch.getContext("2d", { willReadFrequently: true });
    let minArea = Infinity,
      minJointAlpha = 255,
      maxArea = 0,
      maxChange = 0,
      prev = null;
    for (let i = 0; i <= 120; i++) {
      c.clearRect(0, 0, 256, 180);
      drawHero(
        c,
        assets[`${name}-painted-atlas`],
        {
          hero,
          dir: 1,
          animation: {
            state: "walk",
            frame: 24 + (Math.floor(i / 12) % 10),
            walkPhase: (i / 12) % 10,
            walkBlend: 1,
            elapsed: 0,
          },
        },
        { rig: assets[`${name}-walk-rig-v5`], x: 120, y: 150, size: 114 },
      );
      const data = c.getImageData(0, 0, 256, 180).data;
      for (const leg of walkRigPose(hero, (i / 12) % 10, 1).legs) {
        for (const joint of [leg.knee, leg.ankle]) {
          const pixel =
            (Math.round(150 + joint.y) * 256 + Math.round(120 + joint.x)) * 4;
          minJointAlpha = Math.min(minJointAlpha, data[pixel + 3]);
        }
      }
      let area = 0,
        change = 0;
      for (let p = 3; p < data.length; p += 4) {
        if (data[p] > 100) area++;
        if (prev) change += Math.abs(data[p] - prev[p]) / 255;
      }
      minArea = Math.min(area, minArea);
      maxArea = Math.max(area, maxArea);
      maxChange = Math.max(change, maxChange);
      prev = data;
    }
    stats.push({ hero, minArea, maxArea, maxChange, minJointAlpha });
  }
  const anatomy = document.createElement("canvas");
  anatomy.width = contact.width;
  anatomy.height = contact.height;
  const a = anatomy.getContext("2d");
  a.drawImage(contact, 0, 0);
  for (const hero of [0, 1])
    for (let phase = 0; phase < 10; phase++) {
      a.save();
      a.translate(phase * 240 + 120, hero * 400 + 350);
      a.scale(185 / 114, 185 / 114);
      for (const leg of walkRigPose(hero, phase).legs) {
        a.strokeStyle = a.fillStyle = leg.far ? "#f7af55" : "#7df5e2";
        a.lineWidth = 0.8;
        a.beginPath();
        a.moveTo(leg.hip.x, leg.hip.y);
        a.lineTo(leg.knee.x, leg.knee.y);
        a.lineTo(leg.ankle.x, leg.ankle.y);
        a.stroke();
        for (const point of [leg.hip, leg.knee, leg.ankle]) {
          a.beginPath();
          a.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
          a.fill();
        }
      }
      a.restore();
    }
  document.body.replaceChildren(contact);
  document.body.style = "margin:0;background:#15222b";
  return {
    stats,
    standing: standing.toDataURL("image/png").split(",")[1],
    anatomy: anatomy.toDataURL("image/png").split(",")[1],
  };
});
writeFileSync(
  "art/characters/walk-rig-v5/run-anatomy.png",
  Buffer.from(result.anatomy, "base64"),
);
writeFileSync(
  "art/characters/walk-rig-v5/standing-preview.png",
  Buffer.from(result.standing, "base64"),
);
await page.setViewportSize({ width: 2400, height: 800 });
await page.screenshot({ path: "art/characters/walk-rig-v5/contact-sheet.png" });
assert.deepEqual(errors, []);
for (const s of result.stats) {
  assert.ok(
    s.minJointAlpha > 220,
    "knees and ankles stay visibly connected throughout the cycle",
  );
  assert.ok(s.minArea > 1000, "hero silhouette never disappears");
  assert.ok(s.maxArea / s.minArea < 1.4, "no large silhouette pop");
  assert.ok(
    s.maxChange / s.minArea < 0.15,
    "sub-frame motion remains continuous",
  );
}
console.log(JSON.stringify(result.stats));
await browser.close();
