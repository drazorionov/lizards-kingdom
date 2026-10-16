// Source names follow the supplied Russian character boards.
export const CREATURES = {
  "mushroom-stomper": { name: "Грибной остолоп", behavior: "walker", size: 76 },
  "mire-lizard": { name: "Гнилой ящер", behavior: "charger", size: 80 },
  "masked-corvid": { name: "Летающий остолоп", behavior: "bird", size: 86 },
  "armored-corvid": {
    name: "Бронированный остолоп",
    behavior: "charger",
    size: 82,
  },
  "corvid-leader": { name: "Вожак остолопов", behavior: "charger", size: 92 },
  "flying-spore": { name: "Летучая спора", behavior: "floater", size: 68 },
  "marsh-spitter": { name: "Болотный плевун", behavior: "spitter", size: 82 },
  "shadow-watcher": {
    name: "Теневой наблюдатель",
    behavior: "spitter",
    size: 74,
  },
  "lake-jellyfish": { name: "Озёрная медуза", behavior: "floater", size: 82 },
  "ashen-warrior": { name: "Пустошный воин", behavior: "charger", size: 90 },
  "depth-crawler": { name: "Глубинный ползун", behavior: "walker", size: 82 },
  "crystal-guard": { name: "Кристальный страж", behavior: "walker", size: 80 },
};
export const REGION_CREATURES = [
  ["mushroom-stomper", "flying-spore", "masked-corvid"],
  ["mire-lizard", "marsh-spitter", "masked-corvid"],
  ["masked-corvid", "armored-corvid", "corvid-leader"],
  ["ashen-warrior", "armored-corvid", "corvid-leader"],
  ["depth-crawler", "shadow-watcher", "masked-corvid"],
  ["crystal-guard", "lake-jellyfish", "shadow-watcher"],
];
export const BOSSES = [
  "spore-mother",
  "mire-guardian",
  "storm-beast",
  "bell-keeper",
  "shadow-warden",
  "lake-lady",
];
export function creatureFrame(e, time = 0) {
  if (e.hp <= 0 || e.dead) return e.deathTime < 0.25 ? 14 : 15;
  if (e.hit > 0) return e.hit > 0.1 ? 12 : 13;
  if (e.state === "windup" || e.phase === 1) return e.timer > 0.35 ? 8 : 9;
  if (e.state === "attack" || e.phase === 2) return e.timer > 0.2 ? 10 : 11;
  if (e.state === "move")
    return (
      4 +
      (Math.floor(time * (e.behavior === "bird" ? 10 : 8) + (e.id || 0)) % 4)
    );
  return [0, 1, 2, 3, 2, 1][Math.floor(time * 4 + (e.id || 0)) % 6];
}
export function drawCreature(ctx, assets, key, e, time, options = {}) {
  const atlas = assets[`creature-${key}`];
  if (!atlas) return;
  const frame = creatureFrame(e, time),
    cell = 256;
  const size = options.size || CREATURES[key]?.size || 190;
  ctx.save();
  ctx.globalAlpha =
    options.alpha ??
    (e.dead || e.hp <= 0
      ? Math.max(0, 1 - (e.deathTime || 0) / 1.2)
      : e.hit > 0
        ? 0.65
        : 1);
  ctx.translate(options.x ?? e.x + e.w / 2, options.y ?? e.y + e.h);
  ctx.scale(e.dir || 1, 1);
  ctx.drawImage(
    atlas,
    (frame % 4) * cell,
    Math.floor(frame / 4) * cell,
    cell,
    cell,
    -size / 2,
    (-size * 240) / 256,
    size,
    size,
  );
  ctx.restore();
}
export function stepCreature(e, p, world, dt, time) {
  if (e.hp <= 0) {
    e.deathTime = (e.deathTime || 0) + dt;
    return;
  }
  e.hit = Math.max(0, e.hit - dt);
  e.timer -= dt;
  const near = Math.abs(p.x - e.x) < 250 && Math.abs(p.y - e.y) < 150;
  if (e.timer <= 0) {
    if (e.state === "windup") {
      e.state = "attack";
      e.timer = 0.45;
      if (
        ["spitter", "floater"].includes(e.behavior) &&
        world.projectiles.length < 24
      ) {
        const dx = p.x - e.x,
          dy = p.y - e.y,
          length = Math.max(1, Math.hypot(dx, dy));
        world.projectiles.push({
          x: e.x + e.w / 2,
          y: e.y + 12,
          w: 14,
          h: 14,
          vx: (dx / length) * 150,
          vy: (dy / length) * 150,
          life: 2.5,
        });
      }
    } else if (e.state === "attack") {
      e.state = "idle";
      e.timer = 1.6;
    } else if (near && (e.behavior !== "walker" || Math.abs(p.x - e.x) < 100)) {
      e.state = "windup";
      e.timer = 0.75;
      e.dir = p.x < e.x ? -1 : 1;
    } else {
      e.state = e.state === "idle" ? "move" : "idle";
      e.timer = e.state === "move" ? 2.4 : 1.1;
    }
  }
  if (e.state === "move")
    e.x += e.dir * (e.behavior === "bird" ? 65 : 38 + world.region * 3) * dt;
  if (e.state === "attack" && ["charger", "bird"].includes(e.behavior))
    e.x += e.dir * 155 * dt;
  if (e.x < e.min) {
    e.x = e.min;
    e.dir = 1;
  }
  if (e.x > e.max) {
    e.x = e.max;
    e.dir = -1;
  }
  if (e.behavior === "floater")
    e.y = e.baseY - 48 + Math.sin(time * 2 + e.id) * 22;
  if (e.behavior === "bird") {
    const target =
      e.state === "move"
        ? e.baseY - 75 - Math.sin(time * 2 + e.id) * 12
        : e.state === "windup"
          ? e.baseY - 90
          : e.baseY;
    e.y += (target - e.y) * Math.min(1, dt * 7);
  }
}
