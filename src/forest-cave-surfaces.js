import atlas from "./forest-cave-art.json" with { type: "json" };

import {
  caveSurfaces,
  caveCorners,
  caveAttachments,
} from "./cave-decoration.js";
import { surfaceFade } from "./surface-fade.js";

const layouts = new WeakMap();
function layout(faces) {
  if (!layouts.has(faces)) {
    const surfaces = caveSurfaces(faces);
    layouts.set(faces, {
      surfaces,
      corners: caveCorners(surfaces),
      attachments: caveAttachments(surfaces),
    });
  }
  return layouts.get(faces);
}
const prepared = new WeakMap();
const surfaceMasks = new WeakMap();
const views = new WeakMap();

function surfaceMask(world, faces) {
  let cached = surfaceMasks.get(world);
  if (cached?.faces === faces) return cached.canvas;
  const canvas = document.createElement("canvas");
  const fade = surfaceFade(world.width, world.height, layout(faces).surfaces);
  canvas.width = fade.width;
  canvas.height = fade.height;
  canvas
    .getContext("2d")
    .putImageData(new ImageData(fade.pixels, fade.width, fade.height), 0, 0);
  surfaceMasks.set(world, { faces, canvas });
  return canvas;
}
function strip(image, frame, ceiling = false) {
  let cache = prepared.get(image);
  if (!cache) prepared.set(image, (cache = new Map()));
  if (cache.has(frame)) return cache.get(frame);
  const [x, y, w, h] = frame.rect;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.drawImage(image, x, y, w, h, 0, 0, w, h);
  // Bury the cut edge into the continuous rock body. Preserve the generated
  // moss / root silhouette on the playable side of the boundary.
  const fade = g.createLinearGradient(0, 0, 0, h);
  for (let i = 0; i <= 24; i++) {
    const position = i / 24;
    const t = Math.max(
      0,
      Math.min(1, ceiling ? position / 0.4 : (position - 0.08) / 0.9),
    );
    const smooth = t * t * (3 - 2 * t);
    fade.addColorStop(
      position,
      `rgba(0,0,0,${ceiling ? smooth : (1 - smooth) ** 2})`,
    );
  }
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  cache.set(frame, canvas);
  return canvas;
}

export function drawCaveBody(r, game, faces) {
  const g = r.ctx,
    image = r.assets["forest-cave-walls"];
  g.fillStyle = "#02050c";
  g.fillRect(game.camera, game.cameraY, r.viewWidth, 620);
  if (!image) return;
  let cache = prepared.get(image);
  if (!cache) prepared.set(image, (cache = new Map()));
  if (!cache.has("body")) {
    const tile = document.createElement("canvas");
    tile.width = 520;
    tile.height = 760;
    const ctx = tile.getContext("2d");
    const [sx, sy, sw, sh] = atlas.walls[0].rect;
    ctx.drawImage(
      image,
      sx + sw * 0.15,
      sy + sh * 0.08,
      sw * 0.7,
      sh * 0.84,
      0,
      0,
      tile.width,
      tile.height,
    );
    ctx.globalCompositeOperation = "destination-in";
    for (const horizontal of [true, false]) {
      const extent = horizontal ? tile.width : tile.height;
      const fade = ctx.createLinearGradient(
        0,
        0,
        horizontal ? extent : 0,
        horizontal ? 0 : extent,
      );
      fade.addColorStop(0, "#0000");
      fade.addColorStop(0.15, "#000");
      fade.addColorStop(0.85, "#000");
      fade.addColorStop(1, "#0000");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, tile.width, tile.height);
    }
    cache.set("body", tile);
  }
  let view = views.get(r);
  if (!view) views.set(r, (view = document.createElement("canvas")));
  const width = Math.ceil(r.viewWidth);
  if (view.width !== width || view.height !== 620) {
    view.width = width;
    view.height = 620;
  }
  const surface = view.getContext("2d");
  surface.clearRect(0, 0, view.width, view.height);
  surface.save();
  surface.translate(-game.camera, -game.cameraY);
  // Overlapping feathered panels preserve upright, asymmetric root growth.
  // World anchoring keeps the material stationary while the camera moves.
  for (
    let y = Math.floor(game.cameraY / 646) * 646 - 646;
    y < game.cameraY + 620;
    y += 646
  )
    for (
      let x = Math.floor(game.camera / 442) * 442 - 442;
      x < game.camera + r.viewWidth;
      x += 442
    )
      surface.drawImage(cache.get("body"), x, y);
  surface.restore();
  surface.globalCompositeOperation = "destination-in";
  surface.drawImage(
    surfaceMask(game.world, faces),
    game.camera / 2,
    game.cameraY / 2,
    r.viewWidth / 2,
    310,
    0,
    0,
    r.viewWidth,
    620,
  );
  surface.globalCompositeOperation = "source-over";
  g.drawImage(view, game.camera, game.cameraY);
}

