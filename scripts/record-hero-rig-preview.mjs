import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 960, height: 420 } });
await page.goto(process.env.QA_URL || "http://127.0.0.1:5175/");
const base64 = await page.evaluate(async () => {
  const { drawHero, createHeroAnimation, updateHeroAnimation } = await import(
    "/src/hero-animation.js"
  );
  const images = {};
  for (const name of ["quirel", "urmasa"])
    for (const suffix of ["painted-atlas", "walk-rig-v5"]) {
      const im = new Image();
      im.src = `/assets/hero-${name}-${suffix}.webp`;
      await im.decode();
      images[`${name}-${suffix}`] = im;
    }
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 420;
  document.body.replaceChildren(canvas);
  document.body.style = "margin:0;background:#12212b";
  const ctx = canvas.getContext("2d");
  const players = [0, 1].map((hero) => ({
    hero,
    dir: 1,
    grounded: true,
    jumps: 0,
    vx: 0,
    vy: 0,
    animation: createHeroAnimation(),
  }));
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 3000000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const finished = new Promise(
    (resolve) =>
      (recorder.onstop = () =>
        resolve(new Blob(chunks, { type: "video/webm" }))),
  );
  let previous = performance.now(),
    start = previous,
    ground = 0;
  recorder.start();
  await new Promise((resolve) => {
    function tick(now) {
      const time = (now - start) / 1000,
        dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      const speed =
        time < 0.7
          ? 0
          : time < 3.1
            ? 270
            : time < 3.8
              ? 0
              : time < 6.2
                ? -270
                : 0;
      ground += (speed * dt * 180) / 114;
      ctx.fillStyle = "#12212b";
      ctx.fillRect(0, 0, 960, 420);
      ctx.fillStyle = "#f2e3bf";
      ctx.textAlign = "center";
      ctx.font = "22px sans-serif";
      ctx.fillText("Run cycle · heel recovery and forward knees", 480, 42);
      ctx.fillStyle = "#8ca7b5";
      ctx.font = "15px sans-serif";
      ctx.fillText(speed > 0 ? "RUN →" : speed < 0 ? "← RUN" : "STOP", 480, 73);
      for (const p of players) {
        const name = p.hero ? "urmasa" : "quirel",
          cx = p.hero ? 720 : 240;
        p.vx = speed;
        if (speed) p.dir = Math.sign(speed);
        updateHeroAnimation(p, dt);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - 220, 90, 440, 265);
        ctx.clip();
        ctx.strokeStyle = "#67808f";
        ctx.beginPath();
        ctx.moveTo(cx - 220, 320);
        ctx.lineTo(cx + 220, 320);
        ctx.stroke();
        ctx.fillStyle = "#425865";
        for (let j = -8; j <= 8; j++)
          ctx.fillRect(cx + j * 50 - (((ground % 50) + 50) % 50), 323, 12, 2);
        drawHero(ctx, images[`${name}-painted-atlas`], p, {
          rig: images[`${name}-walk-rig-v5`],
          x: cx,
          y: 320,
          size: 180,
        });
        ctx.restore();
        ctx.fillStyle = "#eadcbb";
        ctx.font = "20px sans-serif";
        ctx.fillText(p.hero ? "URMASA" : "QUIREL", cx, 370);
      }
      if (time >= 7) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  recorder.stop();
  const blob = await finished;
  stream.getTracks().forEach((t) => t.stop());
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.readAsDataURL(blob);
  });
});
writeFileSync(
  "art/characters/walk-rig-v5/running-preview.webm",
  Buffer.from(base64, "base64"),
);
await browser.close();
console.log("Saved continuous walking, stopping, and reversing preview.");
