import { HERO_RIG_PARTS } from "./hero-rig-data.js";

// Ten authored foot targets, smoothly interpolated. Derivatives are per cycle.
// Contact, compression, support, toe-off, flight, recovery, passing, extension.
// Shorten stride as cadence rises so planted feet still match world movement.
export const RUN_ANIMATION_RATE = 1.1;
export const WALK_STRIDE = 110 / RUN_ANIMATION_RATE;
export const WALK_KEYS = Object.freeze([
  [12, 0, -110, 0, -0.1],
  [1, 0, -110, 0, 0],
  [-10, 0, -110, 0, 0.05],
  [-21, 0, -110, 0, 0.5],
  [-31, 12, -40, 180, 0.95],
  [-28, 23, 90, 80, 1.0],
  [-14, 26, 170, 0, 0.65],
  [4, 18, 160, -100, 0.25],
  [18, 8, 90, -80, -0.12],
  [20, 2, -20, -35, -0.16],
]);
export const RUN_PHASES = [
  "Contact",
  "Load",
  "Support",
  "Toe-off",
  "Flight",
  "Recovery",
  "Fold",
  "Passing",
  "Extend",
  "Lower",
];
// Raise the pelvis with the longer bones: lengthening bones alone deepens the
// crouch. Resting ankles sit under the hips, with a small, unlocked knee bend.
export const HERO_LEGS = Object.freeze([
  Object.freeze({
    thigh: 22,
    shin: 24,
    ankleHeight: 5.5,
    footScale: 1.2,
    idleHip: -51,
    walkHip: -47.5,
  }),
  Object.freeze({
    thigh: 25,
    shin: 27,
    ankleHeight: 6.8,
    footScale: 1.2,
    idleHip: -58.1,
    walkHip: -53.5,
  }),
]);
const mix = (a, b, t) => a + (b - a) * t;
const wrap = (n, total) => ((n % total) + total) % total;
function hermite(a, b, da, db, t) {
  return (
    (2 * t * t * t - 3 * t * t + 1) * a +
    (t * t * t - 2 * t * t + t) * da +
    (-2 * t * t * t + 3 * t * t) * b +
    (t * t * t - t * t) * db
  );
}
export function sampleWalkFoot(phase) {
  const p = wrap(phase, 10),
    index = Math.floor(p),
    t = p - index;
  const a = WALK_KEYS[index],
    b = WALK_KEYS[(index + 1) % 10];
  return {
    x: hermite(a[0], b[0], a[2] / 10, b[2] / 10, t) / RUN_ANIMATION_RATE,
    lift: hermite(a[1], b[1], a[3] / 10, b[3] / 10, t),
    pitch: mix(a[4], b[4], t * t * (3 - 2 * t)),
  };
}
export function solveLeg(hip, ankle, thigh, shin) {
  const dx = ankle.x - hip.x,
    dy = ankle.y - hip.y,
    d = Math.max(0.001, Math.hypot(dx, dy));
  const along = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const across = Math.sqrt(Math.max(0, thigh * thigh - along * along));
  return {
    x: hip.x + (dx / d) * along + (dy / d) * across,
    y: hip.y + (dy / d) * along - (dx / d) * across,
  };
}
export function walkRigPose(hero, phase, blend = 1, elapsed = 0) {
  const proportions = HERO_LEGS[hero === 1 ? 1 : 0];
  // A restrained weight shift, repeated for each footfall; highest in flight.
  const heights = [0, 2, 1.5, 0.5, -0.5];
  const p = wrap(phase, 5),
    i = Math.floor(p),
    t = p - i;
  const bob = mix(heights[i], heights[(i + 1) % 5], t * t * (3 - 2 * t));
  const hipY =
    mix(
      proportions.idleHip + Math.sin(elapsed * 2) * 0.12,
      proportions.walkHip + bob,
      blend,
    ) -
    proportions.ankleHeight * (proportions.footScale - 1);
  const legs = [true, false].map((far) => {
    const foot = sampleWalkFoot(phase + (far ? 5 : 0));
    // Anchor the far leg beneath the back of the pelvis. Moving its whole chain
    // preserves the upright resting alignment and planted-foot stride.
    const hip = { x: far ? -3 : 8, y: hipY };
    const pitch = foot.pitch * blend;
    const sole = proportions.ankleHeight * proportions.footScale;
    const contactX = (pitch >= 0 ? 8 : -3) * proportions.footScale;
    const rotatedX = contactX * Math.cos(pitch) - sole * Math.sin(pitch);
    const rotatedY = contactX * Math.sin(pitch) + sole * Math.cos(pitch);
    const ankle = {
      x: hip.x + mix(far ? -1 : 1, foot.x, blend) + (contactX - rotatedX),
      y: -rotatedY - (far ? 0.6 : 0) - foot.lift * blend,
    };
    return {
      far,
      hip,
      ankle,
      knee: solveLeg(hip, ankle, proportions.thigh, proportions.shin),
      pitch,
      contact: { x: ankle.x + rotatedX, y: ankle.y + rotatedY },
    };
  });
  return {
    legs,
    body: { x: 8, y: hipY },
    lean: 0.055 * blend,
    tailAngle: Math.sin((phase / 10) * Math.PI * 2 - 0.5) * 0.035 * blend,
    capeAngle: Math.sin((phase / 10) * Math.PI * 2 - 1) * 0.025 * blend,
  };
}
const tintedParts = new WeakMap();
function tintedPart(atlas, spec, filter) {
  if (!filter || typeof atlas !== "object" || typeof document === "undefined")
    return null;
  let variants = tintedParts.get(atlas);
  if (!variants) tintedParts.set(atlas, (variants = new Map()));
  const key = `${spec.rect.join(",")}:${filter}`;
  if (!variants.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = spec.rect[2];
    canvas.height = spec.rect[3];
    const c = canvas.getContext("2d");
    c.filter = filter;
    c.drawImage(atlas, ...spec.rect, 0, 0, canvas.width, canvas.height);
    variants.set(key, canvas);
  }
  return variants.get(key);
}
function part(
  ctx,
  atlas,
  spec,
  position,
  angle = 0,
  scale = spec.scale,
  filter = "",
) {
  const tinted = tintedPart(atlas, spec, filter);
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  if (filter && !tinted) ctx.filter = filter;
  ctx.drawImage(
    tinted || atlas,
    ...(tinted ? [0, 0, spec.rect[2], spec.rect[3]] : spec.rect),
    -spec.pivot[0],
    -spec.pivot[1],
    spec.rect[2],
    spec.rect[3],
  );
  ctx.restore();
}
function bone(ctx, atlas, spec, start, end, filter) {
  const dx = spec.tip[0] - spec.pivot[0],
    dy = spec.tip[1] - spec.pivot[1];
  const tx = end.x - start.x,
    ty = end.y - start.y;
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(Math.atan2(ty, tx) - Math.PI / 2);
  // Fit greave width to the knee without moving either joint pivot.
  ctx.scale(spec.widthScale ?? 1, 1);
  part(
    ctx,
    atlas,
    spec,
    { x: 0, y: 0 },
    Math.PI / 2 - Math.atan2(dy, dx),
    Math.hypot(tx, ty) / Math.hypot(dx, dy),
    filter,
  );
  ctx.restore();
}
export function drawWalkRig(ctx, atlas, player, hitTint = false) {
  const a = player.animation,
    hero = player.hero === 0 ? 0 : 1;
  const specs = HERO_RIG_PARTS[hero === 0 ? "quirel" : "urmasa"];
  const phase = a.walkPhase ?? Math.max(0, a.frame - 24);
  const blend = a.walkBlend ?? (a.state === "walk" ? 1 : 0);
  const pose = walkRigPose(hero, phase, blend, a.elapsed || 0);
  const body = pose.body;
  const tint = hitTint ? "brightness(1.14) sepia(0.18) saturate(0.85)" : "";
  part(
    ctx,
    atlas,
    specs.cape,
    { x: body.x - 8, y: body.y - (hero === 0 ? 27 : 33) },
    pose.capeAngle,
    undefined,
    tint,
  );
  part(
    ctx,
    atlas,
    specs.tail,
    { x: body.x - 4, y: body.y + 1 },
    pose.tailAngle,
    undefined,
    tint,
  );
  for (const leg of pose.legs) {
    const pieces = leg.far ? specs.farLeg : specs.nearLeg;
    // Darker far leg retains full opacity, including every toe.
    const filter = leg.far ? `${tint} brightness(0.76)`.trim() : tint;
    part(
      ctx,
      atlas,
      pieces.foot,
      leg.ankle,
      leg.pitch,
      pieces.foot.scale * HERO_LEGS[hero].footScale,
      filter,
    );
    bone(ctx, atlas, pieces.shin, leg.knee, leg.ankle, filter);
    // The thigh owns the visible kneecap and covers the shin's socket.
    bone(ctx, atlas, pieces.thigh, leg.hip, leg.knee, filter);
  }
  // The short hip cloth overlaps the thigh joints; cloak stays behind both feet.
  part(ctx, atlas, specs.body, body, pose.lean, undefined, tint);
}
