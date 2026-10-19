import { drawWallDebris } from "./terrain.js";
import {
  regionBackground,
  regionTerrain,
  regionDetails,
  regionForeground,
  regionMinimap,
  drawTown,
  drawRegionBoss,
} from "./region-renderer.js";
import { TOKEN_TYPES } from "./progression.js";
import {
  drawForestBackground,
  drawForestTerrain,
  drawForestEarth,
  drawForestDetails,
  drawMother,
  drawForestBossTell,
  drawForestMinimap,
} from "./forest-renderer.js";
import { drawCreature } from "./creatures.js";
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
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      1.6,
      Math.sqrt(1500000 / (r.width * r.height)),
    );
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.viewWidth = clamp((r.width / r.height) * 620, 820, 1550);
    this.scale = this.canvas.height / 620;
    this.viewWidth = this.canvas.width / this.scale;
  }
  prepare(region, world) {
    this.regionIndex = region;
    this.region = REGIONS[region];
    this.background = null;
    this.platformTextures = new Map();
    this.scenery = null;
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
  makeScenery(w) {
    if (!w) return null;
    const c = canvas(WORLD_WIDTH, 620),
      previous = this.ctx;
    this.ctx = c.getContext("2d");
    const g = this.ctx,
      r = this.region,
      camera = 0,
      view = WORLD_WIDTH;
    // Small region-specific details populate the route without additional textures.
    for (const s of w.platforms) {
      if (s.x + s.w < camera - 100 || s.x > camera + view + 100) continue;
      if (s.wall) {
        g.strokeStyle = r.color + "88";
        g.lineWidth = 2;
        for (let y = s.y + 14; y < s.y + s.h - 10; y += 28) {
          g.beginPath();
          g.moveTo(s.x + 4, y + 5);
          g.lineTo(s.x + 11, y);
          g.lineTo(s.x + 17, y + 5);
          g.stroke();
          g.beginPath();
          g.moveTo(s.x + s.w - 17, y + 5);
          g.lineTo(s.x + s.w - 11, y);
          g.lineTo(s.x + s.w - 4, y + 5);
          g.stroke();
        }
      } else if (s.ground) {
        for (let x = s.x + 35; x < s.x + s.w - 20; x += 155) {
          if (x < camera - 70 || x > camera + view + 70) continue;
          if (w.region < 2) this.mushroom(x, s.y, 25 + rand(x) * 30, r.glow, x);
          else if (w.region > 3)
            this.crystals(x, s.y, 22 + rand(x) * 40, r.glow, x);
          else {
            g.fillStyle = "#101922";
            g.fillRect(x - 9, s.y - 55, 18, 55);
            g.strokeStyle = "#60748a88";
            g.lineWidth = 2;
            g.strokeRect(x - 12, s.y - 58, 24, 7);
            g.fillStyle = r.color + "aa";
            g.fillRect(x - 2, s.y - 45, 4, 12);
          }
        }
      }
    }
    if (w.shaft.x > camera - 100 && w.shaft.x < camera + view + 100) {
      g.fillStyle = "#e8ddb4";
      g.font = "11px Arial";
      g.textAlign = "center";
      g.fillText("↑ Отталкивайся от стен", w.shaft.x, 430);
    }
    this.ctx = previous;
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
    if (game.world.town) return drawTown(this, game);
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
    regionBackground(this, game);
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
    g.translate(-camera, -(game.cameraY || 0));
    if (w.caverns) drawForestEarth(this, game);
    for (const s of w.platforms) {
      if (w.caverns && s.solid && !s.breakable) continue;
      if (s.x + s.w < camera - 30 || s.x > camera + view + 30) continue;
      if (
        s.y + s.h < (game.cameraY || 0) - 40 ||
        s.y > (game.cameraY || 0) + 650
      )
        continue;
      regionTerrain(this, s, game);
    }
    if (this.scenery)
      g.drawImage(this.scenery, camera, 0, view, 620, camera, 0, view, 620);
    regionDetails(this, game);
    // The Elder shares the painted art style and responds with talking poses.
    if (camera < 420) {
      const talking = Math.abs(p.x - w.elder.x) < 100 && p.attack > 0;
      const frame = talking
        ? 8 + (Math.floor(t * 5) % 4)
        : Math.floor(t * 3) % 4;
      const elder = this.assets["elder-atlas"];
      if (elder)
        g.drawImage(
          elder,
          (frame % 4) * 256,
          Math.floor(frame / 4) * 256,
          256,
          256,
          w.elder.x - 30,
          w.elder.y - 26,
          86,
          86,
        );
      g.fillStyle = "#d4c4a0";
      g.font = "10px Georgia";
      g.textAlign = "center";
      g.save();
      g.globalAlpha *= 0.12;
      g.fillText("СТАРЕЙШИНА", w.elder.x + 16, w.elder.y - 33);
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
      g.restore();
    }
    this.beacon(w.checkpoint.x, w.checkpoint.y + 50, t, game.checkpointUsed);
    for (const token of w.tokens) {
      if (
        token.collected ||
        !token.revealed ||
        (token.boss && !w.boss.dead) ||
        token.x < camera - 60 ||
        token.x > camera + view + 60
      )
        continue;
      const y = token.y + Math.sin(t * 2 + token.id) * 5;
      this.glow(token.x, y, 40, TOKEN_TYPES[token.type].color, 0.35);
      this.sprite(`token-type-${token.type}`, token.x - 17, y - 18, 34, 36);
      g.strokeStyle = TOKEN_TYPES[token.type].color;
      g.beginPath();
      g.arc(token.x, y, 19, 0, TAU);
      g.stroke();
    }
    for (const e of w.enemies) {
      if (
        (e.hp <= 0 && e.deathTime > 1.2) ||
        e.x < camera - 120 ||
        e.x > camera + view + 120 ||
        Math.abs(e.y - (game.cameraY || 0) - 310) > 460
      )
        continue;
      drawCreature(g, this.assets, e.key, e, t);
      if (e.state === "windup" && e.hp > 0) {
        g.font = "bold 17px Arial";
        g.fillStyle = "#ffe1a0";
        g.textAlign = "center";
        g.fillText("!", e.x + e.w / 2, e.y - 25);
      }
    }
    const b = w.boss;
    if ((!b.dead || b.deathTime < 1.2) && b.x < camera + view + 160) {
      this.glow(b.x + 62, b.y + 65, 110, r.glow, b.phase === 1 ? 0.4 : 0.16);
      if (w.region === 0) drawForestBossTell(this, game);
      if (b.phase === 1 && w.region !== 0) {
        g.strokeStyle = "#efc47e";
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(
          b.x + 60,
          499,
          110 * Math.max(0, 1 - b.timer / 1.35) + 30,
          10,
          0,
          0,
          TAU,
        );
        g.stroke();
        g.font = "11px Manrope";
        g.textAlign = "center";
        g.fillStyle = "#f3d292";
        g.fillText(b.label || "ПРИГОТОВЬСЯ…", b.x + 65, b.y - 25);
      }
      b.dir = p.x < b.x ? -1 : 1;
      if (
        !(w.region === 0 ? drawMother(this, game) : drawRegionBoss(this, game))
      )
        drawCreature(g, this.assets, b.key, b, t, {
          size: w.region === 0 ? 235 : 195,
        });
    }

    for (const a of w.projectiles) {
      this.glow(a.x + 16, a.y + 12, 30, r.glow, 0.6);
      g.fillStyle = r.color;
      g.beginPath();
      if (w.region >= 3) {
        const cx = a.x + a.w / 2,
          cy = a.y + a.h / 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 + t,
            radius = i % 2 ? a.w / 4 : a.w / 2;
          const x = cx + Math.cos(angle) * radius,
            y = cy + Math.sin(angle) * radius;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
      } else
        g.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w / 2, a.h / 2, 0, 0, TAU);
      g.fill();
    }
    const ready = w.tokens.every((a) => a.collected) && b.dead;
    this.gate(4415, 500, t, ready);
    const hero = game.progress.hero === 1 ? "urmasa" : "quirel";
    const atlas = this.assets[`hero-${hero}-painted-atlas`];
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
      g.globalAlpha =
        Math.sin((1 - p.attack / (p.attackDuration || 0.21)) * Math.PI) * 0.7;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(
        5,
        0,
        p.hero === 0 ? 72 : 64,
        p.hero === 0 ? -Math.PI : -1.05,
        p.hero === 0 ? Math.PI : 1.05,
      );
      g.stroke();
      g.strokeStyle = "#e7c68466";
      g.lineWidth = 11;
      g.beginPath();
      g.arc(
        5,
        0,
        p.hero === 0 ? 70 : 62,
        p.hero === 0 ? -Math.PI : -0.95,
        p.hero === 0 ? Math.PI : 1,
      );
      g.stroke();
      g.restore();
    }
    drawWallDebris(this, game);
    for (const a of game.particles) {
      g.globalAlpha = clamp(a.life / 0.7, 0, 1);
      g.fillStyle = a.color;
      if (a.dust) {
        g.globalAlpha *= 0.24;
        const radius = a.size * (2 - Math.min(a.life, 1));
        const dust = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, radius);
        dust.addColorStop(0, a.color);
        dust.addColorStop(1, a.color + "00");
        g.fillStyle = dust;
        g.fillRect(a.x - radius, a.y - radius, radius * 2, radius * 2);
      } else g.fillRect(a.x, a.y, a.size, a.size);
    }
    g.globalAlpha = 1;
    regionForeground(this, game);
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
    g.save();
    g.globalAlpha *= 0.1;
    regionMinimap(this, game);
    g.restore();
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
    g.save();
    g.globalAlpha *= 0.12;
    g.fillText(active ? "ПУТЬ СОХРАНЁН" : "ТЁПЛЫЙ СВЕТ", x, y - 84);
    g.restore();
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
      ready ? "ПУТЬ ОТКРЫТ" : "ПЯТЬ ОГОНЬКОВ ОТКРОЮТ ПУТЬ",
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
