import atlas from "./forest-cave-art.json" with { type: "json" };
import {
  artHash,
  caveSurfaces,
  caveCorners,
  caveSkins,
  skinOpacity,
} from "./cave-decoration.js";

const layouts = new WeakMap();
const prepared = new WeakMap();
const masks = new WeakMap();
const views = new WeakMap();

function layout(faces) {
  if (!layouts.has(faces)) {
    const surfaces = caveSurfaces(faces);
    layouts.set(faces, {
      skins: caveSkins(surfaces),
      corners: caveCorners(surfaces),
    });
  }
  return layouts.get(faces);
}
function cacheFor(image) {
  if (!prepared.has(image)) prepared.set(image, new Map());
  return prepared.get(image);
}
function viewFor(r) {
  if (!views.has(r)) views.set(r, document.createElement("canvas"));
  const view = views.get(r);
  const width = Math.ceil(r.viewWidth);
  if (view.width !== width || view.height !== 620) {
    view.width = width;
    view.height = 620;
  }
  return view;
}

// Canonical coordinates: x follows the surface, y points into solid earth.
// The inverse transform used to prepare sprites preserves root gravity.
function orient(g, s) {
  if (s.side === "top") g.transform(1, 0, 0, 1, s.a, s.axis);
  if (s.side === "bottom") g.transform(1, 0, 0, -1, s.a, s.axis);
  if (s.side === "left") g.transform(0, 1, 1, 0, s.axis, s.a);
  if (s.side === "right") g.transform(0, 1, -1, 0, s.axis, s.a);
}
function skinMask(world, faces) {
  let cached = masks.get(world);
  if (cached?.faces === faces) return cached.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(world.width / 2);
  canvas.height = Math.ceil(world.height / 2);
  const g = canvas.getContext("2d");
  g.scale(0.5, 0.5);
  for (const s of layout(faces).skins) {
    g.save();
    orient(g, s);
    const fade = g.createLinearGradient(0, -5, 0, s.depth);
    fade.addColorStop(0, "#0000");
    fade.addColorStop(5 / (s.depth + 5), "#000");
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      fade.addColorStop(
        (5 + s.depth * t) / (s.depth + 5),
        `rgba(0,0,0,${skinOpacity(s.depth * t, s.depth)})`,
      );
    }
    g.fillStyle = fade;
    g.fillRect(0, -5, s.b - s.a, s.depth + 5);
    g.restore();
  }
  masks.set(world, { faces, canvas });
  return canvas;
}