export function drawCaveEdge(r, x, y, width, ceiling, seed = 0) {
  const kind = ceiling ? "ceilings" : "floors",
    image = r.assets["forest-cave-" + kind];
  if (!image) return false;
  const g = r.ctx,
    frame = atlas[kind][Math.abs(seed) % 2];
  const im = strip(image, frame, ceiling),
    scale = ceiling ? 0.3 : 0.36;
  const tileWidth = (im.width - 90) * scale,
    height = im.height * scale;
  g.save();
  g.beginPath();
  g.rect(x, y - 110, width, 260);
  g.clip();
  const start = Math.floor(x / tileWidth) * tileWidth;
  for (let tx = start; tx < x + width; tx += tileWidth) {
    g.drawImage(
      im,
      45,
      0,
      im.width - 90,
      im.height,
      tx,
      y - frame.surface * scale,
      tileWidth + 0.5,
      height,
    );
  }
  g.restore();
  return true;
}

export function drawCaveWalls(r, s, edges) {
  const g = r.ctx;
  // The material already follows the connected boundary. Add a narrow cool
  // rim without re-stamping a separate panel over the continuous surface.
  for (const side of ["left", "right"])
    for (const [a, b] of edges[side]) {
      const x = side === "left" ? s.x : s.x + s.w;
      const depth = Math.min(42, s.w);
      const shade = g.createLinearGradient(
        x,
        0,
        x + (side === "left" ? depth : -depth),
        0,
      );
      shade.addColorStop(0, "#3ce9dc28");
      shade.addColorStop(0.2, "#16284720");
      shade.addColorStop(1, "#03101200");
      g.fillStyle = shade;
      g.fillRect(side === "left" ? x : x - depth, s.y + a, depth, b - a);
    }
}

function cornerPatch(image, frame) {
  let cache = prepared.get(image);
  if (!cache) prepared.set(image, (cache = new Map()));
  if (cache.has(frame)) return cache.get(frame);
  const [x, y, w, h] = frame.rect;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d"),
    [ax, ay] = frame.anchor;
  g.drawImage(image, x, y, w, h, 0, 0, w, h);
  const fade = g.createRadialGradient(
    ax,
    ay,
    10,
    ax,
    ay,
    Math.min(w, h) * 0.55,
  );
  fade.addColorStop(0, "#000");
  fade.addColorStop(0.35, "#000e");
  fade.addColorStop(0.7, "#0005");
  fade.addColorStop(1, "#0000");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  cache.set(frame, canvas);
  return canvas;
}

export function drawCaveConnections(r, game, faces, solid) {
  const g = r.ctx;
  g.save();
  // Join art cannot cover open air and imply a different collision boundary.
  g.beginPath();
  for (const s of solid) if (!s.breakable) g.rect(s.x, s.y, s.w, s.h);
  g.clip();
  g.globalAlpha *= 0.78;
  for (const corner of layout(faces).corners) {
    if (
      corner.x < game.camera - 120 ||
      corner.x > game.camera + r.viewWidth + 120 ||
      corner.y < game.cameraY - 120 ||
      corner.y > game.cameraY + 740
    )
      continue;
    const image = r.assets["forest-cave-" + corner.kind],
      frame = atlas[corner.kind]?.[corner.frame];
    if (!image || !frame) continue;
    const patch = cornerPatch(image, frame),
      scale = 0.56;
    g.drawImage(
      patch,
      corner.x - frame.anchor[0] * scale,
      corner.y - frame.anchor[1] * scale,
      patch.width * scale,
      patch.height * scale,
    );
  }
  g.restore();
}

