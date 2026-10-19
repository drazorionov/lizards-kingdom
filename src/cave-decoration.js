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

export function caveAttachments(surfaces) {
  const selected = [];
  for (const kind of ["wall", "ceiling", "floor"]) {
    const eligible = surfaces
      .filter(
        (s) =>
          s.b - s.a >= (kind === "wall" ? 90 : 170) &&
          (kind === "wall"
            ? !s.horizontal
            : s.side === (kind === "floor" ? "top" : "bottom")),
      )
      .flatMap((s) => {
        const count = Math.max(
          1,
          Math.floor((s.b - s.a) / (kind === "wall" ? 150 : 240)),
        );
        const length = (s.b - s.a) / count;
        return Array.from({ length: count }, (_, i) => ({
          ...s,
          a: s.a + i * length,
          b: s.a + (i + 1) * length,
        }));
      });
    eligible.sort(
      (a, b) =>
        artHash(a.side, a.axis, a.a, a.b) - artHash(b.side, b.axis, b.a, b.b),
    );
    for (const s of eligible.slice(0, Math.round(eligible.length * 0.1))) {
      const seed = artHash(s.side, s.axis, s.a, s.b);
      const along = s.a + (s.b - s.a) * (0.3 + (seed % 400) / 1000);
      selected.push({
        kind,
        side: s.side,
        x: s.horizontal ? along : s.axis,
        y: s.horizontal ? s.axis : along,
        frame: (seed % 8) + (kind === "ceiling" ? 8 : 0),
        size: kind === "floor" ? 48 + (seed % 30) : 22 + (seed % 12),
      });
    }
  }
  return selected;
}
