import { drawCaveTerrain } from "./forest-cave-surfaces.js";
import { exposedTerrainEdges } from "./wall-surfaces.js";
import { hasService, TOKEN_TYPES } from "./progression.js";

const geometry = new WeakMap();
const miniatures = new WeakMap();
function boundaries(world) {
  const signature = world.platforms
    .filter((s) => s.solid)
    .map((s) => s.id)
    .join(",");
  let cached = geometry.get(world);
  if (!cached || cached.signature !== signature) {
    const solid = world.platforms.filter((s) => s.solid && !s.absent);
    cached = {
      signature,
      solid,
      faces: solid.map((s) => {
        const edges = exposedTerrainEdges(s, solid);
        // World limits are buried earth, not exposed playable surfaces.
        if (s.x === 0) edges.left = [];
        if (s.y === 0) edges.top = [];
        if (s.x + s.w === world.width) edges.right = [];
        if (s.y + s.h === world.height) edges.bottom = [];
        return { s, edges };
      }),
    };
    geometry.set(world, cached);
  }
  return cached;
}
// The collision union defines the black mass; its exposed perimeter alone
// receives material and compact joins. Physics and map use the same geometry.
export function drawCavernTerrain(r, game) {
  const { solid, faces } = boundaries(game.world);
  drawCaveTerrain(r, game, faces, solid);
}

function discovered(world, point, all) {
  return (
    all ||
    world.rooms.some(
      (r) =>
        world.discovered.has(r.id) &&
        point.x >= r.x &&
        point.x < r.x + r.w &&
        point.y >= r.y &&
        point.y < r.y + r.h,
    )
  );
}
export function drawCavernMinimap(r, game) {
  const g = r.ctx,
    w = game.world,
    sw = 170,
    sh = 68,
    x = r.viewWidth - 190,
    y = 100;
  const all = game.progress.quests?.includes("stranger");
  const signature = `${all}:${[...w.discovered].join(":")}:${w.platforms.length}`;
  let cached = miniatures.get(w);
  if (cached?.signature !== signature) {
    const canvas = document.createElement("canvas");
    // Two pixels per map unit keeps the cached outline crisp on high-DPI screens.
    canvas.width = sw * 2;
    canvas.height = sh * 2;
    const map = canvas.getContext("2d");
    map.scale(canvas.width / w.width, canvas.height / w.height);
    map.beginPath();
    for (const room of w.rooms)
      if (all || w.discovered.has(room.id))
        map.rect(room.x, room.y, room.w, room.h);
    map.clip();
    map.fillStyle = "#508c75";
    for (const a of w.caverns) map.fillRect(a.x, a.y, a.w, a.h);
    map.fillStyle = "#041011";
    for (const s of w.platforms) if (s.solid) map.fillRect(s.x, s.y, s.w, s.h);
    cached = { signature, canvas };
    miniatures.set(w, cached);
  }
  g.fillStyle = "#041011e8";
  g.fillRect(x - 8, y - 8, sw + 16, sh + 22);
  g.drawImage(cached.canvas, x, y, sw, sh);
  g.fillStyle = "#fff2c9";
  g.beginPath();
  g.arc(
    x + ((game.player.x + 15) * sw) / w.width,
    y + ((game.player.y + 27) * sh) / w.height,
    3,
    0,
    Math.PI * 2,
  );
  g.fill();
}
export function cavernMapMarkup(game) {
  const w = game.world,
    p = game.player,
    all = game.progress.quests?.includes("stranger");
  const seen = (point) => discovered(w, point, all);
  const rect = (r, extra = "") =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extra}/>`;
  const { faces } = boundaries(w);
  const contour = faces
    .flatMap(({ s, edges }) =>
      ["top", "bottom", "left", "right"].flatMap((side) =>
        edges[side].map(([a, b]) => {
          const horizontal = side === "top" || side === "bottom";
          const x = s.x + (side === "right" ? s.w : 0),
            y = s.y + (side === "bottom" ? s.h : 0);
          if (
            (horizontal && (y === 0 || y === w.height)) ||
            (!horizontal && (x === 0 || x === w.width))
          )
            return "";
          return horizontal
            ? `M${s.x + a},${y}H${s.x + b}`
            : `M${x},${s.y + a}V${s.y + b}`;
        }),
      ),
    )
    .join(" ");
  return `<div class="forest-map"><div class="map-viewport" tabindex="0" aria-label="Карта леса: прокрути, чтобы увидеть дальние тропы" data-focus-x="${(p.x + 15) / w.width}" data-focus-y="${(p.y + 27) / w.height}"><svg viewBox="-70 -70 ${w.width + 140} ${w.height + 140}" role="img" aria-label="Дремучий грибной лес: реальные пещеры, тоннели и развилки"><defs><clipPath id="forest-discovery">${w.rooms
    .filter((r) => all || w.discovered.has(r.id))
    .map((r) => rect(r))
    .join("")}</clipPath></defs>
  <rect x="-70" y="-70" width="${w.width + 140}" height="${w.height + 140}" fill="#051112"/>
  <g clip-path="url(#forest-discovery)"><g fill="#234f43">${w.caverns.map((r) => rect(r)).join("")}</g><g fill="#051112">${w.platforms
    .filter((s) => s.solid)
    .map((s) => rect(s))
    .join(
      "",
    )}</g><path d="${contour}" fill="none" stroke="#84bba0" stroke-width="7"/>
  ${w.platforms
    .filter((s) => !s.solid || s.breakable)
    .map((s) => rect(s, `fill="${s.breakable ? "#dfb570" : "#7ea590"}"`))
    .join("")}</g>
  ${w.rooms
    .filter((r) => all || w.discovered.has(r.id))
    .map(
      (r) =>
        `<text x="${r.x + 40}" y="${r.y + 80}" fill="#d9d5b5" stroke="#051112" stroke-width="8" paint-order="stroke" font-size="64">${r.name}</text>`,
    )
    .join("")}
  ${w.tokens
    .filter((t) => t.revealed || t.collected)
    .map(
      (t) =>
        `<circle cx="${t.x}" cy="${t.y}" r="22" fill="${t.collected ? "#49675a" : TOKEN_TYPES[t.type].color}"/>`,
    )
    .join("")}
  ${(w.checkpoints || [w.checkpoint])
    .filter(seen)
    .map((c) => `<path d="M${c.x} ${c.y - 35}l-28 48h56Z" fill="#f3c788"/>`)
    .join("")}
  <circle cx="${p.x + 15}" cy="${p.y + 27}" r="26" fill="#fff7d9" stroke="#6ce2bc" stroke-width="9"/></svg></div>
  <p>Споровые поля → Старое сердце → крона / Зал фонарей → Висячие сады → Забытое дерево. Глубинные петли соединяют колодцы и привалы. ▲ Тёплый камень сохраняет место возвращения.</p>
  <div class="secret-list">${w.secrets.map((s) => `<span class="${s.found ? "found" : ""}">1.${s.id + 1} ${s.found ? "✓ " + s.name : hasService(game.progress, "compass") ? s.name : "Неизвестная тайна"}</span>`).join("")}</div></div>`;
}
