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

// Split only where the thickness of the actual solid changes. Each opposing
// skin owns at most 38% of that thickness, leaving a continuous dark core.
export function caveSkins(surfaces, maximumDepth = 36) {
  const opposite = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  return surfaces.flatMap((surface) => {
    const direction =
      surface.side === "top" || surface.side === "left" ? 1 : -1;
    const across = surfaces.filter(
      (s) =>
        s.side === opposite[surface.side] &&
        (s.axis - surface.axis) * direction > 0 &&
        (s.axis - surface.axis) * direction < maximumDepth / 0.38 &&
        s.a < surface.b &&
        s.b > surface.a,
    );
    const cuts = [
      ...new Set([
        surface.a,
        surface.b,
        ...across.flatMap((s) => [
          Math.max(surface.a, s.a),
          Math.min(surface.b, s.b),
        ]),
      ]),
    ].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((a, i) => {
      const b = cuts[i + 1],
        middle = (a + b) / 2;
      const thickness = Math.min(
        Infinity,
        ...across
          .filter((s) => s.a <= middle && s.b >= middle)
          .map((s) => (s.axis - surface.axis) * direction),
      );
      return {
        ...surface,
        a,
        b,
        depth: Math.min(maximumDepth, thickness * 0.38),
      };
    });
  });
}

export function skinOpacity(distance, depth) {
  if (distance >= depth) return 0;
  const t = Math.max(0, distance / depth);
  return (1 - t * t * (3 - 2 * t)) ** 2;
}

export function caveGrowth(surfaces) {
  const chosen = [];
  for (const ceiling of [false, true]) {
    const candidates = surfaces
      .filter(
        (s) =>
          (ceiling ? s.side === "bottom" : !s.horizontal) && s.b - s.a >= 110,
      )
      .flatMap((s) => {
        const count = Math.max(1, Math.floor((s.b - s.a) / 240));
        return Array.from({ length: count }, (_, i) => {
          const a = s.a + ((s.b - s.a) * i) / count;
          const b = s.a + ((s.b - s.a) * (i + 1)) / count;
          const seed = artHash("growth", s.side, s.axis, a, b);
          const along = a + 36 + ((b - a - 72) * ((seed >>> 8) % 1000)) / 1000;
          return {
            side: s.side,
            ceiling,
            seed,
            x: ceiling ? along : s.axis,
            y: ceiling ? s.axis : along,
            frame: (ceiling ? 4 : 0) + (seed % 4),
            height: ceiling ? 28 + (seed % 9) : 20 + (seed % 7),
          };
        });
      });
    candidates.sort((a, b) => a.seed - b.seed || a.x - b.x || a.y - b.y);
    chosen.push(...candidates.slice(0, Math.round(candidates.length * 0.1)));
  }
  return chosen;
}

export function caveCorners(surfaces) {
  const vertical = surfaces.filter((s) => !s.horizontal);
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
        // Prefer the main wall across the tiny bands of a rounded turn. If
        // there is no long wall, a short step still needs its own join art.
        const short = v.b - v.a < 40;
        if (
          !closest ||
          (closest.short && !short) ||
          (closest.short === short && distance < closest.distance)
        )
          closest = {
            x: v.axis,
            y: h.axis,
            inner: !outer,
            distance,
            short,
            scale: Math.min(
              0.32,
              Math.max(0.12, (v.b - v.a + dy) / 340),
              Math.max(0.12, (h.b - h.a + dx) / 400),
            ),
          };
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

// Larger composed gardens occupy occasional stable landmarks. Mirror only
// horizontally so mushrooms and hanging leaves always retain their gravity.
export function caveOverlays(surfaces) {
  const corners = caveCorners(surfaces)
    .filter((c) => c.scale >= 0.28)
    .map((c) => {
      const floor = c.kind.includes("floor"),
        left = c.kind.endsWith("left");
      const frame = floor ? (c.inner ? 3 : 0) : c.inner ? 4 : 2;
      return {
        x: c.x,
        y: c.y,
        frame,
        flip: floor && c.inner ? (left ? 1 : -1) : left ? -1 : 1,
        height: floor ? 150 : 120,
        seed: artHash("overlay", c.x, c.y),
      };
    });
  const featured = corners.filter((p) => {
    const family = corners
      .filter((q) => q.frame === p.frame)
      .sort((a, b) =>
        p.frame === 0 ? a.x - b.x || a.y - b.y : a.seed - b.seed,
      );
    return family.indexOf(p) < Math.max(1, Math.round(family.length * 0.2));
  });
  const walls = caveGrowth(surfaces).map((p, i) => ({
    ...p,
    frame: p.ceiling ? 2 : i % 2 ? 1 : 5,
    flip: p.side === "left" ? -1 : 1,
    height: p.ceiling ? 100 : 150,
  }));
  const chosen = [];
  for (const p of [...featured, ...walls].sort(
    (a, b) => a.seed - b.seed || a.x - b.x || a.y - b.y,
  )) {
    if (chosen.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 240))
      chosen.push(p);
  }
  return chosen;
}
