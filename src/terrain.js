import { caveStoneTexture } from "./forest-cave-surfaces.js";
import { terrainEdges, drawVerticalMaterial } from "./wall-surfaces.js";
// Painted terrain uses the same ledge kit as one-way platforms. Geometry here is
// decorative: the authored collision rectangles remain the source of truth.
const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const palettes = [
  ["#40584a", "#73816a", "#b2ad7c"],
  ["#4e5840", "#89916b", "#bfc28b"],
  ["#43566c", "#7c92aa", "#bed7eb"],
  ["#674e40", "#a18160", "#d8b481"],
  ["#344f62", "#668e9d", "#a3c9cb"],
  ["#584763", "#90799f", "#cab3db"],
];

export function terrainPalette(region) {
  return palettes[region] || palettes[0];
}

function polygon(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

export function drawSolidTerrain(r, s, game, ledge, texture, forest = false) {
  const edges = terrainEdges(game.world, s);
  const g = r.ctx,
    seed = s.id * 19,
    points = [
      [s.x, s.y],
      [s.x + s.w, s.y],
    ];
  // Narrow, uneven silhouettes keep the readable top and wall contact planes.
  for (let y = 16; y < s.h; y += 24)
    points.push([s.x + s.w + noise(seed + y) * 7, s.y + y]);
  points.push([s.x + s.w, s.y + s.h]);
  for (let x = s.w - 16; x > 0; x -= 27)
    points.push([s.x + x, s.y + s.h + 3 + noise(seed + x) * 12]);
  points.push([s.x, s.y + s.h]);
  for (let y = s.h - 16; y > 0; y -= 24)
    points.push([s.x - noise(seed + y + 8) * 7, s.y + y]);
  g.save();
  polygon(g, points);
  g.clip();
  g.fillStyle = terrainPalette(game.world.region)[0];
  g.fillRect(s.x - 8, s.y, s.w + 16, s.h + 16);
  const th = forest ? 342 : 512;
  for (
    let y = s.y + Math.max(0, Math.floor((game.cameraY - s.y) / th)) * th;
    y < Math.min(s.y + s.h + 16, game.cameraY + 650);
    y += th
  )
    for (
      let x =
        s.x - 8 + Math.max(0, Math.floor((game.camera - s.x) / 512)) * 512;
      x < Math.min(s.x + s.w + 8, game.camera + r.viewWidth + 20);
      x += 512
    ) {
      if (texture)
        g.drawImage(
          texture,
          0,
          forest ? 100 : 0,
          texture.width,
          texture.height - (forest ? 100 : 0),
          x,
          y,
          512,
          th,
        );
    }
  // Shade the rock under its painted lip, removing the flat tiled-panel look.
  const shade = g.createLinearGradient(0, s.y, 0, s.y + Math.min(s.h, 160));
  shade.addColorStop(0, "#07172000");
  shade.addColorStop(0.45, "#07172022");
  shade.addColorStop(1, "#020c1677");
  g.fillStyle = shade;
  g.fillRect(s.x - 8, s.y, s.w + 16, s.h + 16);
  g.restore();
  drawVerticalMaterial(r, s, game, edges, !!s.wall);

  const edge = (x, y, length, angle, first, last, inset = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    for (const [a, b] of edges.top) g.rect(a, first, b - a, last - first);
    g.clip();
    const count = Math.max(1, Math.ceil(length / 230)),
      width = length / count;
    for (let i = 0; i < count; i++) {
      // Cull in world coordinates, including rotated wall strips.
      const cx = x + Math.cos(angle) * (i + 0.5) * width;
      const cy = y + Math.sin(angle) * (i + 0.5) * width;
      if (
        cx + width < game.camera ||
        cx - width > game.camera + r.viewWidth ||
        cy + width < game.cameraY ||
        cy - width > game.cameraY + 620
      )
        continue;
      ledge(i * width, -inset, width, (s.id + i) % 8);
    }
    g.restore();
  };
  edge(s.x, s.y, s.w, 0, -65, Math.min(s.h + 12, 90));
  // Side faces use upright material; adjoining solids have no internal fringe.
}

// Shared fracture mesh: the visible stones become the actual animated debris.
export function wallFragments(s) {
  const cols = Math.max(2, Math.ceil(s.w / 28)),
    rows = Math.max(2, Math.ceil(s.h / 36));
  const vertex = (c, row) => [
    s.x +
      (c * s.w) / cols +
      (c === 0 || c === cols ? 0 : (noise(s.id + row * 37 + c) - 0.5) * 12),
    s.y +
      (row * s.h) / rows +
      (row === 0 || row === rows
        ? 0
        : (noise(s.id + row * 21 + c * 7) - 0.5) * 13),
  ];
  const pieces = [];
  for (let row = 0; row < rows; row++)
    for (let c = 0; c < cols; c++) {
      const points = [
        vertex(c, row),
        vertex(c + 1, row),
        vertex(c + 1, row + 1),
        vertex(c, row + 1),
      ];
      const x = points.reduce((sum, p) => sum + p[0], 0) / 4;
      const y = points.reduce((sum, p) => sum + p[1], 0) / 4;
      pieces.push({
        x,
        y,
        points: points.map(([px, py]) => [(px - x) * 0.96, (py - y) * 0.97]),
        tone: (c + row) % 2,
        textureX: x - s.x,
        textureY: y - s.y,
      });
    }
  return pieces;
}

function stone(g, piece, palette, texture, forest) {
  polygon(g, piece.points);
  g.fillStyle = palette[piece.tone];
  g.fill();
  if (texture) {
    g.save();
    g.clip();
    g.drawImage(
      texture,
      0,
      forest ? 100 : 0,
      texture.width,
      texture.height - (forest ? 100 : 0),
      -piece.textureX,
      -piece.textureY,
      256,
      512,
    );
    const shade = g.createLinearGradient(-16, -20, 20, 22);
    shade.addColorStop(0, "#e6d6ac22");
    shade.addColorStop(0.4, "#050c1200");
    shade.addColorStop(1, "#050c1288");
    g.fillStyle = shade;
    g.fillRect(-40, -40, 80, 80);
    g.restore();
  }
  g.strokeStyle = "#1a2527";
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const [x, y] = piece.points[i];
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.strokeStyle = palette[2] + "88";
  g.lineWidth = 0.7;
  g.stroke();
  // Fine facets and mineral flecks keep the masonry from looking flat.
  g.fillStyle = palette[2];
  g.globalAlpha *= 0.3;
  g.fillRect(-3, -4, 6, 2);
}

export function drawBreakableWall(r, s, game) {
  const g = r.ctx,
    palette = terrainPalette(game.world.region);
  g.save();
  g.fillStyle = "#332c24";
  g.fillRect(s.x, s.y, s.w, s.h);
  for (const piece of wallFragments(s)) {
    g.save();
    g.translate(piece.x, piece.y);
    stone(
      g,
      piece,
      palette,
      game.world.region === 0
        ? caveStoneTexture(r) || r.assets["forest-terrain"]
        : caveStoneTexture(r) || r.assets[game.world.artKey + "-terrain"],
      game.world.region === 0 && !r.assets["forest-cave-walls-v2"],
    );
    g.restore();
  }
  // Amber branching fissures are a consistent attack cue in every biome.
  g.beginPath();
  g.moveTo(s.x + s.w * 0.58, s.y + 3);
  for (let i = 1; i <= 7; i++) {
    const x = s.x + s.w * (i % 2 ? 0.32 : 0.65),
      y = s.y + (s.h * i) / 7;
    g.lineTo(x, y);
    if (i === 2 || i === 5) {
      g.lineTo(s.x + (i === 2 ? s.w : 0), y + 12);
      g.moveTo(x, y);
    }
  }
  g.strokeStyle = "#e8b66d55";
  g.lineWidth = 7;
  g.stroke();
  g.strokeStyle = "#f5cc88";
  g.lineWidth = 1.8;
  g.stroke();
  g.restore();
}

export function createWallDebris(s, region, direction) {
  return wallFragments(s).map((piece, i) => ({
    ...piece,
    palette: terrainPalette(region),
    angle: 0,
    vx: direction * (55 + noise(i + s.id) * 110) + (noise(i + 60) - 0.5) * 90,
    vy: -65 - noise(i + 20) * 150,
    spin: (noise(i + 40) - 0.5) * 7,
    delay: (1 - (piece.y - s.y) / s.h) * 0.14,
    age: 0,
    life: 1.45 + noise(i + 10) * 0.45,
    floor: s.y + s.h,
    bounced: false,
  }));
}

export function stepWallDebris(pieces, dt) {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const a = pieces[i];
    a.age += dt;
    if (a.age >= a.life) {
      pieces.splice(i, 1);
      continue;
    }
    if (a.age < a.delay) continue;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.vy += 850 * dt;
    a.angle += a.spin * dt;
    if (a.y >= a.floor - 7 && a.vy > 0) {
      a.y = a.floor - 7;
      a.vy = a.bounced ? 0 : -a.vy * 0.24;
      a.vx *= 0.55;
      a.spin *= 0.45;
      a.bounced = true;
    }
  }
}

export function drawWallDebris(r, game) {
  const g = r.ctx;
  for (const a of game.wallDebris || []) {
    if (a.x < game.camera - 80 || a.x > game.camera + r.viewWidth + 80)
      continue;
    g.save();
    g.globalAlpha = Math.min(1, (a.life - a.age) / 0.55);
    g.translate(a.x, a.y);
    g.rotate(a.angle);
    stone(
      g,
      a,
      a.palette,
      game.world.region === 0
        ? caveStoneTexture(r) || r.assets["forest-terrain"]
        : caveStoneTexture(r) || r.assets[game.world.artKey + "-terrain"],
      game.world.region === 0 && !r.assets["forest-cave-walls-v2"],
    );
    g.restore();
  }
}
