import { caveSurfaces } from "./cave-decoration.js";

const cache = new WeakMap();
const key = (p) => `${p.x}:${p.y}`;
const distance = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
function simplify(points, tolerance = 7) {
  if (points.length <= 2) return points;
  let farthest = tolerance,
    index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i], points[0], points.at(-1));
    if (d > farthest) {
      farthest = d;
      index = i;
    }
  }
  return index < 0
    ? [points[0], points.at(-1)]
    : [
        ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(index), tolerance),
      ];
}
// Round the remaining turns without displacing a corner more than six pixels.
// Long landings stay straight; short raster steps blend into a continuous arc.
function soften(points, closed) {
  const source = closed ? points.slice(0, -1) : points;
  const result = [];
  for (let i = 0; i < source.length; i++) {
    const p = source[i],
      before = source[(i + source.length - 1) % source.length],
      after = source[(i + 1) % source.length];
    if (!closed && (i === 0 || i === source.length - 1)) {
      result.push(p);
      continue;
    }
    const incoming = Math.hypot(p.x - before.x, p.y - before.y),
      outgoing = Math.hypot(after.x - p.x, after.y - p.y);
    const radius = Math.min(24, incoming / 2, outgoing / 2);
    const a = {
      x: p.x + ((before.x - p.x) * radius) / incoming,
      y: p.y + ((before.y - p.y) * radius) / incoming,
    };
    const b = {
      x: p.x + ((after.x - p.x) * radius) / outgoing,
      y: p.y + ((after.y - p.y) * radius) / outgoing,
    };
    result.push(a);
    for (let j = 1; j <= 4; j++) {
      const t = j / 4,
        u = 1 - t;
      result.push({
        x: u * u * a.x + 2 * u * t * p.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * p.y + t * t * b.y,
      });
    }
  }
  if (closed) result.push(result[0]);
  return result;
}

// Follow the perimeter with solid earth to the right. Small collision bands
// become continuous tangents, bounded to seven pixels from the physical edge.
export function caveContours(faces) {
  if (cache.has(faces)) return cache.get(faces);
  const edges = caveSurfaces(faces).map((s) => {
    const a = s.horizontal ? { x: s.a, y: s.axis } : { x: s.axis, y: s.a };
    const b = s.horizontal ? { x: s.b, y: s.axis } : { x: s.axis, y: s.b };
    return s.side === "bottom" || s.side === "left" ? { a: b, b: a } : { a, b };
  });
  const starts = new Map();
  for (const e of edges) {
    const k = key(e.a);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(e);
  }
  const used = new Set(),
    result = [];
  for (const first of edges) {
    if (used.has(first)) continue;
    const points = [first.a];
    let e = first;
    while (e && !used.has(e)) {
      used.add(e);
      points.push(e.b);
      e = starts.get(key(e.b))?.find((n) => !used.has(n));
    }
    const closed = key(points[0]) === key(points.at(-1));
    const middle = Math.floor(points.length / 2);
    const clean = closed
      ? [
          ...simplify(points.slice(0, middle + 1)).slice(0, -1),
          ...simplify(points.slice(middle)),
        ]
      : simplify(points);
    result.push({ points: soften(clean, closed), closed });
  }
  cache.set(faces, result);
  return result;
}

function rayThickness(x, y, nx, ny, solids) {
  const intervals = [];
  for (const s of solids) {
    let lo = -Infinity,
      hi = Infinity;
    for (const [p, n, a, b] of [
      [x, nx, s.x, s.x + s.w],
      [y, ny, s.y, s.y + s.h],
    ]) {
      if (Math.abs(n) < 1e-6) {
        if (p < a || p > b) {
          hi = -Infinity;
          break;
        }
      } else {
        const t1 = (a - p) / n,
          t2 = (b - p) / n;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (hi >= lo && hi > 0 && lo < 100) intervals.push([lo, hi]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let end = 0;
  for (const [a, b] of intervals) {
    if (a > end + 6) break;
    end = Math.max(end, b);
    if (end >= 100) return 100;
  }
  return end || 12;
}

export function contourSkins(faces) {
  const solids = faces.map((f) => f.s).filter((s) => !s.breakable);
  const skins = [];
  for (const { points } of caveContours(faces))
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 0.5) continue;
      const nx = -(b.y - a.y) / length,
        ny = (b.x - a.x) / length;
      const horizontal = Math.abs(ny) >= Math.abs(nx);
      const side = horizontal
        ? ny > 0
          ? "top"
          : "bottom"
        : nx > 0
          ? "left"
          : "right";
      const reverse = horizontal ? b.x < a.x : b.y < a.y;
      const start = reverse ? b : a,
        end = reverse ? a : b;
      const tx = (end.x - start.x) / length,
        ty = (end.y - start.y) / length;
      const count = Math.ceil(length / 48);
      for (let j = 0; j < count; j++) {
        const offset = (length * j) / count,
          len = length / count;
        const x = start.x + tx * offset,
          y = start.y + ty * offset;
        const depth = Math.min(
          36,
          rayThickness(x + (tx * len) / 2, y + (ty * len) / 2, nx, ny, solids) *
            0.38,
        );
        skins.push({
          side,
          horizontal,
          axis: horizontal ? y : x,
          a: 0,
          b: len,
          x,
          y,
          tx,
          ty,
          nx,
          ny,
          depth,
          curved: true,
          phase: horizontal ? x : y,
        });
      }
    }
  return skins;
}
