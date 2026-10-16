import { REGIONS, WORLD_WIDTH, clamp } from "./world.js";
import { drawHero } from "./hero-animation.js";
const TAU = Math.PI * 2;
function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export class Renderer {
  constructor(target, assets) {
    this.canvas = target;
    this.ctx = target.getContext("2d", { alpha: false });
    this.assets = assets;
    this.viewWidth = 1150;
    this.viewHeight = 620;
    this.scale = 1;
    this.frameCount = 0;
    this.lastFps = performance.now();
    this.fps = 60;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(target);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.viewWidth = clamp((r.width / r.height) * 620, 820, 1550);
    this.scale = this.canvas.height / 620;
    this.viewWidth = this.canvas.width / this.scale;
  }
  prepare(region) {
    this.regionIndex = region;
    this.region = REGIONS[region];
    this.background = this.makeBackground(region);
    this.platformTextures = new Map();
    this.resize();
  }
  makeBackground(region) {
    const c = canvas(1600, 620),
      g = c.getContext("2d"),
      r = REGIONS[region];
    const grad = g.createLinearGradient(0, 0, 0, 620);
    grad.addColorStop(0, "#040c17");
    grad.addColorStop(0.55, r.sky);
    grad.addColorStop(1, "#09171e");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1600, 620);
    g.drawImage(this.assets[`background-${region}`], 0, 0, 1600, 620);
    const tint = g.createLinearGradient(0, 0, 0, 620);
    tint.addColorStop(0, "#06101b55");
    tint.addColorStop(0.45, "#06101b22");
    tint.addColorStop(1, "#040d17aa");
    g.fillStyle = tint;
    g.fillRect(0, 0, 1600, 620);
    return c;
  }
  platform(s) {
    const key = `${s.w}-${s.h}`;
    if (this.platformTextures.has(key)) return this.platformTextures.get(key);
    const c = canvas(s.w + 20, s.h + 55),
      g = c.getContext("2d"),
      r = this.region;
    g.translate(10, 12);
    const grad = g.createLinearGradient(0, 0, 0, s.h + 20);
    grad.addColorStop(0, "#223e3b");
    grad.addColorStop(0.16, "#13252b");
    grad.addColorStop(1, "#050c13");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s.w, 0);
    g.lineTo(s.w - 5, s.h);
    for (let x = s.w - 10; x > 0; x -= 25) g.lineTo(x, s.h + rand(x) * 20);
    g.lineTo(0, 0);
    g.fill();
    g.save();
    g.clip();
    const texture = this.assets[`background-${this.regionIndex}`];
    for (let tx = 0; tx < s.w; tx += 180) {
      g.globalAlpha = 0.7;
      g.drawImage(
        texture,
        0,
        texture.height - 56,
        240,
        56,
        tx,
        0,
        180,
        Math.max(60, s.h),
      );
    }
    g.globalAlpha = 0.65;
    g.fillStyle = grad;
    g.fillRect(0, 12, s.w, s.h + 20);
    g.restore();
    g.strokeStyle = "#50615b55";
    g.lineWidth = 1;
    for (let i = 0; i < s.w / 35; i++) {
      const x = i * 35 + rand(i) * 20;
      g.beginPath();
      g.moveTo(x, 10);
      g.lineTo(x - 7, 25);
      g.lineTo(x + 4, 40 + rand(i + 70) * 40);
      g.stroke();
    }
    g.fillStyle = r.color;
    g.globalAlpha = 0.4;
    g.fillRect(0, 0, s.w, 2);
    g.globalAlpha = 0.4;
    g.fillRect(2, 3, s.w - 4, 2);
    g.globalAlpha = 1;
    for (let i = 0; i < s.w / 8; i++) {
      const x = i * 8;
      g.strokeStyle = i % 3 === 0 ? r.color : "#4c806c";
      g.globalAlpha = 0.4 + rand(i + 2) * 0.3;
      g.beginPath();
      g.moveTo(x, 1);
      g.quadraticCurveTo(
        x - 4,
        -4,
        x + rand(i) * 10 - 5,
        -4 - rand(i + 20) * 8,
      );
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < s.w / 80; i++) {
      const x = 20 + i * 80;
      g.strokeStyle = "#294d43";
      g.beginPath();
      g.moveTo(x, 4);
      g.bezierCurveTo(x + 12, 25, x - 12, 40, x + 8, s.ground ? 75 : 45);
      g.stroke();
    }
    this.platformTextures.set(key, c);
    return c;
  }
  sprite(name, x, y, w, h, dir = 1, alpha = 1) {
    const im = this.assets[name];
    if (!im) return;
    const g = this.ctx;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x + w / 2, y + h / 2);
    g.scale(dir, 1);
    g.drawImage(im, -w / 2, -h / 2, w, h);
    g.restore();
  }
  glow(x, y, r, color, alpha = 0.2) {
    const g = this.ctx;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + "00");
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }
  draw(game) {
    const g = this.ctx,
      p = game.player,
      w = game.world,
      t = game.time,
      r = this.region,
      view = this.viewWidth,
      camera = game.camera;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.fillStyle = "#050e17";
    g.fillRect(0, 0, view, 620);
    const bgOffset = (camera * 0.13) % 1600;
    g.drawImage(this.background, -bgOffset, 0);
    if (bgOffset + view > 1600)
      g.drawImage(this.background, 1600 - bgOffset, 0);
    // Distant drifting motes, capped and independent of simulation objects.
    for (let i = 0; i < 35; i++) {
      const x =
          (((rand(i + 300) * view +
            Math.sin(t * 0.2 + i) * 25 -
            camera * 0.06) %
            view) +
            view) %
          view,
        y = 140 + rand(i + 400) * 400 + Math.sin(t * 0.5 + i) * 10;
      g.globalAlpha = 0.18 + (Math.sin(t + i) + 1) * 0.18;
      g.fillStyle = i % 4 ? r.color : "#ffe1a0";
      g.beginPath();
      g.arc(x, y, 1 + rand(i + 700) * 1.5, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    g.save();
    g.translate(-camera, 0);
    for (const s of w.platforms) {
      if (s.x + s.w < camera - 30 || s.x > camera + view + 30) continue;
      g.drawImage(this.platform(s), s.x - 10, s.y - 12);
    }
    // The elder is an original NPC sprite, next to a signpost.
    if (camera < 420) {
      this.sprite("elder", w.elder.x - 7, 428, 48, 72);
      g.fillStyle = "#d4c4a0";
      g.font = "10px Georgia";
      g.textAlign = "center";
      g.fillText("THE ELDER", w.elder.x + 16, 413);
      g.strokeStyle = "#9eaa8b66";
      g.beginPath();
      g.moveTo(170, 500);
      g.lineTo(170, 445);
      g.stroke();
      g.fillStyle = "#182c2c";
      g.fillRect(157, 443, 59, 18);
      g.fillStyle = "#b2c4a5";
      g.font = "11px Georgia";
      g.fillText("→", 184, 456);
    }
    this.beacon(w.checkpoint.x, 500, t, game.checkpointUsed);
    for (const token of w.tokens) {
      if (
        token.collected ||
        (token.boss && !w.boss.dead) ||
        token.x < camera - 60 ||
        token.x > camera + view + 60
      )
        continue;
      const y = token.y + Math.sin(t * 2 + token.id) * 5;
      this.glow(token.x, y, 40, "#f4d283", 0.25);
      this.sprite("token", token.x - 14, y - 15, 28, 30);
      g.strokeStyle = "#e9d59577";
      g.beginPath();
      g.arc(token.x, y, 19, 0, TAU);
      g.stroke();
    }
    for (const e of w.enemies) {
      if (e.hp <= 0 || e.x < camera - 80 || e.x > camera + view + 80) continue;
      const frame = Math.floor(t * 5 + e.id) % 2;
      this.sprite(
        `enemy-${w.region}-${frame}`,
        e.x - 13,
        e.y - 14 + Math.sin(t * 7 + e.id) * 1.5,
        64,
        56,
        e.dir,
        e.hit > 0 ? 0.5 : 1,
      );
    }
    const b = w.boss;
    if (!b.dead && b.x < camera + view + 160) {
      this.glow(b.x + 62, b.y + 65, 110, r.glow, b.phase === 1 ? 0.4 : 0.16);
      if (b.phase === 1) {
        g.strokeStyle = "#efc47e";
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(b.x + 60, 499, 110 * (1 - b.timer) + 30, 10, 0, 0, TAU);
        g.stroke();
        g.font = "11px Manrope";
        g.textAlign = "center";
        g.fillStyle = "#f3d292";
        g.fillText(b.timer < 0.35 ? "JUMP!" : "GET READY…", b.x + 65, b.y - 25);
      }
      this.sprite(
        `boss-${w.region}-${b.phase}`,
        b.x - 25,
        b.y - 20 + Math.sin(t * 2) * 4,
        175,
        145,
        1,
        b.hit > 0 ? 0.5 : 1,
      );
    }
    for (const a of w.projectiles) {
      this.glow(a.x + 16, a.y + 12, 30, r.glow, 0.6);
      g.fillStyle = r.color;
      g.beginPath();
      g.ellipse(a.x + 16, a.y + 12, a.w / 2, a.h / 2, 0, 0, TAU);
      g.fill();
    }
    const ready = w.tokens.every((a) => a.collected) && b.dead;
    this.gate(4415, 500, t, ready);
    const hero = game.progress.hero === 1 ? "urmasa" : "quirel";
    const atlas = this.assets[`hero-${hero}-atlas-v2`];
    const alpha = p.invulnerable > 0 && Math.floor(t * 12) % 2 ? 0.48 : 1;
    if (p.dash > 0) {
      for (let i = 1; i < 4; i++)
        drawHero(g, atlas, p, {
          x: p.x + p.w / 2 - p.dir * i * 20,
          alpha: 0.12,
        });
    }
    if (p.grounded) {
      g.fillStyle = "#0006";
      g.beginPath();
      g.ellipse(p.x + p.w / 2, p.y + p.h + 2, 22, 4, 0, 0, TAU);
      g.fill();
    }
    drawHero(g, atlas, p, { alpha });
    if (p.attack > 0) {
      g.save();
      g.translate(p.x + 16, p.y + 24);
      g.scale(p.dir, 1);
      g.strokeStyle = "#fff4c9";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(5, 0, 64, -1.05, 1.05);
      g.stroke();
      g.strokeStyle = "#e7c68466";
      g.lineWidth = 11;
      g.beginPath();
      g.arc(5, 0, 62, -0.95, 1);
      g.stroke();
      g.restore();
    }
    for (const a of game.particles) {
      g.globalAlpha = clamp(a.life / 0.7, 0, 1);
      g.fillStyle = a.color;
      g.fillRect(a.x, a.y, a.size, a.size);
    }
    g.globalAlpha = 1;
    g.restore();
    const fog = g.createLinearGradient(0, 525, 0, 620);
    fog.addColorStop(0, "#03101800");
    fog.addColorStop(1, "#030b14");
    g.fillStyle = fog;
    g.fillRect(0, 525, view, 95);
    // Frame vignette keeps HUD readable without expensive CSS filters.
    const shade = g.createLinearGradient(0, 0, 0, 170);
    shade.addColorStop(0, "#030b16cc");
    shade.addColorStop(1, "#030b1600");
    g.fillStyle = shade;
    g.fillRect(0, 0, view, 170);
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFps >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFps));
      this.frameCount = 0;
      this.lastFps = now;
    }
  }
  mushroom(x, y, h, color, seed) {
    const g = this.ctx;
    g.globalAlpha = 0.7;
    g.strokeStyle = "#3a676f";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - 7, y - h * 0.5, x + 5, y - h);
    g.stroke();
    this.glow(x + 5, y - h, h * 0.6, color, 0.08);
    g.fillStyle = "#182d42";
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.globalAlpha = 0.45;
    g.beginPath();
    g.moveTo(x - h * 0.42, y - h + 8);
    g.bezierCurveTo(
      x - h * 0.25,
      y - h - h * 0.4,
      x + h * 0.3,
      y - h - h * 0.4,
      x + h * 0.46,
      y - h + 6,
    );
    g.quadraticCurveTo(x, y - h + 23, x - h * 0.42, y - h + 8);
    g.fill();
    g.stroke();
    g.globalAlpha = 0.35;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(x + 5, y - h + 8);
      g.lineTo(x - h * 0.3 + i * h * 0.15, y - h + 7);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  crystals(x, y, h, color, seed) {
    const g = this.ctx;
    g.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      const xx = x + i * 17,
        hh = h * (0.5 + rand(seed + i) * 0.5);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(xx - 12, y);
      g.lineTo(xx - 9, y - hh * 0.7);
      g.lineTo(xx, y - hh);
      g.lineTo(xx + 9, y - hh * 0.7);
      g.lineTo(xx + 7, y);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  beacon(x, y, t, active) {
    const g = this.ctx;
    this.glow(x, y - 35, 70, active ? "#efcd8f" : "#70dfec", 0.18);
    g.fillStyle = "#334546";
    g.fillRect(x - 22, y - 11, 44, 11);
    g.fillStyle = active ? "#f9d69c" : "#8ee7ef";
    g.beginPath();
    g.moveTo(x, y - 65 - Math.sin(t * 3) * 3);
    g.bezierCurveTo(x + 27, y - 29, x + 12, y - 13, x, y - 14);
    g.bezierCurveTo(x - 23, y - 16, x - 12, y - 38, x, y - 65);
    g.fill();
    g.font = "9px Manrope";
    g.textAlign = "center";
    g.fillStyle = "#b9d0c7";
    g.fillText(active ? "JOURNEY SAVED" : "WARM LIGHT", x, y - 84);
  }
  gate(x, y, t, ready) {
    const g = this.ctx;
    if (ready) this.glow(x, y - 60, 100, this.region.color, 0.25);
    g.strokeStyle = ready ? "#d9e8c0" : "#506365";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(x - 34, y);
    g.lineTo(x - 34, y - 95);
    g.quadraticCurveTo(x, y - 145, x + 34, y - 95);
    g.lineTo(x + 34, y);
    g.stroke();
    g.strokeStyle = ready ? this.region.color : "#223b40";
    g.lineWidth = 2;
    g.stroke();
    g.font = "10px Manrope";
    g.textAlign = "center";
    g.fillStyle = ready ? "#e4dfc0" : "#91a09d";
    g.fillText(
      ready ? "THE PATH IS OPEN" : "FIVE LIGHTS OPEN THE WAY",
      x,
      y - 157,
    );
    if (ready) {
      g.fillStyle = this.region.color;
      g.globalAlpha = 0.18 + Math.sin(t * 2) * 0.08;
      g.fillRect(x - 24, y - 100, 48, 100);
      g.globalAlpha = 1;
    }
  }
}
