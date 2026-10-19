import { drawHero } from "./hero-animation.js";
import { nearbyResident, residentProgress } from "./town.js";
import townArt from "./town-art.json" with { type: "json" };

const TAU = Math.PI * 2;
const HOUSE_INDEX = {
  guard: 0,
  forge: 1,
  barracks: 2,
  inn: 3,
  market: 4,
  garden: 5,
  spring: 6,
  training: 7,
  nest: 8,
  observatory: 9,
  council: 10,
  hollow: 11,
};
function noise(n) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}
function label(g, text, x, y, color = "#ead7ae", size = 12) {
  g.font = `${size}px Georgia`;
  g.textAlign = "center";
  g.strokeStyle = "#0a151de6";
  g.lineWidth = 4;
  g.lineJoin = "round";
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}
function houseBounds(n) {
  const frame = townArt.homes[HOUSE_INDEX[n.kind]];
  const height = n.kind === "council" ? 232 : n.kind === "guard" ? 204 : 220;
  const width = (frame.rect[2] / frame.rect[3]) * height;
  return {
    frame,
    x: n.x + 30 - width / 2,
    y: n.y - height + 3,
    w: width,
    h: height,
  };
}
function paintedTerrace(g, s, assets) {
  const index = s.ground
    ? 1
    : s.material === "rock"
      ? 3
      : s.material === "wood"
        ? 2
        : 0;
  const frame = townArt.platforms[index];
  if (s.ground) {
    g.save();
    g.beginPath();
    g.rect(s.x, s.y + 5, s.w, s.h);
    g.clip();
    for (let x = s.x; x < s.x + s.w; x += 512)
      g.drawImage(assets["forest-terrain"], x, s.y, 512, 340);
    g.restore();
  }
  // Overlapping painted segments keep the entire collision surface visible.
  const count = Math.ceil(s.w / 350),
    tileWidth = s.w / count;
  for (let i = 0; i < count; i++) {
    const bleed = i < count - 1 ? 14 : 0;
    const scale = (tileWidth + bleed) / frame.rect[2];
    g.drawImage(
      assets["town-platforms-painted"],
      ...frame.rect,
      s.x + i * tileWidth,
      s.y - frame.surface * scale,
      tileWidth + bleed,
      frame.rect[3] * scale,
    );
  }
}
function paintedSettlement(r, world) {
  const canvas = document.createElement("canvas");
  canvas.width = world.width;
  canvas.height = world.height;
  const g = canvas.getContext("2d");
  for (const s of world.platforms) paintedTerrace(g, s, r.assets);
  for (const n of world.npcs) {
    const b = houseBounds(n);
    g.drawImage(
      r.assets["town-homes-painted"],
      ...b.frame.rect,
      b.x,
      b.y,
      b.w,
      b.h,
    );
  }
  return canvas;
}
function atmosphere(r, game) {
  const g = r.ctx,
    t = game.time;
  // Small animated effects sit over the painted light sources.
  for (const n of game.world.npcs) {
    if (
      Math.abs(n.x - game.camera - r.viewWidth / 2) > r.viewWidth / 2 + 180 ||
      Math.abs(n.y - game.cameraY - 310) > 420
    )
      continue;
    if (n.kind === "forge") {
      r.glow(n.x + 10, n.y - 50, 53, "#f5a653", 0.08 + Math.sin(t * 5) * 0.025);
      for (let i = 0; i < 7; i++) {
        const rise = (t * 18 + i * 16) % 112;
        g.fillStyle = `rgba(195,186,164,${0.1 * (1 - rise / 112)})`;
        g.beginPath();
        g.ellipse(
          n.x + 15 + Math.sin(t + i) * 7,
          n.y - 203 - rise,
          6 + rise * 0.1,
          7 + rise * 0.09,
          0,
          0,
          TAU,
        );
        g.fill();
      }
    }
    if (n.kind === "spring")
      r.glow(n.x + 25, n.y - 45, 42, "#6bd2dd", 0.09 + Math.sin(t * 2) * 0.025);
  }
  for (let i = 0; i < 38; i++) {
    const x = noise(i + 13) * game.world.width + Math.sin(t * 0.3 + i) * 20;
    const y = noise(i + 86) * 1300 + Math.cos(t * 0.5 + i) * 13;
    g.fillStyle = `rgba(236,214,145,${0.25 + Math.sin(t + i) * 0.2})`;
    g.beginPath();
    g.arc(x, y, 1.3, 0, TAU);
    g.fill();
  }
}
export function drawTown(r, game) {
  const g = r.ctx,
    w = game.world,
    p = game.player,
    t = game.time;
  g.setTransform(r.scale, 0, 0, r.scale, 0, 0);
  g.fillStyle = "#07121b";
  g.fillRect(0, 0, r.viewWidth, 620);
  g.save();
  g.translate(-game.camera, -game.cameraY);
  g.drawImage(r.assets["town-tree-painted"], 0, 0, w.width, w.height);
  g.fillStyle = "#04131b2b";
  g.fillRect(0, 0, w.width, w.height);
  if (r.townSceneryWorld !== w) {
    r.townScenery = paintedSettlement(r, w);
    r.townSceneryWorld = w;
  }
  g.drawImage(r.townScenery, 0, 0);
  atmosphere(r, game);
  const near = nearbyResident(w, p);
  for (const n of w.npcs) {
    if (
      n.x < game.camera - 200 ||
      n.x > game.camera + r.viewWidth + 200 ||
      n.y < game.cameraY - 50 ||
      n.y > game.cameraY + 820
    )
      continue;
    const active = near?.id === n.id;
    const frame = (active ? 2 : 0) + (Math.floor(t * (active ? 4 : 2)) % 2);
    const size = n.id === "child" ? 88 : 122;
    g.drawImage(
      r.assets[`town-npcs-${n.sheet}-atlas`],
      frame * 256,
      n.row * 256,
      256,
      256,
      n.x - size / 2,
      n.y - (size * 240) / 256,
      size,
      size,
    );
    label(g, n.name, n.x, n.y - size - 9, active ? "#fff0c4" : "#e2d6b7", 11);
    const status = residentProgress(n, game.progress);
    if ((n.service || n.quest) && !status.done && status.ready)
      label(g, "◆", n.x, n.y - size - 28, "#f2d38b", 12);
    const b = houseBounds(n);
    label(g, n.home, n.x + 30, b.y - 9, "#d6c8a4", 11);
  }
  for (const [x, y, text] of [
    [230, 1205, "↑ К рынку"],
    [2395, 935, "Жилые ветви ↑"],
    [645, 665, "↑ К дому совета"],
  ])
    label(g, text, x, y, "#ead6a7", 12);
  for (const portal of w.portals) {
    r.gate(portal.x, portal.y + 27, t, true);
    label(g, portal.name, portal.x, portal.y - 147, "#ead7ae", 11);
  }
  drawHero(
    g,
    r.assets[`hero-${p.hero ? "urmasa" : "quirel"}-painted-atlas`],
    p,
  );
  if (near) {
    const x = Math.max(
      game.camera + 140,
      Math.min(game.camera + r.viewWidth - 140, near.x),
    );
    const y = near.y + 32;
    g.fillStyle = "#0a1824ed";
    g.beginPath();
    g.roundRect(x - 131, y - 16, 262, 28, 8);
    g.fill();
    label(g, "ПРОБЕЛ / МЕЧ · ГОВОРИТЬ", x, y + 2, "#fff0c4", 11);
  }
  g.restore();
  const district = [...w.districts].sort(
    (a, b) => Math.abs(a.y - p.y - p.h) - Math.abs(b.y - p.y - p.h),
  )[0];
  g.fillStyle = "#07131cda";
  g.beginPath();
  g.roundRect(22, 94, 292, 58, 10);
  g.fill();
  g.textAlign = "left";
  g.fillStyle = "#e7d2a4";
  g.font = "15px Georgia";
  g.fillText(district.name, 37, 118);
  g.fillStyle = "#b7bba8";
  g.font = "11px Arial";
  g.fillText("ДРЕВОГРАД  /  ДОМА В ВЕТВЯХ", 37, 138);
  r.frameCount++;
  const now = performance.now();
  if (now - r.lastFps >= 1000) {
    r.fps = Math.round((r.frameCount * 1000) / (now - r.lastFps));
    r.frameCount = 0;
    r.lastFps = now;
  }
}
export function townMapMarkup(game) {
  const w = game.world;
  return `<div class="forest-map"><svg viewBox="0 210 ${w.width} 1240" role="img" aria-label="Древоград: четыре яруса вокруг древнего дерева, дома жителей и соединяющие их уступы"><rect y="210" width="${w.width}" height="1240" fill="#10282e"/><path d="M1050 1390 Q1640 1100 1520 260 M1500 1110 L600 1060 M1520 820 L2140 790 M1520 540 L940 520" fill="none" stroke="#3e5845" stroke-width="110"/>${w.platforms.map((s) => `<path d="M${s.x} ${s.y} h${s.w}" stroke="#aaab7e" stroke-width="15"/>`).join("")}${w.districts.map((d) => `<text x="40" y="${d.y - 180}" fill="${d.color}" font-size="29">${d.name}</text>`).join("")}${w.npcs.map((n) => `<g><title>${n.name} · ${n.home} · ${n.role}</title><path d="M${n.x - 55} ${n.y - 9} v-77 l55-31 55 31 v77Z" fill="#617862" stroke="#c7b582" stroke-width="4"/><circle cx="${n.x}" cy="${n.y - 45}" r="12" fill="#e8c388"/><text x="${n.x}" y="${n.y + 40}" text-anchor="middle" fill="#efdfb9" font-size="26">${n.name}</text></g>`).join("")}<circle cx="${game.player.x + 15}" cy="${game.player.y + 27}" r="20" fill="#fff3ba" stroke="#83cfb8" stroke-width="7"/><text x="125" y="1390" text-anchor="middle" fill="#b7d4c5" font-size="25">Выход</text></svg><p>● Ты здесь · Поднимайся по уступам: слева к рынку, справа к жилым ветвям, затем слева к кроне. ↑ / W или кнопка прыжка — прыгать; нажми ещё раз в воздухе для второго прыжка.</p><div class="secret-list">${w.districts
    .map(
      (d) =>
        `<span>${d.name}: ${w.npcs
          .filter((n) => n.district === d.id)
          .map((n) => n.name)
          .join(", ")}</span>`,
    )
    .join("")}</div></div>`;
}
