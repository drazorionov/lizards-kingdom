// Air is authored as connected route envelopes, then carved into vaulted rooms
// and gently winding shafts. Flat landing centers and passage endpoints retain
// their authored heights; the same sampled boundary drives collision and maps.
export function organicOpening(r) {
  const radius = Math.min(42, r.h * 0.12, r.w * 0.12);
  const arch = Math.min(85, r.h * 0.2, r.w * 0.16);
  const swell = Math.min(38, r.w * 0.12, r.h * 0.09);
  const phase = r.x * 0.013 + r.y * 0.019;
  const top = Math.max(8, Math.floor(r.y - arch));
  const bottom = r.y + r.h;
  const cuts = [top, r.y, r.y + radius, bottom - radius, bottom];
  // A common grid avoids multiplying slivers where several rooms overlap.
  for (let y = Math.ceil(top / 12) * 12; y < bottom; y += 12) cuts.push(y);
  cuts.sort((a, b) => a - b);
  const parts = [...new Set(cuts)]
    .slice(0, -1)
    .map((y, i, ys) => {
      const end = ys[i + 1] ?? bottom;
      const mid = (y + end) / 2;
      let left, right;
      if (mid < r.y) {
        const t = (r.y - mid) / arch;
        const half = r.w * 0.48 * Math.sqrt(Math.max(0, 1 - t * t));
        left = r.x + r.w / 2 - half;
        right = r.x + r.w / 2 + half;
      } else {
        const t = (mid - r.y) / r.h;
        const distance = Math.min(mid - r.y, bottom - mid);
        const inset =
          distance < radius
            ? radius - Math.sqrt(radius ** 2 - (radius - distance) ** 2)
            : 0;
        const bend = swell * Math.sin(Math.PI * t) ** 2;
        left =
          r.x + inset - bend * (1 + 0.35 * Math.sin(t * Math.PI * 2 + phase));
        right =
          r.x +
          r.w -
          inset +
          bend * (1 - 0.35 * Math.sin(t * Math.PI * 2 + phase));
      }
      const x = Math.round(left),
        x2 = Math.round(right);
      return {
        x,
        y: Math.round(y),
        w: x2 - x,
        h: Math.round(end) - Math.round(y),
      };
    })
    .filter((r) => r.w > 0 && r.h > 0);
  if (r.rolling) {
    // A shallow curved dip between the flat doorway landings.
    for (let d = 0; d < 18; d += 3) {
      const inset = Math.asin(Math.sqrt((d + 1.5) / 18)) / Math.PI;
      const width = r.w - 120;
      const x = Math.round(r.x + 60 + width * inset);
      const x2 = Math.round(r.x + r.w - 60 - width * inset);
      parts.push({ x, y: bottom + d, w: x2 - x, h: 3 });
    }
  }
  return parts;
}
export function carveCaverns(width, height, openings) {
  openings = openings.flatMap(organicOpening).map((r) => ({
    ...r,
    x: Math.max(8, r.x),
    w: Math.min(width - 8, r.x + r.w) - Math.max(8, r.x),
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

// Exposed mountain shelves retain flat landings but taper into bowed rock below.
export function sculptIsland(r) {
  const parts = [];
  for (let offset = 0; offset < r.h; offset += 12) {
    const h = Math.min(12, r.h - offset);
    const t = offset / r.h;
    const inset = Math.round(
      Math.min(r.w * 0.32, 48) * Math.sin((t * Math.PI) / 2) ** 2,
    );
    parts.push({
      ...r,
      x: r.x + inset,
      y: r.y + offset,
      w: r.w - inset * 2,
      h,
    });
  }
  return parts;
}
