// Stable art choices belong to world coordinates, never to animation frames.
export function artHash(...values) {
  let hash = 2166136261;
  for (const char of values.join(":"))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function caveSurfaces(faces) {
  const groups = new Map();
  for (const { s, edges } of faces) {
    if (s.breakable) continue;
    for (const side of ["top", "bottom", "left", "right"])
      for (const [a, b] of edges[side]) {
        const horizontal = side === "top" || side === "bottom";
        const axis = horizontal
          ? s.y + (side === "bottom" ? s.h : 0)
          : s.x + (side === "right" ? s.w : 0);
        const origin = horizontal ? s.x : s.y;
        const key = `${side}:${axis}`;
        if (!groups.has(key)) groups.set(key, []);
        groups
          .get(key)
          .push({ side, axis, a: origin + a, b: origin + b, horizontal });
      }
  }
  const result = [];
  for (const pieces of groups.values()) {
    pieces.sort((a, b) => a.a - b.a);
    let previous;
    for (const p of pieces) {
      if (previous && p.a <= previous.b + 0.1)
        previous.b = Math.max(previous.b, p.b);
      else {
        previous = { ...p };
        result.push(previous);
      }
    }
  }
  return result;
}

export function caveCorners(surfaces) {
  const vertical = surfaces.filter((s) => !s.horizontal && s.b - s.a >= 40);
  const corners = [];
  for (const h of surfaces.filter((s) => s.horizontal && s.b - s.a >= 40)) {
    for (const start of [true, false]) {
      const end = start ? h.a : h.b;
      let closest;
      for (const v of vertical) {
        const outer = start ? v.side === "left" : v.side === "right";
        const down = (h.side === "top") === outer;
        const vy = down ? v.a : v.b;
        const dx = Math.abs(v.axis - end),
          dy = Math.abs(vy - h.axis);
        if (dx > 48 || dy > 48) continue;
        const distance = dx + dy;
        if (!closest || distance < closest.distance)
          closest = { x: v.axis, y: h.axis, inner: !outer, distance };
      }
      if (!closest) continue;
      const kind = `corners-${h.side === "top" ? "floor" : "ceiling"}-${start ? "left" : "right"}`;
      const variant = artHash(closest.x, closest.y, kind) % 8;
      corners.push({
        ...closest,
        kind,
        frame: variant + (closest.inner ? 8 : 0),
      });
    }
  }
  return corners;
}
