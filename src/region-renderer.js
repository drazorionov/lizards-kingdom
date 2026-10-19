import { regionBossFrame } from "./region-boss.js";
import { drawHero } from "./hero-animation.js";
import {
  drawForestBackground,
  drawForestTerrain,
  drawForestDetails,
} from "./forest-renderer.js";
import { TOKEN_TYPES, growth, hasService } from "./progression.js";
import { roomAt } from "./regions.js";
const TAU = Math.PI * 2;
export function regionBackground(r, game) {
  if (game.world.region === 0) return drawForestBackground(r, game);
  const g = r.ctx,
    im = r.assets[game.world.artKey + "-background"];
  g.fillStyle = game.region.sky;
  g.fillRect(0, 0, r.viewWidth, 620);
  if (!im) return;
  const h = 760,
    w = (h * im.width) / im.height;
  g.drawImage(
    im,
    -Math.max(0, w - r.viewWidth) *
      (game.camera / Math.max(1, game.world.width - r.viewWidth)),
    -60 - game.cameraY * 0.04,
    w,
    h,
  );
  g.fillStyle = "#04101b33";
  g.fillRect(0, 0, r.viewWidth, 620);
}
export function regionTerrain(r, s, game) {
  if (s.absent) return;
  if (game.world.region === 0) return drawForestTerrain(r, s, game);
  const g = r.ctx,
    key = game.world.artKey,
    im = r.assets[key + "-terrain"],
    kit = r.assets[key + "-ledges"],
    frames = r.assets.expansion?.[key];
  if (!im || !kit || !frames) return;
  const ledge = (x, y, width, index) => {
    const f = frames[index % 8],
      scale = (width + 12) / f.rect[2];
    g.drawImage(
      kit,
      ...f.rect,
      x - 6,
      y - f.top * scale,
      f.rect[2] * scale,
      f.rect[3] * scale,
    );
  };
  g.save();
  if (s.crumbleTime) g.globalAlpha = 0.7 + 0.3 * Math.sin(game.time * 30);
  if (!s.solid) {
    ledge(s.x, s.y, s.w, s.id);
    g.restore();
    return;
  }
  g.save();
  g.beginPath();
  g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  const left = s.x + Math.max(0, Math.floor((game.camera - s.x) / 512)) * 512,
    top = s.y + Math.max(0, Math.floor((game.cameraY - s.y) / 512)) * 512;
  for (let y = top; y < Math.min(s.y + s.h, game.cameraY + 620); y += 512)
    for (
      let x = left;
      x < Math.min(s.x + s.w, game.camera + r.viewWidth);
      x += 512
    )
      g.drawImage(im, x, y, 512, 512);
  g.restore();
  if (!s.wall && !s.ceiling) {
    g.save();
    g.beginPath();
    g.rect(s.x - 3, s.y - 100, s.w + 6, 130);
    g.clip();
    const n = Math.ceil(s.w / 300),
      width = s.w / n;
    for (let i = 0; i < n; i++)
      if (
        s.x + (i + 1) * width > game.camera &&
        s.x + i * width < game.camera + r.viewWidth
      )
        ledge(s.x + i * width, s.y, width, s.id + i);
    g.restore();
  }
  if (s.ceiling) {
    g.save();
    g.beginPath();
    g.rect(s.x, s.y + s.h, s.w, 80);
    g.clip();
    const count = Math.ceil(s.w / 260),
      width = s.w / count;
    for (let i = 0; i < count; i++)
      ledge(s.x + i * width, s.y + s.h, width, s.id + i);
    g.restore();
  }
  if (s.wall && !s.breakable) {
    g.save();
    g.beginPath();
    g.rect(s.x - 22, s.y, 22, s.h);
    g.clip();
    g.translate(s.x, s.y);
    g.rotate(Math.PI / 2);
    const count = Math.ceil(s.h / 240),
      width = s.h / count;
    for (let i = 0; i < count; i++) ledge(i * width, 0, width, s.id + i);
    g.restore();
  }
  g.strokeStyle = s.breakable ? "#e8c081" : game.region.color + "99";
  g.lineWidth = s.breakable ? 3 : 1;
  if (s.wall) {
    g.strokeRect(s.x + 2, s.y, s.w - 4, s.h);
    if (s.breakable) {
      g.beginPath();
      g.moveTo(s.x + s.w * 0.6, s.y + 8);
      g.lineTo(s.x + 8, s.y + s.h * 0.35);
      g.lineTo(s.x + s.w - 8, s.y + s.h * 0.55);
      g.lineTo(s.x + 9, s.y + s.h * 0.9);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x + s.w, s.y);
    g.stroke();
  }
  g.restore();
}
export function regionDetails(r, game) {
  if (game.world.region === 0) drawForestDetails(r, game);
  const g = r.ctx,
    w = game.world;
  if (w.region !== 0) {
    for (const a of w.hazards) drawRegionalHazard(r, a, game);
    for (const s of w.signs) {
      if (
        Math.abs(s.x - game.camera - r.viewWidth / 2) > r.viewWidth / 2 + 150 ||
        Math.abs(s.y - game.cameraY - 310) > 400
      )
        continue;
      g.font = "10px Arial";
      g.textAlign = "center";
      g.fillStyle = "#eddfbd";
      g.fillText(s.text, s.x, s.y);
    }
  }
  for (const spring of w.springs || [])
    r.beacon(spring.x, spring.y, game.time, false);
  for (const s of w.secrets || []) {
    if (s.found) continue;
    const near = Math.hypot(s.x - game.player.x, s.y - game.player.y) < 250;
    if (near) {
      r.glow(s.x, s.y, 22, game.region.glow, 0.16);
      g.fillStyle = game.region.color;
      g.fillRect(s.x - 1, s.y - 1, 2, 2);
    }
  }
  for (const portal of w.portals || []) {
    if (
      portal.secretId != null &&
      !w.secrets.some((s) => s.id === portal.secretId && s.found)
    )
      continue;
    g.strokeStyle = "#e7c38b";
    g.lineWidth = 2;
    g.strokeRect(portal.x - 21, portal.y - 55, 42, 80);
    g.font = "10px Arial";
    g.fillStyle = "#f2dcad";
    g.textAlign = "center";
    g.fillText(portal.name, portal.x, portal.y - 65);
    if (
      Math.hypot(portal.x - game.player.x - 15, portal.y - game.player.y - 27) <
      65
    )
      g.fillText("ПРОБЕЛ / МЕЧ", portal.x, portal.y - 82);
  }
}
export function regionForeground(r, game) {
  const g = r.ctx,
    w = game.world,
    p = game.player;
  for (const water of w.water || []) {
    if (water.x + water.w < game.camera || water.x > game.camera + r.viewWidth)
      continue;
    g.fillStyle = game.region.color + "16";
    g.fillRect(water.x, water.y, water.w, water.h);
    g.strokeStyle = game.region.color + "66";
    g.beginPath();
    for (let x = water.x; x <= water.x + water.w; x += 20) {
      const y = water.y + Math.sin(x * 0.04 + game.time * 2) * 3;
      x === water.x ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  for (const v of w.veils || []) {
    const found = w.secrets.some((s) => s.id === v.secretId && s.found);
    g.save();
    g.globalAlpha = found ? 0.12 : 0.65;
    g.strokeStyle = v.kind === "waterfall" ? "#81bde0" : game.region.color;
    g.lineWidth = 7;
    for (let i = 0; i < 18; i++) {
      const x = v.x + (i * v.w) / 18;
      g.beginPath();
      g.moveTo(x, v.y);
      g.quadraticCurveTo(
        x + Math.sin(game.time + i) * 6,
        v.y + v.h / 2,
        x - 3,
        v.y + v.h,
      );
      g.stroke();
    }
    g.restore();
  }
  if (p.absorb > 0) {
    const q = 1 - p.absorb / 0.65;
    r.glow(p.x + 15, p.y + 18, 22 + q * 30, p.absorbColor, 0.35 * (1 - q));
    g.strokeStyle = p.absorbColor;
    g.globalAlpha = 1 - q;
    g.beginPath();
    g.arc(p.x + 15, p.y + 27, 15 + q * 40, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }
  if (p.buff > 0 || growth(game.progress).level >= 10)
    r.glow(p.x + 15, p.y + 30, 48, "#ffd780", 0.23);
}
function visibleRoom(w, s) {
  const room = roomAt(w, { x: s.x, y: s.y, w: s.w || 1, h: 1 });
  return room && w.discovered.has(room.id);
}
export function regionMinimap(r, game) {
  const g = r.ctx,
    w = game.world,
    sw = 170,
    sh = 60,
    x = r.viewWidth - 190,
    y = 100;
  g.fillStyle = "#06131bdd";
  g.fillRect(x - 8, y - 8, 186, 96);
  g.strokeStyle = game.region.color + "55";
  g.strokeRect(x - 8, y - 8, 186, 96);
  for (const s of w.platforms) {
    if (!visibleRoom(w, s)) continue;
    g.fillStyle = s.breakable ? "#dbb879" : game.region.color + "88";
    g.fillRect(
      x + (s.x / w.width) * sw,
      y + (s.y / w.height) * sh,
      Math.max(1, (s.w / w.width) * sw),
      Math.max(1, (s.h / w.height) * sh),
    );
  }
  for (const t of w.tokens)
    if (t.revealed && !t.collected) {
      g.fillStyle = TOKEN_TYPES[t.type].color;
      g.fillRect(
        x + (t.x / w.width) * sw - 1,
        y + (t.y / w.height) * sh - 1,
        3,
        3,
      );
    }
  g.fillStyle = "#fff5c9";
  g.beginPath();
  g.arc(
    x + ((game.player.x + 15) / w.width) * sw,
    y + ((game.player.y + 27) / w.height) * sh,
    3,
    0,
    TAU,
  );
  g.fill();
  g.font = "10px Arial";
  g.textAlign = "center";
  g.fillText(roomAt(w, game.player)?.name || "", x + sw / 2, y + 77);
}
export function regionMapMarkup(game) {
  const w = game.world,
    p = game.player,
    all = game.progress.quests?.includes("stranger"),
    hints = hasService(game.progress, "compass");
  const seen = (s) => all || visibleRoom(w, s);
  return `<div class="forest-map"><svg viewBox="-80 -80 4710 1790" role="img" aria-label="Карта ${game.region.name}; неизвестные комнаты скрыты"><rect x="-80" y="-80" width="4710" height="1790" fill="#06131d"/>${w.rooms
    .filter((r) => all || w.discovered.has(r.id))
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#153033" stroke="#3e625b" stroke-width="4"/><text x="${r.x + 20}" y="${r.y + 70}" fill="#e1d6b3" font-size="40">${r.name}</text>`,
    )
    .join("")}${w.platforms
    .filter(seen)
    .map(
      (s) =>
        `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${Math.max(15, s.h)}" fill="${s.breakable ? "#c49c65" : "#6fae9b"}"/>`,
    )
    .join("")}${w.tokens
    .filter((t) => t.revealed || t.collected)
    .map(
      (t) =>
        `<circle cx="${t.x}" cy="${t.y}" r="24" fill="${t.collected ? "#52635e" : TOKEN_TYPES[t.type].color}"/>`,
    )
    .join("")}${w.secrets
    .filter((s) => s.found)
    .map(
      (s) =>
        `<text x="${s.x + 25}" y="${s.y - 30}" fill="#f485bc" stroke="#06131d" stroke-width="7" paint-order="stroke" font-size="48">${w.region + 1}.${s.id + 1}</text>`,
    )
    .join(
      "",
    )}${seen(w.checkpoint) ? `<path d="M${w.checkpoint.x} ${w.checkpoint.y - 40} l-35 60 h70 Z" fill="#efbd78"/>` : ""}<circle cx="${p.x + 15}" cy="${p.y + 27}" r="30" fill="#fff5d5" stroke="#75e4cc" stroke-width="10"/></svg><p>● Ты здесь · ▲ Тёплый камень · Золотые трещины: атакуй · Неизведанные комнаты и спрятанные жетоны скрыты.</p><div class="secret-list">${w.secrets.map((s) => `<span class="${s.found ? "found" : ""}">${w.region + 1}.${s.id + 1} ${s.found ? "✓ " + s.name : hints ? s.name : "Неизвестная тайна"}</span>`).join("")}</div>${game.progress.quests?.includes("dar") ? "<p>Дар: нижние тоннели возвращаются к тёплому камню. От него ищи уступы справа и колодец слева.</p>" : ""}</div>`;
}
export function drawTown(r, game) {
  const g = r.ctx,
    p = game.player,
    w = game.world,
    t = game.time,
    im = r.assets["town-background"];
  g.setTransform(r.scale, 0, 0, r.scale, 0, 0);
  g.fillStyle = "#07131d";
  g.fillRect(0, 0, r.viewWidth, 620);
  const h = 650,
    wi = w.width,
    offset = game.camera;
  for (let x = -offset % wi; x < r.viewWidth; x += wi)
    g.drawImage(im, x, -61, wi, h);
  g.fillStyle = "#08101755";
  g.fillRect(0, 500, r.viewWidth, 120);
  g.save();
  g.translate(-game.camera, 0);
  for (const n of w.npcs) {
    if (n.x < game.camera - 150 || n.x > game.camera + r.viewWidth + 150)
      continue;
    const near = Math.abs(n.x - p.x - 15) < 85,
      frame = (near ? 2 : 0) + (Math.floor(t * (near ? 4 : 2)) % 2),
      atlas = r.assets[`town-npcs-${n.sheet}-atlas`],
      size = n.id === "child" ? 88 : 122;
    g.drawImage(
      atlas,
      frame * 256,
      n.row * 256,
      256,
      256,
      n.x - size / 2,
      500 - (size * 240) / 256,
      size,
      size,
    );
    g.font = "11px Georgia";
    g.fillStyle = "#ead6b2";
    g.textAlign = "center";
    g.fillText(n.name, n.x, 500 - size - 8);
    if (near) {
      g.font = "bold 11px Arial";
      g.fillStyle = "#fff2c8";
      g.fillText("ПРОБЕЛ / МЕЧ · ГОВОРИТЬ", n.x, 365);
    }
  }
  r.gate(125, 500, t, true);
  g.font = "11px Arial";
  g.fillStyle = "#e8d9b1";
  g.fillText("Вернуться в путь", 125, 320);
  drawHero(
    g,
    r.assets[`hero-${p.hero ? "urmasa" : "quirel"}-painted-atlas`],
    p,
  );
  g.restore();
  r.frameCount++;
  const now = performance.now();
  if (now - r.lastFps >= 1000) {
    r.fps = Math.round((r.frameCount * 1000) / (now - r.lastFps));
    r.frameCount = 0;
    r.lastFps = now;
  }
}
export function drawRegionBoss(r, game) {
  const b = game.world.boss,
    frame = regionBossFrame(b),
    im = r.assets[game.world.artKey + "-boss-attacks-atlas"];
  if (frame == null || !im) return false;
  const g = r.ctx,
    size = 235;
  g.save();
  g.translate(b.x + b.w / 2, b.y + b.h);
  g.scale(b.dir, 1);
  g.globalAlpha = b.dead
    ? Math.max(0, 1 - b.deathTime / 1.2)
    : b.state === "strike" && game.world.region === 4 && b.elapsed < 0.45
      ? 0.4
      : 1;
  g.drawImage(
    im,
    (frame % 4) * 320,
    Math.floor(frame / 4) * 320,
    320,
    320,
    -size / 2,
    (-size * 304) / 320,
    size,
    size,
  );
  g.restore();
  return true;
}
export function drawRegionalHazard(r, a, game) {
  const g = r.ctx,
    cx = a.x + a.w / 2;
  g.save();
  g.strokeStyle = "#ffd995";
  g.fillStyle = game.region.glow;
  g.lineWidth = 2;
  if (a.delay > 0) {
    g.setLineDash([5, 5]);
    g.strokeRect(a.x, 497, a.w, 3);
    g.font = "bold 18px Arial";
    g.textAlign = "center";
    g.fillText("!", cx, 480);
    g.restore();
    return;
  }
  g.globalAlpha = 0.85;
  if (game.world.region === 2) {
    g.strokeStyle = "#d8f6ff";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx, 380);
    for (let i = 1; i <= 6; i++)
      g.lineTo(cx + (i % 2 ? 12 : -10), 380 + i * 20);
    g.stroke();
  } else if (game.world.region === 3) {
    g.fillStyle = "#bd8b55";
    g.beginPath();
    g.moveTo(cx - 25, 490);
    g.quadraticCurveTo(cx - 18, 435, cx - 14, 423);
    g.quadraticCurveTo(cx, 410, cx + 14, 423);
    g.quadraticCurveTo(cx + 18, 435, cx + 25, 490);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(cx, 490, 28, 7, 0, 0, TAU);
    g.stroke();
  } else
    for (let i = 0; i < 3; i++) {
      const x = a.x + ((i + 0.5) * a.w) / 3;
      g.beginPath();
      g.moveTo(x - 12, 500);
      if (game.world.region === 1)
        g.quadraticCurveTo(x - 25, 435, x + 5, 500 - a.h);
      else g.lineTo(x, 500 - a.h);
      g.lineTo(x + 15, 500);
      g.closePath();
      g.fill();
      g.stroke();
    }
  r.glow(cx, 450, a.w, game.region.glow, 0.35);
  g.restore();
}
export function townMapMarkup(game) {
  return `<div class="forest-map"><svg viewBox="0 0 3650 500" role="img" aria-label="Город и его жители"><rect width="3650" height="500" fill="#0b1822"/><path d="M125 300 H3500" stroke="#b99562" stroke-width="15"/>${game.world.npcs.map((n, i) => `<path d="M${n.x - 65} 240 v-110 l65-45 65 45 v110Z" fill="#28403f" stroke="#c39c66" stroke-width="5"/><text x="${n.x}" y="${i % 2 ? 395 : 365}" text-anchor="middle" fill="#ead6b4" font-size="35">${n.name}</text>`).join("")}<circle cx="${game.player.x + 15}" cy="300" r="25" fill="#fff2be"/></svg><p>● Ты здесь · У каждого жителя можно поговорить и узнать о его даре.</p></div>`;
}
