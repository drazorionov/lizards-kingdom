// Author empty rooms/passages first. The complement is continuous solid earth.
// Rectangular strips retain exact collision planes while permitting winding,
// stepped room silhouettes. The renderer and map consume this same geometry.
export function carveCaverns(width, height, openings) {
  openings = openings
    .flatMap((r) => {
      const radius = Math.min(42, r.h * 0.12, r.w * 0.12);
      const steps = 3,
        band = radius / steps;
      const parts = [{ x: r.x, y: r.y + radius, w: r.w, h: r.h - radius * 2 }];
      for (let i = 0; i < steps; i++) {
        const inset =
          radius - Math.sqrt(radius ** 2 - (radius - (i + 0.5) * band) ** 2);
        parts.push({
          x: r.x + inset,
          y: r.y + i * band,
          w: r.w - inset * 2,
          h: band,
        });
        parts.push({
          x: r.x + inset,
          y: r.y + r.h - (i + 1) * band,
          w: r.w - inset * 2,
          h: band,
        });
      }
      return parts;
    })
    .map((r) => ({
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.x + r.w) - Math.round(r.x),
      h: Math.round(r.y + r.h) - Math.round(r.y),
    }));
  const ys = [
    ...new Set([0, height, ...openings.flatMap((r) => [r.y, r.y + r.h])]),
  ].sort((a, b) => a - b);
  const solids = [],
    active = new Map();
  for (let i = 0; i < ys.length - 1; i++) {
    const y = ys[i],
      h = ys[i + 1] - y;
    const air = openings
      .filter((r) => r.y <= y && r.y + r.h >= y + h)
      .map((r) => [Math.max(0, r.x), Math.min(width, r.x + r.w)])
      .sort((a, b) => a[0] - b[0]);
    const spans = [];
    let x = 0;
    for (const [a, b] of air) {
      if (a > x) spans.push([x, a]);
      x = Math.max(x, b);
    }
    if (x < width) spans.push([x, width]);
    const next = new Map();
    for (const [a, b] of spans) {
      const key = `${a}:${b}`,
        above = active.get(key);
      if (above && above.y + above.h === y) {
        above.h += h;
        next.set(key, above);
      } else {
        const rock = {
          x: a,
          y,
          w: b - a,
          h,
          solid: true,
          ground: false,
          wall: true,
          terrain: true,
        };
        solids.push(rock);
        next.set(key, rock);
      }
    }
    active.clear();
    for (const [key, value] of next) active.set(key, value);
  }
  return solids;
}
