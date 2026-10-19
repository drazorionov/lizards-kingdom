import {
  drawCaveBody,
  drawCaveEdge,
  drawCaveWalls,
  drawCaveConnections,
} from "./forest-cave-surfaces.js";
import { exposedTerrainEdges } from "./wall-surfaces.js";
import { hasService, TOKEN_TYPES } from "./progression.js";

const geometry = new WeakMap();
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
const visible = (s, r, game) =>
  s.x + s.w >= game.camera - 80 &&
  s.x <= game.camera + r.viewWidth + 80 &&
  s.y + s.h >= game.cameraY - 80 &&
  s.y <= game.cameraY + 700;

export function drawCavernTerrain(r, game, ledge) {
  const g = r.ctx;
  const { solid, faces } = boundaries(game.world);
  // One continuous mass, not one sprite per collider. This also removes visual
  // seams when floor, wall and ceiling rectangles belong to the same landform.
  g.save();
  g.beginPath();
  for (const s of solid)
    if (!s.breakable && visible(s, r, game)) g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  drawCaveBody(r, game, faces);
  // Rock strata fade into the dark interior; the playable edge carries detail.
  for (const { s, edges } of faces) {
    if (s.breakable || !visible(s, r, game)) continue;
    for (const side of ["top", "bottom", "left", "right"]) {
      for (const [a, b] of edges[side]) {
        g.beginPath();
        if (side === "top" || side === "bottom") {
          const y = s.y + (side === "bottom" ? s.h : 0);
          g.moveTo(s.x + a, y);
          g.lineTo(s.x + b, y);
        } else {
          const x = s.x + (side === "right" ? s.w : 0);
          g.moveTo(x, s.y + a);
          g.lineTo(x, s.y + b);
        }
        g.strokeStyle = "#166a7544";
        g.lineWidth = 12;
        g.stroke();
        g.strokeStyle = "#4bbdb633";
        g.lineWidth = 2;
        g.stroke();
      }
    }
  }
  g.restore();
  for (const { s, edges } of faces) {
    if (s.breakable || !visible(s, r, game)) continue;
    drawCaveWalls(r, s, edges);
    for (const [a, b] of edges.top) {
      if (b - a < 28) continue;
      if (s.y < game.cameraY - 75 || s.y > game.cameraY + 680) continue;
      if (drawCaveEdge(r, s.x + a, s.y, b - a, false, s.y > 1100 ? 1 : 0))
        continue;
      g.save();
      g.beginPath();
      g.rect(s.x + a, s.y - 48, b - a, 110);
      g.clip();
      const count = Math.max(1, Math.ceil((b - a) / 220)),
        width = (b - a) / count;
      for (let i = 0; i < count; i++) {
        const x = s.x + a + i * width;
        if (x + width > game.camera && x < game.camera + r.viewWidth)
          ledge(x, s.y, width, (s.id + i) % 8);
      }
      g.restore();
    }
    // Dedicated ceiling art hangs from the actual collision underside.
    for (const [a, b] of edges.bottom) {
      const y = s.y + s.h;
      if (b - a < 28 || y < game.cameraY - 60 || y > game.cameraY + 620)
        continue;
      if (drawCaveEdge(r, s.x + a, y, b - a, true, y > 900 ? 1 : 0)) continue;
      g.save();
      g.beginPath();
      g.rect(s.x + a, y - 30, b - a, 67);
      g.clip();
      const count = Math.max(1, Math.ceil((b - a) / 230)),
        width = (b - a) / count;
      for (let i = 0; i < count; i++) {
        const x = s.x + a + i * width;
        if (x + width > game.camera && x < game.camera + r.viewWidth)
          ledge(x, y - 42, width, (s.id + i) % 8);
      }
      g.restore();
    }
  }
  drawCaveConnections(r, game, faces, solid);
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
  g.save();
  g.fillStyle = "#041011e8";
  g.fillRect(x - 8, y - 8, sw + 16, sh + 22);
  g.translate(x, y);
  g.scale(sw / w.width, sh / w.height);
  g.beginPath();
  for (const room of w.rooms)
    if (all || w.discovered.has(room.id))
      g.rect(room.x, room.y, room.w, room.h);
  g.clip();
  g.fillStyle = "#508c75";
  for (const a of w.caverns) g.fillRect(a.x, a.y, a.w, a.h);
  g.fillStyle = "#041011";
  for (const s of w.platforms) if (s.solid) g.fillRect(s.x, s.y, s.w, s.h);
  g.restore();
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
  return `<div class="forest-map"><svg viewBox="-70 -70 ${w.width + 140} ${w.height + 140}" role="img" aria-label="Дремучий грибной лес: реальные пещеры, тоннели и развилки"><defs><clipPath id="forest-discovery">${w.rooms
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
        `<text x="${r.x + 40}" y="${r.y + 80}" fill="#d9d5b5" stroke="#051112" stroke-width="8" paint-order="stroke" font-size="38">${r.name}</text>`,
    )
    .join("")}
  ${w.tokens
    .filter((t) => t.revealed || t.collected)
    .map(
      (t) =>
        `<circle cx="${t.x}" cy="${t.y}" r="22" fill="${t.collected ? "#49675a" : TOKEN_TYPES[t.type].color}"/>`,
    )
    .join("")}
  ${seen(w.checkpoint) ? `<path d="M${w.checkpoint.x} ${w.checkpoint.y - 35}l-28 48h56Z" fill="#f3c788"/>` : ""}
  <circle cx="${p.x + 15}" cy="${p.y + 27}" r="26" fill="#fff7d9" stroke="#6ce2bc" stroke-width="9"/></svg>
  <p>Споровые поля → верхняя тропа / спуск к корням → колодец и тёплый камень → грибная чаща → Забытое дерево. Нижний тоннель замыкает обратный путь.</p>
  <div class="secret-list">${w.secrets.map((s) => `<span class="${s.found ? "found" : ""}">1.${s.id + 1} ${s.found ? "✓ " + s.name : hasService(game.progress, "compass") ? s.name : "Неизвестная тайна"}</span>`).join("")}</div></div>`;
}