function strip(image, frame, side) {
  const cache = cacheFor(image);
  if (cache.has(frame)) return cache.get(frame);
  const [sx, sy, sw, sh] = frame.rect;
  const horizontal = side === "top" || side === "bottom";
  const canvas = document.createElement("canvas");
  canvas.width = horizontal ? sw : sh;
  canvas.height = horizontal ? sh : sw;
  const g = canvas.getContext("2d");
  if (side === "bottom") g.transform(1, 0, 0, -1, 0, sh);
  if (side === "left") g.transform(0, 1, 1, 0, 0, 0);
  if (side === "right") g.transform(0, -1, 1, 0, 0, sw);
  g.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  cache.set(frame, canvas);
  return canvas;
}
function drawSkin(g, assets, s) {
  const horizontal = s.horizontal;
  const image =
    assets[horizontal ? "forest-cave-edges-v2" : "forest-cave-walls-v2"];
  if (!image) return;
  const frames = atlas[horizontal ? "edges-v2" : "walls-v2"];
  const variant = artHash(s.side, s.axis) % 2;
  const frame =
    frames[variant + (s.side === "bottom" || s.side === "right" ? 2 : 0)];
  const im = strip(image, frame, s.side);
  const length = s.b - s.a;
  const tileLength = 300;
  // Match the exposed plane; compress only inward depth on thin earth masses.
  const crossScale = s.depth / Math.max(1, im.height - frame.surface);
  const y = -frame.surface * crossScale;
  g.save();
  orient(g, s);
  g.beginPath();
  g.rect(0, -5, length, s.depth + 5);
  g.clip();
  const inset = Math.min(35, im.width * 0.08);
  const phase = s.a - Math.floor(s.a / tileLength) * tileLength;
  for (let x = -phase; x < length; x += tileLength)
    g.drawImage(
      im,
      inset,
      0,
      im.width - inset * 2,
      im.height,
      x,
      y,
      tileLength + 0.5,
      im.height * crossScale,
    );
  g.restore();
}
function cornerPatch(image, frame) {
  const cache = cacheFor(image);
  if (cache.has(frame)) return cache.get(frame);
  const [x, y, w, h] = frame.rect;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.drawImage(image, x, y, w, h, 0, 0, w, h);
  // Keep the bend intact and feather only the short trim's arm ends.
  const [ax, ay] = frame.anchor;
  const fade = g.createRadialGradient(ax, ay, 0, ax, ay, Math.max(w, h) * 0.85);
  fade.addColorStop(0, "#000");
  fade.addColorStop(0.55, "#000");
  fade.addColorStop(1, "#0000");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  cache.set(frame, canvas);
  return canvas;
}
function drawConnections(g, assets, game, faces, width) {
  for (const corner of layout(faces).corners) {
    if (
      corner.x < game.camera - 100 ||
      corner.x > game.camera + width + 100 ||
      corner.y < game.cameraY - 100 ||
      corner.y > game.cameraY + 720
    )
      continue;
    const kind = corner.kind.includes("ceiling")
      ? "joins-ceiling-v2"
      : "joins-floor-v2";
    const image = assets["forest-cave-" + kind],
      frame = atlas[kind]?.[corner.frame];
    if (!image || !frame) continue;
    const patch = cornerPatch(image, frame);
    g.save();
    g.translate(corner.x, corner.y);
    g.scale(
      corner.kind.endsWith("right") ? -corner.scale : corner.scale,
      corner.scale,
    );
    g.drawImage(patch, -frame.anchor[0], -frame.anchor[1]);
    g.restore();
  }
}
function finishSkins(r, game, faces, view) {
  const g = view.getContext("2d");
  g.globalCompositeOperation = "destination-in";
  g.drawImage(
    skinMask(game.world, faces),
    game.camera / 2,
    game.cameraY / 2,
    r.viewWidth / 2,
    310,
    0,
    0,
    r.viewWidth,
    620,
  );
  g.globalCompositeOperation = "source-over";
  r.ctx.drawImage(view, game.camera, game.cameraY);
}
export function drawCaveTerrain(r, game, faces, solid) {
  // Pass 1: black, non-reachable earth, drawn as one collision union.
  const g = r.ctx;
  g.save();
  g.beginPath();
  for (const s of solid) if (!s.breakable) g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  g.fillStyle = "#02050c";
  g.fillRect(game.camera, game.cameraY, r.viewWidth, 620);
  g.restore();

  const view = viewFor(r),
    surface = view.getContext("2d");
  surface.clearRect(0, 0, view.width, view.height);
  surface.save();
  surface.translate(-game.camera, -game.cameraY);
  // Pass 2: independently oriented narrow floor, wall and ceiling skins.
  for (const s of layout(faces).skins) {
    const x = s.horizontal ? s.a : s.axis,
      y = s.horizontal ? s.axis : s.a;
    const w = s.horizontal ? s.b - s.a : 40,
      h = s.horizontal ? 40 : s.b - s.a;
    if (
      x + w < game.camera - 50 ||
      x > game.camera + r.viewWidth + 50 ||
      y + h < game.cameraY - 50 ||
      y > game.cameraY + 670
    )
      continue;
    drawSkin(surface, r.assets, s);
  }
  // Pass 3: compact deterministic joins, constrained by the same depth mask.
  drawConnections(surface, r.assets, game, faces, r.viewWidth);
  surface.restore();
  finishSkins(r, game, faces, view);
}
// Isolated pass used by visual regression checks.
export function drawCaveConnections(r, game, faces) {
  const view = viewFor(r),
    g = view.getContext("2d");
  g.clearRect(0, 0, view.width, view.height);
  g.save();
  g.translate(-game.camera, -game.cameraY);
  drawConnections(g, r.assets, game, faces, r.viewWidth);
  g.restore();
  finishSkins(r, game, faces, view);
}
export function caveStoneTexture(r) {
  const image = r.assets["forest-cave-walls-v2"];
  if (!image) return null;
  const cache = cacheFor(image);
  if (!cache.has("stone")) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const g = canvas.getContext("2d");
    g.fillStyle = "#02050c";
    g.fillRect(0, 0, 256, 512);
    const [x, y, w, h] = atlas["walls-v2"][1].rect;
    g.drawImage(image, x + w * 0.25, y, w * 0.5, h, 0, 0, 256, 512);
    cache.set("stone", canvas);
  }
  return cache.get("stone");
}
