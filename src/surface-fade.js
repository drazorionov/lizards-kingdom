// Distance to the exposed perimeter avoids rectangular gradient seams at joins.
// The two chamfer passes approximate Euclidean distance, including round caps.
export function surfaceFade(width, height, segments, depth = 144, scale = 2) {
  const w = Math.ceil(width / scale),
    h = Math.ceil(height / scale);
  const radius = depth / scale;
  const distance = new Float32Array(w * h).fill(radius);
  for (const s of segments) {
    const axis = Math.round(s.axis / scale);
    const lo = Math.max(0, Math.floor(s.a / scale));
    const hi = Math.min((s.horizontal ? w : h) - 1, Math.ceil(s.b / scale));
    if (axis < 0 || axis >= (s.horizontal ? h : w)) continue;
    for (let k = lo; k <= hi; k++)
      distance[s.horizontal ? axis * w + k : k * w + axis] = 0;
  }
  const diagonal = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = distance[i];
      if (x) d = Math.min(d, distance[i - 1] + 1);
      if (y) {
        d = Math.min(d, distance[i - w] + 1);
        if (x) d = Math.min(d, distance[i - w - 1] + diagonal);
        if (x < w - 1) d = Math.min(d, distance[i - w + 1] + diagonal);
      }
      distance[i] = d;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = distance[i];
      if (x < w - 1) d = Math.min(d, distance[i + 1] + 1);
      if (y < h - 1) {
        d = Math.min(d, distance[i + w] + 1);
        if (x) d = Math.min(d, distance[i + w - 1] + diagonal);
        if (x < w - 1) d = Math.min(d, distance[i + w + 1] + diagonal);
      }
      distance[i] = d;
    }
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < distance.length; i++) {
    const t = Math.min(1, distance[i] / radius),
      smooth = t * t * (3 - 2 * t);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 255;
    pixels[i * 4 + 3] = Math.round(255 * (1 - smooth) ** 2);
  }
  return { width: w, height: h, pixels };
}
