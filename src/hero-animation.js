import { HERO_MOTION } from "./hero-motion-data.js";
import { drawWalkRig, WALK_STRIDE } from "./hero-walk-rig.js";

// Legacy idle/jump poses retain their indices; both heroes share new action rows.
export const HERO_RUN_START = 24;
export const HERO_ATTACK_START = 34;
export const HERO_ACTION_FRAMES = 10;
export const HERO_RUN_STRIDE = WALK_STRIDE;
export const HERO_ATLAS = Object.freeze({
  cell: 384,
  columns: 4,
  anchorX: 192,
  anchorY: 368,
  size: 114,
});
const IDLE = [0, 1, 2, 3, 2, 1];
export function createHeroAnimation() {
  return {
    state: "fall",
    elapsed: 0,
    walkPhase: 0,
    walkBlend: 0,
    frame: 15,
    grounded: false,
    landing: 0,
    jumps: 0,
    takeoff: 0,
  };
}
export function updateHeroAnimation(player, dt) {
  const a = player.animation || (player.animation = createHeroAnimation());
  if (player.grounded && !a.grounded) a.landing = 0.1;
  if (
    !player.grounded &&
    player.vy < 0 &&
    (a.grounded || player.jumps > a.jumps)
  )
    a.takeoff = 0.075;
  a.landing = Math.max(0, a.landing - dt);
  a.takeoff = Math.max(0, a.takeoff - dt);
  const state =
    player.attack > 0
      ? "attack"
      : player.dash > 0
        ? "dash"
        : player.wall && !player.grounded && player.vy >= 0
          ? "wall"
          : player.wallKick > 0
            ? "wallkick"
            : !player.grounded
              ? a.takeoff > 0
                ? "takeoff"
                : player.vy < -90
                  ? "rise"
                  : player.vy > 100
                    ? "fall"
                    : "apex"
              : a.landing > 0
                ? "land"
                : Math.abs(player.vx) > 1
                  ? "walk"
                  : "idle";
  if (state !== a.state) {
    a.state = state;
    a.elapsed = 0;
  } else a.elapsed += dt;
  // Ease starting/stopping without dissolving or swapping the character image.
  const targetBlend = state === "walk" ? 1 : 0;
  a.walkBlend =
    targetBlend + ((a.walkBlend || 0) - targetBlend) * Math.exp(-dt / 0.08);
  // A stopped character freezes the gait phase; changes of direction do not reset it.
  if (state === "walk")
    a.walkPhase =
      (a.walkPhase +
        (Math.abs(player.vx) * dt * HERO_ACTION_FRAMES) / HERO_RUN_STRIDE) %
      HERO_ACTION_FRAMES;
  a.frame =
    state === "idle"
      ? IDLE[Math.floor(a.elapsed * 5) % IDLE.length]
      : state === "walk"
        ? HERO_RUN_START + Math.floor(a.walkPhase)
        : state === "land" || state === "takeoff"
          ? 12
          : state === "rise" || state === "dash"
            ? 13
            : state === "apex"
              ? 14
              : 15;
  if (state === "attack") {
    const duration = player.attackDuration || (player.hero === 0 ? 0.32 : 0.21);
    const progress = Math.max(0, Math.min(1, 1 - player.attack / duration));
    a.frame =
      HERO_ATTACK_START +
      Math.min(9, Math.floor(progress * HERO_ACTION_FRAMES));
  }
  if (player.hero === 0) {
    if (state === "wall") a.frame = 20;
    if (state === "wallkick") a.frame = 21;
    if (player.jumps === 2 && state === "rise") a.frame = 22;
  }
  a.grounded = player.grounded;
  a.jumps = player.jumps;
  return a;
}
export function heroFrameRect(frame) {
  return [
    (frame % HERO_ATLAS.columns) * HERO_ATLAS.cell,
    Math.floor(frame / HERO_ATLAS.columns) * HERO_ATLAS.cell,
    HERO_ATLAS.cell,
    HERO_ATLAS.cell,
  ];
}
export function drawHero(
  ctx,
  atlas,
  player,
  {
    x = player.x + player.w / 2,
    y = player.y + player.h,
    alpha = 1,
    size = HERO_ATLAS.size,
    rig = null,
    hitTint = false,
  } = {},
) {
  const animation = player.animation || { frame: 0, state: "idle", elapsed: 0 };
  if (
    rig &&
    player.animation &&
    ["walk", "idle", "land"].includes(animation.state)
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale((player.dir * size) / HERO_ATLAS.size, size / HERO_ATLAS.size);
    drawWalkRig(ctx, rig, player, hitTint);
    ctx.restore();
    return;
  }
  const [sx, sy, sw, sh] = heroFrameRect(animation.frame);
  const motion = HERO_MOTION[player.hero === 0 ? "quirel" : "urmasa"];
  const registration =
    animation.frame >= HERO_ATTACK_START
      ? motion.attack[animation.frame - HERO_ATTACK_START]
      : animation.frame >= HERO_RUN_START
        ? motion.run[animation.frame - HERO_RUN_START]
        : null;
  const drawSize = size * (registration?.scale || 1);
  const anchorX = registration?.anchorX ?? HERO_ATLAS.anchorX;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(player.dir, 1);
  if (hitTint) ctx.filter = "brightness(1.14) sepia(0.18) saturate(0.85)";
  // Full-body combat follow-through is painted into the ten distinct poses.
  if (animation.state === "dash") ctx.rotate(0.12);
  ctx.drawImage(
    atlas,
    sx,
    sy,
    sw,
    sh,
    -(anchorX / sw) * drawSize,
    -(HERO_ATLAS.anchorY / sh) * drawSize,
    drawSize,
    drawSize,
  );
  ctx.restore();
}