export function drawCaveAttachments(r, game, faces) {
  const g = r.ctx;
  for (const prop of layout(faces).attachments) {
    if (
      prop.x < game.camera - 100 ||
      prop.x > game.camera + r.viewWidth + 100 ||
      prop.y < game.cameraY - 100 ||
      prop.y > game.cameraY + 720
    )
      continue;
    const floor = prop.kind === "floor";
    if (
      floor &&
      DETAILS.some(
        ([x, y]) => Math.abs(x - prop.x) < 120 && Math.abs(y - prop.y) < 20,
      )
    )
      continue;
    const kind = floor ? "details" : "attachments",
      image = r.assets["forest-cave-" + kind];
    const frame = atlas[kind]?.[prop.frame];
    if (!image || !frame) continue;
    const [sx, sy, sw, sh] = frame.rect,
      height = prop.size,
      width = (height * sw) / sh;
    // Keep ornaments out of the opposite wall in narrow climbing shafts.
    const out = prop.side === "left" ? -1 : 1;
    const bounds = floor
      ? { x: prop.x - width / 2, y: prop.y - height, w: width, h: height - 8 }
      : prop.kind === "ceiling"
        ? { x: prop.x - width / 2, y: prop.y + 8, w: width, h: height - 8 }
        : {
            x: prop.x + (out < 0 ? -width : 8),
            y: prop.y - height / 2,
            w: Math.max(1, width - 8),
            h: height,
          };
    if (
      game.world.platforms.some(
        (s) =>
          s.solid &&
          s.x < bounds.x + bounds.w &&
          s.x + s.w > bounds.x &&
          s.y < bounds.y + bounds.h &&
          s.y + s.h > bounds.y,
      )
    )
      continue;
    g.save();
    g.translate(prop.x, prop.y);
    if (!floor) g.globalAlpha *= 0.5;
    if (prop.kind === "wall") g.scale(out, 1);
    g.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      floor || prop.kind === "ceiling" ? -width / 2 : -5,
      floor ? -height + 4 : prop.kind === "ceiling" ? -5 : -height / 2,
      width,
      height,
    );
    g.restore();
  }
}

// Authored landmarks rest on the same solid surfaces used by the player.
// Their silhouettes are decoration behind actors, never invisible obstacles.
const DETAILS = [
  [210, 500, 0, 80],
  [600, 500, 2, 98],
  [1280, 420, 3, 66],
  [1650, 1050, 5, 64],
  [2110, 1450, 6, 64],
  [2300, 1050, 7, 90],
  [2680, 380, 1, 115],
  [3250, 500, 4, 86],
  [3720, 500, 0, 108],
];
export function drawCaveLandmarks(r, game) {
  const image = r.assets["forest-cave-details"];
  if (!image) return;
  for (const [x, y, id, height] of DETAILS) {
    if (
      x < game.camera - 180 ||
      x > game.camera + r.viewWidth + 180 ||
      y < game.cameraY ||
      y - height > game.cameraY + 620
    )
      continue;
    const rect = atlas.details[id].rect,
      width = (rect[2] * height) / rect[3];
    r.ctx.drawImage(
      image,
      ...rect,
      x - width / 2,
      y - height + 5,
      width,
      height,
    );
  }
}

export function caveStoneTexture(r) {
  const image = r.assets["forest-cave-walls"];
  if (!image) return null;
  let cache = prepared.get(image);
  if (!cache) prepared.set(image, (cache = new Map()));
  if (!cache.has("stone")) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const [x, y, w, h] = atlas.walls[1].rect;
    canvas
      .getContext("2d")
      .drawImage(
        image,
        x + w * 0.2,
        y + h * 0.12,
        w * 0.6,
        h * 0.76,
        0,
        0,
        256,
        512,
      );
    cache.set("stone", canvas);
  }
  return cache.get("stone");
}
