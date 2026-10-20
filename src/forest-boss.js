// Deterministic attack timelines. Every damaging action follows a locked tell;
// no target follows the player once the warning begins.
export const MOTHER_MOVES = ["roots", "spores", "burrow", "sweep"];
export const MOTHER_LABELS = {
  roots: "КОРНИ · ОТОЙДИ ОТ МЕТОК",
  spores: "СПОРЫ · НАЙДИ ПРОСВЕТ",
  burrow: "ПОД ЗЕМЛЁЙ · ОТОЙДИ",
  sweep: "ВЗМАХ · ПРЫГАЙ",
  awaken: "ГРИБНИЦА ПРОБУЖДАЕТСЯ",
};
function hazard(w, x, width, kind, delay, life = 0.45) {
  if (w.hazards.length >= 16) return;
  w.hazards.push({
    x,
    y: 500 - (kind === "root" ? 100 : 75),
    w: width,
    h: kind === "root" ? 100 : 75,
    kind,
    delay,
    life,
    total: delay,
  });
}
function begin(b, state, duration) {
  b.state = state;
  b.timer = duration;
  b.duration = duration;
  b.elapsed = 0;
}
export function resetMother(b) {
  b.x = 4020 + (b.arenaOffset || 0);
  b.y = 380;
  b.hp = b.maxHp;
  b.enraged = false;
  b.shieldUsed = false;
  b.awakened = false;
  b.moveIndex = 0;
  b.move = null;
  b.pose = null;
  b.phase = 0;
  b.active = false;
  begin(b, "rest", 2.1);
}
export function stepMother(game, dt) {
  const w = game.world,
    b = w.boss,
    p = game.player,
    offset = w.arenaOffset || 0,
    gentle = game.progress.mode === "gentle";
  b.elapsed = (b.elapsed || 0) + dt;
  b.timer -= dt;
  b.dir = p.x < b.x ? -1 : 1;
  if (!b.state) begin(b, "rest", 2.1);
  if (b.hp <= b.maxHp / 2 && !b.awakened && b.state === "rest") {
    b.awakened = true;
    b.enraged = true;
    b.move = "awaken";
    b.phase = 1;
    begin(b, "awaken", 2);
    game.cb.toast("Споровая мать пробуждается. Следи за метками на земле!");
  }
  const progress = Math.min(0.999, b.elapsed / b.duration);
  if (b.state === "rest") {
    b.phase = 0;
    b.pose = null;
  } else if (b.state === "awaken") b.pose = 16 + Math.floor(progress * 4);
  else if (b.state === "windup") {
    b.phase = 1;
    const frames = {
      roots: [0, 1],
      spores: [4, 5],
      burrow: [8, 9],
      sweep: [12, 13],
    }[b.move];
    b.pose = frames[Math.min(1, Math.floor(progress * 2))];
  } else if (b.state === "strike") {
    b.phase = 2;
    const frames = {
      roots: [2, 3],
      spores: [6, 7],
      burrow: [10, 11],
      sweep: [14, 15],
    }[b.move];
    b.pose = frames[Math.min(1, Math.floor(progress * 2))];
    if (b.move === "burrow" && progress > 0.45 && !b.relocated) {
      b.x = b.targetX;
      b.relocated = true;
      game.emit(b.x + 60, 490, "#c4a0ef", 22);
    }
  }
  if (b.timer > 0) return;
  if (b.state === "rest") {
    b.move = MOTHER_MOVES[(b.moveIndex || 0) % MOTHER_MOVES.length];
    b.moveIndex = (b.moveIndex || 0) + 1;
    const tell = gentle ? 1.25 : 1;
    begin(b, "windup", tell);
    b.phase = 1;
    b.targetX = Math.max(3540 + offset, Math.min(4160 + offset, p.x - 45));
    b.relocated = false;
    if (b.move === "roots") {
      // Offset strikes leave generous safe gaps, including for the larger iPad controls.
      for (const offset of b.enraged ? [-190, 0, 190] : [0, 230])
        hazard(
          w,
          Math.max(
            3500 + w.arenaOffset,
            Math.min(4350 + w.arenaOffset, p.x + offset - 25),
          ),
          65,
          "root",
          tell,
        );
    } else if (b.move === "burrow")
      hazard(w, b.targetX - 25, 175, "burst", tell + 0.42, 0.5);
    game.cb.toast(MOTHER_LABELS[b.move]);
  } else if (b.state === "windup") {
    begin(b, "strike", b.move === "burrow" ? 1.1 : 0.8);
    b.phase = 2;
    b.attackId++;
    if (b.move === "spores") {
      const count = b.enraged ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.88 + i * ((Math.PI * 0.76) / (count - 1));
        w.projectiles.push({
          x: b.x + 55,
          y: b.y + 15,
          w: 19,
          h: 19,
          vx: Math.cos(angle) * (gentle ? 190 : 230),
          vy: Math.sin(angle) * 270,
          gravity: 240,
          life: 4,
          kind: "spore",
        });
      }
    } else if (b.move === "sweep") {
      for (const dir of [-1, 1])
        w.projectiles.push({
          x: b.x + 50,
          y: 475,
          w: 48,
          h: 25,
          vx: dir * (gentle ? 230 : 290),
          life: 4,
          kind: "wave",
        });
    }
  } else {
    begin(b, "rest", b.enraged ? (gentle ? 1.35 : 0.95) : gentle ? 1.9 : 1.4);
    b.phase = 0;
    b.pose = null;
  }
}
export function stepForestHazards(game, dt) {
  const w = game.world;
  for (let i = w.hazards.length - 1; i >= 0; i--) {
    const a = w.hazards[i];
    a.delay -= dt;
    if (a.delay > 0) continue;
    a.life -= dt;
    const p = game.player;
    if (
      p.x < a.x + a.w &&
      p.x + p.w > a.x &&
      p.y < a.y + a.h &&
      p.y + p.h > a.y
    )
      game.damage();
    if (!w.hazards[i]) break;
    if (a.life <= 0) w.hazards.splice(i, 1);
  }
}
