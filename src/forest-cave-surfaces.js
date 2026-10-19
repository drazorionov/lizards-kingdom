import atlas from "./forest-cave-art.json" with { type: "json" };

import { caveSurfaces, caveCorners } from "./cave-decoration.js";
import { surfaceFade } from "./surface-fade.js";

const layouts = new WeakMap();
function layout(faces) {
  if (!layouts.has(faces)) {
    const surfaces = caveSurfaces(faces);
    layouts.set(faces, {
      surfaces,
      corners: caveCorners(surfaces),
    });
  }
  return layouts.get(faces);
}
const prepared = new WeakMap();
const surfaceMasks = new WeakMap();
const views = new WeakMap();
const connectionViews = new WeakMap();
const connectionMasks = new WeakMap();

function connectionMask(world, solid) {
  let cached = connectionMasks.get(world);
  if (cached?.solid === solid) return cached.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(world.width / 2);
  canvas.height = Math.ceil(world.height / 2);
  const g = canvas.getContext("2d");
  g.fillStyle = "#000";
  // A small soft allowance preserves the painted moss/stone silhouette at
  // the collision plane, without extending solid-looking art into tunnels.
  g.shadowColor = "#000";
  g.shadowBlur = 8;
  for (const s of solid)
    if (!s.breakable) g.fillRect(s.x / 2, s.y / 2, s.w / 2, s.h / 2);
  connectionMasks.set(world, { solid, canvas });
  return canvas;
}

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
  // Feather the strip into the wall material instead of cutting its ends
  // with a hard rectangle. Cache each static span and retain world texture phase.
  const cache = prepared.get(image);
  const phase = x - Math.floor(x / tileWidth) * tileWidth;
  const key = `edge:${seed % 2}:${width}:${phase}`;
  let patch = cache.get(key);
  if (!patch) {
    patch = document.createElement("canvas");
    patch.width = Math.ceil(width);
    patch.height = Math.ceil(height);
    const ctx = patch.getContext("2d");
    for (let tx = -phase; tx < width; tx += tileWidth)
      ctx.drawImage(
        im,
        45,
        0,
        im.width - 90,
        im.height,
        tx,
        0,
        tileWidth + 0.5,
        height,
      );
    const fade = ctx.createLinearGradient(0, 0, width, 0);
    const rim = Math.min(32, width * 0.45) / width;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        alpha = t * t * (3 - 2 * t);
      fade.addColorStop(t * rim, `rgba(0,0,0,${alpha})`);
      fade.addColorStop(1 - t * rim, `rgba(0,0,0,${alpha})`);
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, patch.height);
    cache.set(key, patch);
  }
  g.drawImage(patch, x, y - frame.surface * scale);
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
    Math.max(w, h) * 0.95,
  );
  fade.addColorStop(0, "#000");
  fade.addColorStop(0.55, "#000");
  fade.addColorStop(0.8, "#0009");
  fade.addColorStop(1, "#0000");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, w, h);
  for (const horizontal of [true, false]) {
    const extent = horizontal ? w : h;
    const edge = g.createLinearGradient(
      0,
      0,
      horizontal ? extent : 0,
      horizontal ? 0 : extent,
    );
    edge.addColorStop(0, "#0000");
    edge.addColorStop(0.12, "#000");
    edge.addColorStop(0.88, "#000");
    edge.addColorStop(1, "#0000");
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
  }
  cache.set(frame, canvas);
  return canvas;
}

export function drawCaveConnections(r, game, faces, solid) {
  let view = connectionViews.get(r);
  if (!view) connectionViews.set(r, (view = document.createElement("canvas")));
  const width = Math.ceil(r.viewWidth);
  if (view.width !== width || view.height !== 620) {
    view.width = width;
    view.height = 620;
  }
  const g = view.getContext("2d");
  g.clearRect(0, 0, view.width, view.height);
  g.save();
  g.translate(-game.camera, -game.cameraY);
  for (const corner of layout(faces).corners) {
    if (
      corner.x < game.camera - 256 ||
      corner.x > game.camera + r.viewWidth + 256 ||
      corner.y < game.cameraY - 256 ||
      corner.y > game.cameraY + 876
    )
      continue;
    const image = r.assets["forest-cave-" + corner.kind],
      frame = atlas[corner.kind]?.[corner.frame];
    if (!image || !frame) continue;
    const patch = cornerPatch(image, frame),
      scale = corner.scale;
    g.drawImage(
      patch,
      corner.x - frame.anchor[0] * scale,
      corner.y - frame.anchor[1] * scale,
      patch.width * scale,
      patch.height * scale,
    );
  }
  g.restore();
  g.globalCompositeOperation = "destination-in";
  g.drawImage(
    connectionMask(game.world, solid),
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
