// Both heroes use registered 384px cells; Quirel adds combat and wall-kick rows.
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
    player.dash > 0
      ? "dash"
      : player.attack > 0
        ? "attack"
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
  // A stopped character freezes the gait phase; changes of direction do not reset it.
  if (state === "walk")
    a.walkPhase = (a.walkPhase + (Math.abs(player.vx) * dt) / 23) % 8;
  a.frame =
    state === "idle"
      ? IDLE[Math.floor(a.elapsed * 5) % IDLE.length]
      : state === "walk"
        ? 4 + Math.floor(a.walkPhase)
        : state === "land" || state === "takeoff"
          ? 12
          : state === "rise" || state === "dash"
            ? 13
            : state === "apex"
              ? 14
              : state === "attack"
                ? player.grounded
                  ? 7
                  : player.vy < 0
                    ? 13
                    : 15
                : 15;
  if (player.hero === 0) {
    if (state === "attack")
      a.frame = player.grounded
        ? 16 +
          Math.min(
            3,
            Math.floor(
              (1 - player.attack / (player.attackDuration || 0.32)) * 4,
            ),
          )
        : 23;
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
    (frame % 4) * HERO_ATLAS.cell,
    Math.floor(frame / 4) * HERO_ATLAS.cell,
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
  } = {},
) {
  const animation = player.animation || { frame: 0, state: "idle", elapsed: 0 };
  const [sx, sy, sw, sh] = heroFrameRect(animation.frame);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(player.dir, 1);
  // Subtle follow-through uses the same detailed sprite during combat and dash.
  if (animation.state === "attack" && player.hero !== 0)
    ctx.rotate(Math.sin((1 - player.attack / 0.21) * Math.PI) * 0.12);
  if (animation.state === "dash") ctx.rotate(0.12);
  ctx.drawImage(
    atlas,
    sx,
    sy,
    sw,
    sh,
    -size / 2,
    -(368 / sh) * size,
    size,
    size,
  );
  ctx.restore();
}
