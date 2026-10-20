import WALL_ART from "./wall-art.json" with { type: "json" };

// Subtract adjoining solid volumes from each face. A wall, floor and ceiling
// share a continuous boundary; decorative lips appear only against open space.
export function exposedTerrainEdges(s, platforms) {
  const subtract = (spans, lo, hi) =>
    spans.flatMap(([a, b]) => {
      if (hi <= a || lo >= b) return [[a, b]];
      return [...(lo > a ? [[a, lo]] : []), ...(hi < b ? [[hi, b]] : [])];
    });
  const edges = {
    top: [[0, s.w]],
    bottom: [[0, s.w]],
    left: [[0, s.h]],
    right: [[0, s.h]],
  };
  for (const n of platforms) {
    if (n === s || !n.solid || n.absent || n.broken) continue;
    if (
      n.x > s.x + s.w ||
      n.x + n.w < s.x ||
      n.y > s.y + s.h ||
      n.y + n.h < s.y
    )
      continue;
    if (n.y < s.y && n.y + n.h >= s.y)
      edges.top = subtract(edges.top, n.x - s.x, n.x + n.w - s.x);
    if (n.y <= s.y + s.h && n.y + n.h > s.y + s.h)
      edges.bottom = subtract(edges.bottom, n.x - s.x, n.x + n.w - s.x);
    if (n.x < s.x && n.x + n.w >= s.x)
      edges.left = subtract(edges.left, n.y - s.y, n.y + n.h - s.y);
    if (n.x <= s.x + s.w && n.x + n.w > s.x + s.w)
      edges.right = subtract(edges.right, n.y - s.y, n.y + n.h - s.y);
  }
  return edges;
}

// Cache by solid membership, so removing a breakable wall exposes its neighbors.
const boundaries = new WeakMap();
export function terrainEdges(world, s) {
  const solids = world.platforms.filter(
    (p) => p.solid && !p.absent && !p.broken,
  );
  const signature = solids.map((p) => p.id).join(",");
  let cached = boundaries.get(world);
  if (!cached || cached.signature !== signature) {
    cached = {
      signature,
      edges: new Map(solids.map((p) => [p, exposedTerrainEdges(p, solids)])),
    };
    boundaries.set(world, cached);
  }
  return cached.edges.get(s) || exposedTerrainEdges(s, solids);
}

// The atlas supplies vertical geology only. Top/bottom ornaments are excluded:
// surfaces can be thin climbing faces, broad cliffs or joined chamber boundaries.
export function drawVerticalMaterial(r, s, game, edges, face = false) {
  const image = r.assets["vertical-walls-painted"];
  if (!image) return false;
  const g = r.ctx,
    frame = WALL_ART[game.world.region];
  const [sx, sy, sw] = frame.rect;
  const sourceY = sy + frame.bodyTop;
  const sourceH = s.wall
    ? frame.bodyBottom - frame.bodyTop
    : Math.min(frame.bodyBottom - frame.bodyTop, s.h * 2.5);
  const draw = () =>
    g.drawImage(image, sx, sourceY, sw, sourceH, s.x - 4, s.y, s.w + 8, s.h);
  if (face) {
    g.save();
    g.beginPath();
    g.rect(s.x, s.y, s.w, s.h);
    g.clip();
    draw();
    g.restore();
  }
  for (const side of ["left", "right"]) {
    const x = side === "left" ? s.x : s.x + s.w;
    g.save();
    g.beginPath();
    for (const [a, b] of edges[side]) g.rect(x - 5, s.y + a, 10, b - a);
    g.clip();
    // Sample the corresponding upright margin. Never rotate horizontal ledges.
    const sourceX = side === "left" ? sx : sx + sw - sw * 0.2;
    g.drawImage(
      image,
      sourceX,
      sourceY,
      sw * 0.2,
      sourceH,
      x - 5,
      s.y,
      10,
      s.h,
    );
    g.restore();
  }
  return true;
}
