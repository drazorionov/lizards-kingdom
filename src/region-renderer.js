import { drawCavernMinimap, cavernMapMarkup } from "./cavern-renderer.js";
import { drawSolidTerrain, drawBreakableWall } from "./terrain.js";
export { drawTown, townMapMarkup } from "./town-renderer.js";
import { regionBossFrame } from "./region-boss.js";
import {
  drawForestBackground,
  drawForestTerrain,
  drawForestDetails,
} from "./forest-renderer.js";
import { TOKEN_TYPES, growth, hasService } from "./progression.js";
import { roomAt } from "./regions.js";
import {
  MINIMAP_INK,
  minimapLayout,
  minimapPoint,
  drawMinimapMarkers,
} from "./minimap.js";
const TAU = Math.PI * 2;
export function regionBackground(r, game) {
  if (game.world.region === 0) return drawForestBackground(r, game);
  const g = r.ctx,
    im = r.assets[game.world.artKey + "-background"];
  g.fillStyle = game.region.sky;
  g.fillRect(0, 0, r.viewWidth, 620);
  if (!im) return;
  const h = 900,
    w = (h * im.width) / im.height;
  g.drawImage(
    im,
    -Math.max(0, w - r.viewWidth) *
      (game.camera / Math.max(1, game.world.width - r.viewWidth)),
    -40 - (200 * game.cameraY) / Math.max(1, game.world.height - 620),
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
  if (s.breakable) drawBreakableWall(r, s, game);
  else drawSolidTerrain(r, s, game, ledge, im);
  g.restore();
}
export function regionDetails(r, game) {
  if (game.world.region === 0) drawForestDetails(r, game);
  const g = r.ctx,
    w = game.world;
  if (w.region !== 0) {
    for (const a of w.hazards) drawRegionalHazard(r, a, game);
  }
  // Healing at a checkpoint shares its shrine; only remote springs get an object.
  for (const spring of w.springs || []) {
    const shared = (w.checkpoints || [w.checkpoint]).some(
      (camp) => Math.hypot(camp.x - spring.x, camp.y + 50 - spring.y) < 1,
    );
    if (!shared) r.beacon(spring.x, spring.y, game.time, false, true);
  }
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
    g.save();
    g.globalAlpha *= 0.6;
    if (
      Math.hypot(portal.x - game.player.x - 15, portal.y - game.player.y - 27) <
      120
    )
      g.fillText(portal.name, portal.x, portal.y - 65);
    g.restore();
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
  if (game.world.caverns) return drawCavernMinimap(r, game);
  const g = r.ctx,
    w = game.world;
  const all = game.progress.quests?.includes("stranger");
  const seen = (point) => all || visibleRoom(w, point);
  const layout = minimapLayout(r, w, all);
  g.save();
  g.lineWidth = 1.25 * layout.unit;
  for (const s of w.platforms) {
    if (!seen(s)) continue;
    const [x, y] = minimapPoint(layout, s.x, s.y);
    g.strokeStyle = MINIMAP_INK;
    g.beginPath();
    if (s.solid) g.rect(x, y, s.w * layout.zoom, s.h * layout.zoom);
    else {
      g.moveTo(x, y);
      g.lineTo(x + s.w * layout.zoom, y);
    }
    g.stroke();
  }
  for (const t of w.tokens) {
    if (!t.revealed || t.collected) continue;
    const [x, y] = minimapPoint(layout, t.x, t.y);
    g.fillStyle = MINIMAP_INK;
    g.beginPath();
    g.arc(x, y, 2 * layout.unit, 0, TAU);
    g.fill();
  }
  drawMinimapMarkers(r, game, layout, seen);
  g.restore();
}
export function regionMapMarkup(game) {
  if (game.world.caverns) return cavernMapMarkup(game);
  const w = game.world,
    p = game.player,
    all = game.progress.quests?.includes("stranger"),
    hints = hasService(game.progress, "compass");
  const seen = (s) => all || visibleRoom(w, s);
  return `<div class="forest-map"><svg viewBox="-80 -80 4710 1790" role="img" aria-label="Карта ${game.region.name}; неизвестные комнаты скрыты">${w.rooms
    .filter((r) => all || w.discovered.has(r.id))
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#8cbaa7" stroke-width="4"/><text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" text-anchor="middle" dominant-baseline="middle" fill="#f0e7ca" font-size="48">${r.name}</text>`,
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
        `<circle cx="${t.x}" cy="${t.y}" r="24" opacity="${t.collected ? 0.35 : 1}" fill="${t.collected ? "#52635e" : TOKEN_TYPES[t.type].color}"/>`,
    )
    .join("")}${w.secrets
    .filter((s) => s.found)
    .map(
      (s) =>
        `<text x="${s.x + 25}" y="${s.y - 30}" fill="#f485bc" font-size="48">${w.region + 1}.${s.id + 1}</text>`,
    )
    .join(
      "",
    )}${seen(w.checkpoint) ? `<path d="M${w.checkpoint.x} ${w.checkpoint.y - 40} l-35 60 h70 Z" fill="#efbd78"/>` : ""}<circle cx="${p.x + 15}" cy="${p.y + 27}" r="30" fill="#fff5d5" stroke="#75e4cc" stroke-width="10"/></svg><p>● Ты здесь · ▲ Тёплый камень · Золотые трещины: атакуй · Неизведанные комнаты и спрятанные жетоны скрыты.</p><div class="secret-list">${w.secrets.map((s) => `<span class="${s.found ? "found" : ""}">${w.region + 1}.${s.id + 1} ${s.found ? "✓ " + s.name : hints ? s.name : "Неизвестная тайна"}</span>`).join("")}</div>${game.progress.quests?.includes("dar") ? "<p>Дар: нижние тоннели возвращаются к тёплому камню. От него ищи уступы справа и колодец слева.</p>" : ""}</div>`;
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
