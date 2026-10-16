import { FOREST_ROOMS, forestRoom } from "./forest.js";
import { MOTHER_LABELS } from "./forest-boss.js";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function drawForestBackground(renderer, game) {
  const g = renderer.ctx,
    view = renderer.viewWidth,
    assets = renderer.assets;
  const root = clamp((game.cameraY - 180) / 320, 0, 1);
  const sanctum = clamp((game.camera - 2860) / 400, 0, 1);
  const layers = [
    ["canopy", (1 - root) * (1 - sanctum)],
    ["roots", root * (1 - sanctum)],
    ["sanctum", sanctum],
  ];
  g.fillStyle = "#06141d";
  g.fillRect(0, 0, view, 620);
  for (const [name, alpha] of layers) {
    const im = assets["forest-" + name];
    if (!im || alpha <= 0) continue;
    const h = 700,
      wi = (h * im.width) / im.height;
    const travel = Math.max(0, wi - view);
    const x = -travel * ((game.camera / (4550 - view)) * 0.7 + 0.15);
    g.globalAlpha = alpha;
    g.drawImage(im, x, -25 - (game.cameraY % 400) * 0.04, wi, h);
  }
  g.globalAlpha = 1;
  g.fillStyle = "#03121b22";
  g.fillRect(0, 0, view, 620);
}
export function drawForestTerrain(renderer, s, game) {
  const g = renderer.ctx,
    im = renderer.assets["forest-terrain"];
  if (!im) return;
  const camera = game.camera,
    cy = game.cameraY,
    view = renderer.viewWidth;
  const ledges = renderer.assets["forest-ledges"];
  const ledge = (x, y, width, index) => {
    if (!ledges) return;
    const row = Math.floor(index / 4),
      cw = ledges.width / 4,
      ch = ledges.height / 2;
    const tops = [230, 246, 260, 270, 650, 665, 670, 674];
    const scale = (width + 12) / cw;
    g.drawImage(
      ledges,
      (index % 4) * cw,
      row * ch,
      cw,
      ch,
      x - 6,
      y - (tops[index] - row * ch) * scale,
      cw * scale,
      ch * scale,
    );
  };
  if (!s.solid) {
    ledge(s.x, s.y, s.w, s.id % 8);
    return;
  }
  // Clip to viewport AND collision bounds. No full-world canvas allocation.
  g.save();
  g.beginPath();
  g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  const tw = 512,
    th = 342;
  for (
    let y = Math.max(s.y, s.y + Math.floor((cy - s.y) / th) * th);
    y < Math.min(s.y + s.h, cy + 620);
    y += th
  )
    for (
      let x = Math.max(s.x, s.x + Math.floor((camera - s.x) / tw) * tw);
      x < Math.min(s.x + s.w, camera + view);
      x += tw
    )
      g.drawImage(im, 0, 100, im.width, im.height - 100, x, y, tw, th);
  g.restore();
  // Transparent painted overhangs replace rectangular texture fringes.
  if (!s.wall && !s.ceiling) {
    g.save();
    g.beginPath();
    g.rect(s.x - 3, s.y - 85, s.w + 6, 110);
    g.clip();
    const parts = Math.max(1, Math.ceil(s.w / 300)),
      width = s.w / parts;
    for (let n = 0; n < parts; n++)
      if (s.x + (n + 1) * width > camera && s.x + n * width < camera + view)
        ledge(s.x + n * width, s.y, width, (s.id + n) % 8);
    g.restore();
  }
  g.strokeStyle = s.breakable ? "#e0b982" : s.wall ? "#63d7c5aa" : "#7eb8a277";
  g.lineWidth = s.breakable ? 3 : 1;
  if (s.wall) {
    g.beginPath();
    g.moveTo(s.x + 2, s.y);
    g.lineTo(s.x + 2, s.y + s.h);
    g.moveTo(s.x + s.w - 2, s.y);
    g.lineTo(s.x + s.w - 2, s.y + s.h);
    g.stroke();
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
}
export function drawForestDetails(renderer, game) {
  const g = renderer.ctx,
    w = game.world;
  for (const sign of w.signs) {
    if (
      sign.x < game.camera - 150 ||
      sign.x > game.camera + renderer.viewWidth + 150 ||
      Math.abs(sign.y - game.cameraY - 310) > 400
    )
      continue;
    g.font = "bold 10px Arial";
    g.textAlign = "center";
    const width = g.measureText(sign.text).width + 20;
    g.fillStyle = "#081c23dd";
    g.fillRect(sign.x - width / 2, sign.y - 16, width, 23);
    g.strokeStyle = "#688d7877";
    g.strokeRect(sign.x - width / 2, sign.y - 16, width, 23);
    g.fillStyle = "#d1d8b4";
    g.fillText(sign.text, sign.x, sign.y);
  }
  for (const a of w.hazards) {
    const cx = a.x + a.w / 2;
    if (a.delay > 0) {
      g.strokeStyle = "#ffcf8c";
      g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.strokeRect(a.x, 496, a.w, 4);
      g.setLineDash([]);
      renderer.glow(
        cx,
        490,
        a.w * 0.7,
        "#ffc27b",
        0.12 + 0.14 * (1 - a.delay / a.total),
      );
      g.fillStyle = "#ffdcad";
      g.font = "bold 16px Arial";
      g.textAlign = "center";
      g.fillText("!", cx, 480);
    } else {
      const rise = Math.min(1, (Math.abs(a.delay) + 1 / 60) * 10);
      g.fillStyle = "#324843";
      g.strokeStyle = "#96b3a2";
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const x = a.x + ((i + 0.5) * a.w) / 3;
        g.beginPath();
        g.moveTo(x - 12, 500);
        g.quadraticCurveTo(x - 23, 450, x + 8, 500 - a.h * rise);
        g.quadraticCurveTo(x + 7, 466, x + 17, 500);
        g.fill();
        g.stroke();
      }
      renderer.glow(cx, 470, a.w, "#ac78f1", 0.2);
    }
  }
  if (w.boss.active && !w.boss.dead) {
    g.strokeStyle = "#9675bbaa";
    g.lineWidth = 7;
    for (const x of [3475, 4405]) {
      g.beginPath();
      g.moveTo(x, 500);
      g.bezierCurveTo(x - 20, 420, x + 15, 360, x, 325);
      g.stroke();
    }
  }
}
export function drawMother(renderer, game) {
  const b = game.world.boss,
    g = renderer.ctx,
    im = renderer.assets["forest-mother-attacks-atlas"];
  if (!im || (b.pose == null && !b.dead && !b.hit)) return false;
  const frame = b.dead
      ? b.deathTime < 0.35
        ? 22
        : 23
      : b.hit > 0
        ? b.hit > 0.08
          ? 20
          : 21
        : b.pose,
    cell = 320,
    size = 235;
  g.save();
  g.translate(b.x + b.w / 2, b.y + b.h);
  g.scale(-b.dir, 1);
  // Shared source scale/foot anchors preserve crouches and burrowing silhouettes.
  g.globalAlpha = b.dead
    ? Math.max(0, 1 - b.deathTime / 1.2)
    : b.state === "strike" && b.move === "burrow" && b.elapsed < 0.5
      ? 0.45
      : 1;
  g.drawImage(
    im,
    (frame % 4) * cell,
    Math.floor(frame / 4) * cell,
    cell,
    cell,
    -size / 2,
    (-size * 304) / 320,
    size,
    size,
  );
  g.restore();
  return true;
}
export function drawForestBossTell(renderer, game) {
  const b = game.world.boss,
    g = renderer.ctx;
  if (!b.active || b.dead || b.phase !== 1) return;
  g.font = "bold 11px Arial";
  g.textAlign = "center";
  g.fillStyle = "#ffe0aa";
  g.fillText(MOTHER_LABELS[b.move] || "ПРИГОТОВЬСЯ…", b.x + b.w / 2, b.y - 75);
}
export function drawForestMinimap(renderer, game) {
  const g = renderer.ctx,
    w = game.world,
    sw = 170,
    sh = 60,
    x = renderer.viewWidth - sw - 20,
    y = 100;
  g.fillStyle = "#06131bcc";
  g.fillRect(x - 8, y - 8, sw + 16, sh + 36);
  g.strokeStyle = "#73a79b55";
  g.strokeRect(x - 8, y - 8, sw + 16, sh + 36);
  for (const s of w.platforms) {
    g.fillStyle = s.breakable ? "#cba775" : "#7bab9b88";
    g.fillRect(
      x + (s.x / 4550) * sw,
      y + (s.y / 1600) * sh,
      Math.max(1, (s.w / 4550) * sw),
      Math.max(1, (s.h / 1600) * sh),
    );
  }
  for (const t of w.tokens) {
    if (!t.collected && (!t.secret || w.discovered.has("secret"))) {
      g.fillStyle = "#f3c981";
      g.fillRect(x + (t.x / 4550) * sw - 1, y + (t.y / 1600) * sh - 1, 3, 3);
    }
  }
  g.fillStyle = "#fff5c9";
  g.beginPath();
  g.arc(
    x + ((game.player.x + 15) / 4550) * sw,
    y + ((game.player.y + 27) / 1600) * sh,
    3,
    0,
    Math.PI * 2,
  );
  g.fill();
  g.font = "10px Arial";
  g.textAlign = "center";
  g.fillStyle = "#d2ddc9";
  g.fillText(forestRoom(game.player).name, x + sw / 2, y + sh + 17);
}
export function forestMapMarkup(game) {
  const w = game.world,
    p = game.player;
  return `<div class="forest-map"><svg viewBox="-80 -80 4710 1790" role="img" aria-label="Карта туннелей Дремучего грибного леса. Белая точка — герой.">
  <rect x="-80" y="-80" width="4710" height="1790" fill="#06131d"/>
  ${FOREST_ROOMS.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${w.discovered.has(r.id) ? "#163a3a" : "#101e2a"}" stroke="#446260" stroke-width="6"/>`).join("")}
  ${w.platforms.map((s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${Math.max(15, s.h)}" fill="${s.breakable ? "#b28f5f" : "#5b9d88"}"/>`).join("")}
  ${FOREST_ROOMS.map((r) => {
    const y = {
      fields: 220,
      roots: 780,
      undercroft: 1220,
      shaft: 350,
      hearth: 665,
      secret: 245,
      canopy: 470,
      sanctum: 145,
    }[r.id];
    return `<text x="${r.x + 30}" y="${y}" fill="#e1dfbf" stroke="#06131d" stroke-width="7" paint-order="stroke" font-size="48">${r.name}</text>`;
  }).join("")}
  ${w.tokens.map((t) => `<circle cx="${t.x}" cy="${t.y}" r="25" fill="${t.collected ? "#53635e" : "#f7c96d"}"/><text x="${t.x + 35}" y="${t.y + 15}" fill="#e9d6aa" font-size="45">${t.id + 1}</text>`).join("")}
  <path d="M2240 965 l-35 60 h70 Z" fill="#efbe76"/>
  <circle cx="${p.x + p.w / 2}" cy="${p.y + p.h / 2}" r="32" fill="#fff7d9" stroke="#81f2da" stroke-width="12"/>
  </svg><p>● Ты здесь · <span style="color:#f7c96d">● Светлячки</span> · ▲ Тёплый камень · Золотые стены можно разбить атакой. Верхний путь и нижний тоннель соединяются у колодца корней.</p></div>`;
}
