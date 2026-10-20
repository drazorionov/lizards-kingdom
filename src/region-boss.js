// Each encounter cycles four readable moves, changes pace at half health,
// and commits to a target during the tell so dodging remains fair.
export const BOSS_MOVES = [
  [],
  ["Трясина", "Град болотных огней", "Прыжок стража", "Корни по земле"],
  ["Разряд с небес", "Веер молний", "Грозовой бросок", "Две волны грома"],
  ["Падающие колокола", "Осколки звона", "Удар колокола", "Звон по земле"],
  ["Теневые иглы", "Звёзды глубин", "Шаг сквозь тень", "Дыхание Глубин"],
  ["Кристальные пики", "Аметистовый веер", "Прыжок отражения", "Волна озера"],
];
export function stepRegionBoss(game, dt) {
  const { world: w, player: p } = game,
    b = w.boss,
    r = w.region;
  b.state ||= "rest";
  b.moveIndex ||= 0;
  b.timer -= dt;
  b.elapsed = (b.elapsed || 0) + dt;
  if (b.hp <= b.maxHp / 2 && !b.enraged && b.state === "rest") {
    b.enraged = true;
    b.state = "awaken";
    b.phase = 1;
    b.timer = 1.8;
    b.elapsed = 0;
    game.cb.toast(`${game.region.boss} · Вторая фаза!`);
  }
  if (b.state === "strike" && b.moveIndex === 2) {
    const q = Math.min(1, b.elapsed / 0.9);
    b.x = b.fromX + (b.targetX - b.fromX) * q;
    b.y = 380 - Math.sin(q * Math.PI) * (r === 4 ? 65 : 170);
  }
  if (b.timer > 0) return;
  if (b.state === "rest" || b.state === "awaken") {
    b.state = "windup";
    b.phase = 1;
    b.elapsed = 0;
    b.timer = game.progress.mode === "gentle" ? 1.35 : 1;
    b.targetY = p.y + 27;
    b.targetX = Math.max(
      3540 + w.arenaOffset,
      Math.min(4240 + w.arenaOffset, p.x),
    );
    b.fromX = b.x;
    b.label = BOSS_MOVES[r][b.moveIndex];
    if (b.moveIndex === 0 || b.moveIndex === 2) {
      const spots =
        b.moveIndex === 2
          ? [b.targetX + 60]
          : [p.x + 15, ...(b.enraged ? [p.x - 165, p.x + 195] : [])];
      for (const x of spots)
        w.hazards.push({
          x:
            Math.max(3510 + w.arenaOffset, Math.min(4310 + w.arenaOffset, x)) -
            35,
          y: 380,
          w: b.moveIndex === 2 ? 145 : 70,
          h: 120,
          delay: b.timer + (b.moveIndex === 2 ? 0.8 : 0),
          total: b.timer,
          life: 0.8,
          kind: r,
        });
    }
  } else if (b.state === "windup") {
    b.state = "strike";
    b.phase = 2;
    b.elapsed = 0;
    b.timer = b.moveIndex === 2 ? 0.95 : 0.8;
    b.attackId++;
    const speed = game.progress.mode === "gentle" ? 205 : 255;
    if (b.moveIndex === 1) {
      const count = b.enraged ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const spread = i - (count - 1) / 2;
        const angle =
          Math.atan2(b.targetY - (b.y + 30), b.targetX - (b.x + 60)) +
          spread * 0.15;
        w.projectiles.push({
          x: b.x + 60,
          y: b.y + 30,
          w: 18,
          h: 18,
          vx:
            r === 2 || r === 4
              ? Math.cos(angle) * speed
              : spread * speed * 0.38,
          vy: r === 2 || r === 4 ? Math.sin(angle) * speed : -230,
          gravity: r === 2 || r === 4 ? 0 : r === 3 ? 320 : 220,
          life: 4,
        });
      }
    }
    if (b.moveIndex === 3)
      for (const dir of [-1, 1]) {
        w.projectiles.push({
          x: b.x + 60,
          y: 474,
          w: 34,
          h: 24,
          vx: dir * speed,
          life: 5,
        });
        if (b.enraged)
          w.projectiles.push({
            x: b.x + 60,
            y: 395,
            w: 20,
            h: 20,
            vx: dir * speed * 0.7,
            life: 5,
          });
      }
  } else {
    b.y = 380;
    b.state = "rest";
    b.phase = 0;
    b.elapsed = 0;
    b.timer =
      (game.progress.mode === "gentle" ? 1.9 : 1.4) * (b.enraged ? 0.8 : 1);
    b.moveIndex = (b.moveIndex + 1) % 4;
  }
}
export function regionBossFrame(b) {
  if (b.dead) return b.deathTime < 0.35 ? 22 : 23;
  if (b.hit > 0) return b.hit > 0.08 ? 20 : 21;
  if (b.state === "awaken")
    return 16 + Math.min(3, Math.floor((b.elapsed / 1.8) * 4));
  if (b.state === "windup") return b.moveIndex * 4 + (b.timer > 0.5 ? 0 : 1);
  if (b.state === "strike") return b.moveIndex * 4 + (b.elapsed < 0.4 ? 2 : 3);
  return null;
}
