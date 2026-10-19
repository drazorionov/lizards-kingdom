import { createWallDebris, stepWallDebris } from "./terrain.js";
import { roomAt } from "./regions.js";
import { growth, hasService, TOKEN_TYPES } from "./progression.js";
import { createTown, nearbyResident } from "./town.js";
import { stepRegionBoss } from "./region-boss.js";
import { stepMother, resetMother, stepForestHazards } from "./forest-boss.js";
import { stepCreature } from "./creatures.js";
import { createHeroAnimation, updateHeroAnimation } from "./hero-animation.js";
import {
  REGIONS,
  PHYSICS,
  WORLD_WIDTH,
  createWorld,
  movePlayer,
  overlaps,
  clamp,
} from "./world.js";
export function clearSight(p, target, platforms) {
  const x = p.x + p.w / 2,
    y = p.y + p.h / 2,
    dx = target.x - x,
    dy = target.y - y;
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) / 12));
  for (let i = 1; i < steps; i++) {
    const px = x + (dx * i) / steps,
      py = y + (dy * i) / steps;
    if (
      platforms.some(
        (s) =>
          s.solid &&
          !s.absent &&
          px > s.x &&
          px < s.x + s.w &&
          py > s.y &&
          py < s.y + s.h,
      )
    )
      return false;
  }
  return true;
}
export class Game {
  constructor(canvas, assets, renderer, callbacks) {
    this.canvas = canvas;
    this.assets = assets;
    this.renderer = renderer;
    this.cb = callbacks;
    this.keys = new Set();
    this.pressed = new Set();
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.accumulator = 0;
    this.previous = 0;
    this.particles = [];
    this.wallDebris = [];
    this.attackSerial = 0;
    this.camera = 0;
    this.checkpointUsed = false;
    this.inputEvents();
    this.loop = this.loop.bind(this);
  }
  inputEvents() {
    const controls = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "jump",
      ArrowDown: "dash",
      Space: "attack",
      KeyA: "left",
      KeyD: "right",
      KeyW: "jump",
      KeyS: "dash",
    };
    window.addEventListener("keydown", (e) => {
      if (
        !this.running ||
        this.paused ||
        /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
      )
        return;
      const key = controls[e.code];
      if (key) {
        e.preventDefault();
        if (!e.repeat) this.press(key);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (controls[e.code]) this.release(controls[e.code]);
    });
    window.addEventListener("blur", () => {
      this.clearInput();
      if (this.running && !this.paused) this.cb.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clearInput();
        if (this.running && !this.paused) this.cb.pause();
      }
    });
  }
  press(key) {
    if (this.paused) return;
    this.keys.add(key);
    this.pressed.add(key);
  }
  release(key) {
    this.keys.delete(key);
    if (key === "jump" && this.player?.vy < -220) this.player.vy = -220;
  }
  clearInput() {
    this.keys.clear();
    this.pressed.clear();
    document
      .querySelectorAll(".pressed")
      .forEach((e) => e.classList.remove("pressed"));
  }
  start(region, progress) {
    this.progress = progress;
    for (const key of ["secrets", "revealed", "discovered", "broken"])
      this.progress[key] ||= {};
    for (const key of ["services", "quests", "visited"])
      this.progress[key] ||= [];
    this.progress.visited = [...new Set([...this.progress.visited, region])];
    this.world = createWorld(region, progress);
    this.region = REGIONS[region];
    this.checkpointUsed = progress.region === region && progress.checkpoint;
    this.player = {
      hero: progress.hero,
      wall: 0,
      wallCoyote: 0,
      lastWall: 0,
      wallKick: 0,
      animation: createHeroAnimation(),
      x: this.checkpointUsed ? this.world.checkpoint.x : this.world.spawn.x,
      y: this.checkpointUsed
        ? this.world.checkpoint.y - 54
        : this.world.spawn.y,
      w: 31,
      h: 54,
      vx: 0,
      vy: 0,
      dir: 1,
      grounded: false,
      jumps: 0,
      coyote: 0,
      jumpBuffer: 0,
      health: this.maxHealth(),
      invulnerable: 1.2,
      attack: 0,
      attackCooldown: 0,
      dash: 0,
      dashCooldown: 0,
    };
    this.particles = [];
    this.wallDebris = [];
    this.cameraY = this.world.expanded
      ? Math.max(0, Math.min(this.world.height - 620, this.player.y - 350))
      : 0;
    this.camera = Math.max(0, this.player.x - 300);
    this.running = true;
    this.paused = false;
    this.finished = false;
    this.gateHint = false;
    this.lastHud = "";
    this.clearInput();
    this.renderer.prepare(region, this.world);
    this.previous = 0;
    this.accumulator = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    this.cb.toast(
      this.checkpointUsed
        ? "С возвращением, маленький странник."
        : `${this.region.name} · Приключение начинается.`,
    );
    this.updateHud();
  }
  maxHealth() {
    return (
      (this.progress?.mode === "adventure" ? 5 : 7) +
      growth(this.progress).hearts +
      (hasService(this.progress, "medicine") ? 1 : 0)
    );
  }
  startTown(progress) {
    this.start(progress.region, progress);
    this.world = createTown(progress.region);
    this.camera = 0;
    this.cameraY = Math.max(0, this.world.height - 620);
    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;
    this.player.health = this.maxHealth();
    this.renderer.prepare(progress.region, this.world);
    this.lastHud = "";
    this.updateHud();
    this.cb.toast("Древоград · Поднимайся по уступам к домам в кроне.");
  }
  attackPower() {
    return (
      growth(this.progress).damage +
      (hasService(this.progress, "forge") ? 1 : 0) +
      (this.player.buff > 0 ? 1 : 0) +
      (this.player.counter > 0 ? 1 : 0)
    );
  }
  pause() {
    this.paused = true;
    this.clearInput();
  }
  resume() {
    this.paused = false;
    this.previous = 0;
    this.clearInput();
    this.canvas.focus();
  }
  stop() {
    this.running = false;
    this.clearInput();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  loop(timestamp) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.running) return;
    const dt = this.previous
      ? Math.min((timestamp - this.previous) / 1000, 0.05)
      : 0;
    this.previous = timestamp;
    if (!this.paused) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) {
        this.step(1 / 60);
        this.accumulator -= 1 / 60;
      }
      this.renderer.draw(this);
    }
  }
  emit(x, y, color, count = 10) {
    for (let i = 0; i < count && this.particles.length < 100; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: -Math.random() * 170,
        life: 0.5 + Math.random() * 0.4,
        max: 1,
        color,
        size: 1 + Math.random() * 3,
      });
  }
  step(dt) {
    const p = this.player,
      w = this.world;
    this.time += dt;
    const stats = growth(this.progress);
    p.buff = Math.max(0, (p.buff || 0) - dt);
    p.counter = Math.max(0, (p.counter || 0) - dt);
    if (this.pressed.has("attack")) {
      const npc = w.town && nearbyResident(w, p);
      const portal = w.portals?.find(
        (n) =>
          Math.hypot(n.x - p.x - 15, n.y - p.y - 27) < 65 &&
          ((!n.secretId && n.secretId !== 0) ||
            w.secrets.some((s) => s.id === n.secretId && s.found)),
      );
      if (
        (npc && this.cb.interact) ||
        (portal && this.cb.travel && p.invulnerable < 0.7)
      ) {
        this.clearInput();
        this.persist();
        this.pause();
        if (npc) this.cb.interact?.(npc);
        else this.cb.travel?.(portal.to);
        return;
      }
    }
    for (const key of [
      "invulnerable",
      "attack",
      "attackCooldown",
      "dash",
      "dashCooldown",
      "coyote",
      "jumpBuffer",
      "wallCoyote",
      "wallKick",
      "absorb",
    ])
      p[key] = Math.max(0, (p[key] || 0) - dt);
    if (p.grounded) p.coyote = 0.12;
    if (this.pressed.has("jump")) p.jumpBuffer = 0.14;
    if (p.jumpBuffer > 0 && p.wallCoyote > 0 && !p.grounded) {
      p.vy = stats.wallJump;
      p.vx = -p.lastWall * 310;
      p.dir = -p.lastWall;
      p.wallKick = 0.18;
      p.wallCoyote = 0;
      p.wall = 0;
      p.jumps = 1;
      p.jumpBuffer = 0;
      p.coyote = 0;
      this.emit(p.x + p.w / 2, p.y + p.h, this.region.color, 5);
      this.cb.sound("jump");
    } else if (p.jumpBuffer > 0 && (p.coyote > 0 || p.jumps < 2)) {
      const first = p.coyote > 0 || p.jumps === 0;
      p.vy = first ? PHYSICS.jump : PHYSICS.doubleJump;
      p.jumps = first ? 1 : 2;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.emit(p.x + 15, p.y + 54, this.region.color, 6);
      this.cb.sound("jump");
    }
    if (this.pressed.has("dash") && p.dashCooldown === 0) {
      p.dash = p.hero === 1 && stats.level >= 3 ? 0.24 : 0.18;
      p.dashCooldown = stats.level >= 10 ? 0.5 : 0.8;
      if (p.hero === 1 && stats.level >= 3) {
        p.attackDuration = 0.24;
        p.attack = 0.24;
        p.attackCooldown = 0.32;
        this.attackSerial++;
      }
      p.invulnerable = Math.max(p.invulnerable, 0.22);
      this.emit(p.x, p.y + 25, this.region.color, 8);
    }
    let direction =
      (this.keys.has("right") ? 1 : 0) - (this.keys.has("left") ? 1 : 0);
    if (direction && p.wallKick === 0) p.dir = direction;
    if (p.dash > 0) {
      p.vx = p.dir * PHYSICS.dashSpeed;
      p.vy = -15;
    } else if (p.wallKick === 0) p.vx = direction * PHYSICS.speed;
    if (this.keys.has("attack") && p.attackCooldown === 0) {
      p.attackDuration = p.hero === 0 ? 0.32 : 0.21;
      p.attack = p.attackDuration;
      p.attackCooldown =
        (p.hero === 0 ? 0.42 : 0.32) *
        (stats.level >= 6 ? 0.85 : 1) *
        (hasService(this.progress, "training") ? 0.85 : 1);
      this.attackSerial++;
      this.cb.sound("attack");
      if (
        !w.town &&
        Math.abs(p.x - w.elder.x) < 100 &&
        Math.abs(p.y - w.elder.y) < 80
      )
        this.cb.toast(
          "Старейшина: Найди пять жетонов. Последний охраняет страж. Прыгай дважды и отталкивайся от стен!",
        );
    }
    const activePlatforms = w.platforms.filter((s) => !s.absent);
    movePlayer(p, activePlatforms, dt, w.width);
    for (const s of w.platforms)
      if (s.crumble) {
        if (s.absent) {
          s.restore -= dt;
          if (s.restore <= 0) {
            s.absent = false;
            s.crumbleTime = 0;
          }
        } else if (
          s.crumbleTime > 0 ||
          (p.grounded &&
            p.x + p.w > s.x &&
            p.x < s.x + s.w &&
            Math.abs(p.y + p.h - s.y) < 2)
        ) {
          s.crumbleTime = (s.crumbleTime || 0) + dt;
          if (s.crumbleTime > 0.8) {
            s.absent = true;
            s.restore = 3;
          }
        }
      }
    if (w.town) {
      this.camera +=
        (clamp(
          p.x - this.renderer.viewWidth * 0.36,
          0,
          Math.max(0, w.width - this.renderer.viewWidth),
        ) -
          this.camera) *
        Math.min(1, dt * 6);
      if (p.y > w.height) {
        p.x = w.spawn.x;
        p.y = w.spawn.y;
        p.vx = p.vy = 0;
      }
      this.cameraY +=
        (clamp(p.y - 330, 0, Math.max(0, w.height - 620)) - this.cameraY) *
        Math.min(1, dt * 6);
      updateHeroAnimation(p, dt);
      this.pressed.clear();
      this.updateHud();
      return;
    }
    if (p.y > w.height) this.damage(true);
    const attack = {
      x:
        p.hero === 0
          ? p.x - (stats.level >= 3 ? 78 : 58)
          : p.dir > 0
            ? p.x + 10
            : p.x - 86,
      y: p.y - 10,
      w: p.hero === 0 ? (stats.level >= 3 ? 187 : 147) : 108,
      h: 80,
    };
    if (w.expanded) {
      const room = roomAt(w, p);
      const fresh = !w.discovered.has(room.id);
      w.discovered.add(room.id);
      if (fresh) this.persist();
      if (w.roomId !== room.id) {
        w.roomId = room.id;
        this.cb.toast(room.name);
      }
      for (const s of w.platforms) {
        if (s.breakable && p.attack > 0 && overlaps(attack, s)) {
          s.broken = true;
          this.progress.broken[w.region] = [
            ...new Set([...(this.progress.broken[w.region] || []), s.id]),
          ];
          this.persist();
          this.wallDebris.push(...createWallDebris(s, w.region, p.dir));
          // Bound effects even if several barriers are destroyed together.
          this.wallDebris = this.wallDebris.slice(-160);
          for (let y = s.y + 12; y < s.y + s.h; y += 32) {
            const first = this.particles.length;
            this.emit(s.x + s.w / 2, y, "#c6b99a", 3);
            for (let i = first; i < this.particles.length; i++) {
              this.particles[i].dust = true;
              this.particles[i].life = 0.7 + Math.random() * 0.4;
              this.particles[i].size = 5 + Math.random() * 7;
              this.particles[i].vx *= 0.5;
              this.particles[i].vy *= 0.3;
            }
          }
          this.cb.toast(
            s.secret
              ? "Тайная грибница! В трещинах скрывался путь."
              : "Корни расступились. Короткий путь открыт.",
          );
          this.cb.sound("checkpoint");
        }
      }
      w.platforms = w.platforms.filter((s) => !s.broken);
    }
    for (const e of w.enemies) {
      if (
        w.expanded &&
        (Math.abs(e.x - p.x) > 1100 || Math.abs(e.y - p.y) > 700)
      )
        continue;
      stepCreature(e, p, w, dt, this.time);
      if (e.hp <= 0) continue;
      if (
        p.attack > 0 &&
        overlaps(attack, e) &&
        e.lastAttack !== this.attackSerial
      ) {
        e.lastAttack = this.attackSerial;
        e.hp -= this.attackPower();
        p.counter = 0;
        if (stats.level >= 7 && !p.grounded) p.jumps = Math.min(1, p.jumps);
        e.hit = 0.18;
        this.emit(e.x + 20, e.y + 20, this.region.glow);
        if (e.hp <= 0) this.cb.sound("token");
      }
      if (e.hp > 0 && overlaps(p, e)) {
        if (p.dash === 0) this.damage();
        else if (stats.level >= 8) p.counter = 3;
      }
    }
    for (const secret of w.secrets) {
      if (
        !secret.found &&
        Math.hypot(p.x + 15 - secret.x, p.y + 27 - secret.y) < 70 &&
        clearSight(p, secret, w.platforms)
      ) {
        secret.found = true;
        this.persist();
        this.cb.toast(`Тайна ${w.region + 1}.${secret.id + 1}: ${secret.name}`);
        this.emit(secret.x, secret.y, this.region.glow, 20);
        this.cb.sound("token");
      }
    }
    for (const spring of w.springs) {
      if (
        Math.hypot(p.x + 15 - spring.x, p.y + p.h - spring.y) < 65 &&
        (spring.refuge || hasService(this.progress, "spring"))
      ) {
        p.health = this.maxHealth();
        p.invulnerable = Math.max(
          p.invulnerable,
          this.progress.quests.includes("child") ? 3 : 1,
        );
        if (stats.level >= 5 && hasService(this.progress, "spring"))
          p.buff = this.progress.quests.includes("sola") ? 18 : 10;
      }
    }
    for (const token of w.tokens) {
      if (
        !token.revealed &&
        Math.hypot(p.x + 15 - token.x, p.y + 27 - token.y) < 150 &&
        clearSight(p, token, w.platforms)
      ) {
        token.revealed = true;
        this.persist();
      }
      if (
        token.type === 3 &&
        w.enemies.some(
          (e) => e.hp > 0 && Math.hypot(e.x - token.x, e.y - token.y) < 200,
        )
      )
        continue;
      if (token.collected || (token.boss && !w.boss.dead)) continue;
      if (
        Math.hypot(p.x + 15 - token.x, p.y + 27 - token.y) < 44 &&
        clearSight(p, token, w.platforms)
      ) {
        const oldLevel = growth(this.progress).level;
        token.collected = true;
        p.absorb = 0.65;
        p.absorbColor = TOKEN_TYPES[token.type].color;
        if (token.type === 1 && stats.level >= 5) p.buff = 15;
        this.emit(token.x, token.y, "#f8d78d", 20);
        this.cb.sound("token");
        this.persist();
        const count = w.tokens.filter((t) => t.collected).length;
        this.cb.toast(
          count === 5
            ? "Все пять жетонов найдены! Врата открыты."
            : `${TOKEN_TYPES[token.type].name} · ${count} / 5`,
        );
        if (count === 5) p.health = this.maxHealth();
        if (growth(this.progress).level > oldLevel) {
          p.health = this.maxHealth();
          this.cb.toast(
            `Новый уровень ${growth(this.progress).level}! Сила внутри.`,
          );
        }
      }
    }
    if (
      !this.checkpointUsed &&
      Math.abs(p.x - w.checkpoint.x) < 70 &&
      Math.abs(p.y + p.h - (w.checkpoint.y + 50)) < 85
    ) {
      this.checkpointUsed = true;
      p.health = this.maxHealth();
      this.emit(p.x, p.y, this.region.color, 20);
      this.cb.sound("checkpoint");
      this.cb.toast("Тёплый свет. Здоровье восстановлено. Путь сохранён.");
      this.persist();
    }
    this.stepBoss(dt, attack);
    stepForestHazards(this, dt);
    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const a = w.projectiles[i];
      if (!a) break; // A respawn clears the projectile list during collision handling.
      a.x += a.vx * dt;
      a.vy = (a.vy || 0) + (a.gravity || 0) * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      if (overlaps(p, a)) {
        if (p.dash > 0 && stats.level >= 8) p.counter = 3;
        this.damage();
        a.life = 0;
      }
      if (
        a.life <= 0 ||
        w.platforms.some((s) => (s.solid || s.wall) && overlaps(a, s))
      )
        w.projectiles.splice(i, 1);
    }
    const all = w.tokens.every((t) => t.collected);
    if (p.x > 4370 && all && w.boss.dead && !this.finished) {
      this.finished = true;
      this.progress.cleared = [
        ...new Set([...this.progress.cleared, w.region]),
      ];
      this.persist();
      this.cb.sound("win");
      this.pause();
      this.cb.complete(w.region);
    } else if (p.x > 4330 && !all && !this.gateHint) {
      this.gateHint = true;
      this.cb.toast(
        "Для врат нужны пять жетонов. Вернись по тропе за остальными.",
      );
    }
    stepWallDebris(this.wallDebris, dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const a = this.particles[i];
      a.life -= dt;
      if (a.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy += (a.dust ? -30 : 210) * dt;
    }
    const view = this.renderer.viewWidth;
    const target = clamp(p.x - view * 0.36, 0, Math.max(0, w.width - view));
    this.camera += (target - this.camera) * Math.min(1, dt * 6);
    const targetY = w.expanded ? clamp(p.y - 330, 0, w.height - 620) : 0;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 7);
    updateHeroAnimation(p, dt);
    this.pressed.clear();
    this.updateHud();
  }
  stepBoss(dt, attack) {
    const b = this.world.boss,
      p = this.player,
      w = this.world;
    if (b.dead) {
      b.deathTime += dt;
      return;
    }
    if (p.x > (w.region === 0 ? 3500 : 3600) && p.y < 560 && !b.active) {
      b.active = true;
      b.timer = 2.1;
      this.cb.toast(
        w.region === 0
          ? "Споровая мать · Следи за корнями и светящимися спорами!"
          : `${this.region.boss} · Следи за метками, прыжками и светящимися волнами!`,
      );
    }
    if (!b.active) return;
    b.hit = Math.max(0, b.hit - dt);

    if (
      p.attack > 0 &&
      overlaps(attack, b) &&
      b.lastAttack !== this.attackSerial
    ) {
      b.lastAttack = this.attackSerial;
      b.hp -= this.attackPower();
      p.counter = 0;
      if (growth(this.progress).level >= 7 && !p.grounded)
        p.jumps = Math.min(1, p.jumps);
      b.hit = 0.17;
      this.emit(b.x + 50, b.y + 50, "#edd296", 15);
      if (b.hp <= 0) {
        b.dead = true;
        b.active = false;
        w.projectiles = [];
        w.hazards = [];
        this.emit(b.x + 60, b.y + 50, this.region.glow, 40);
        this.cb.sound("win");
        this.cb.toast("Страж успокоился! Забери последний жетон.");
        this.progress.defeated = [
          ...new Set([...this.progress.defeated, w.region]),
        ];
        this.persist();
        return;
      }
    }
    if (overlaps(p, b)) this.damage();
    if (w.region === 0) {
      if (!b.active) return;
      stepMother(this, dt);
      // A living-root seal keeps the encounter inside the broad arena.
      p.x = clamp(p.x, 3480, 4400 - p.w);
      return;
    }
    stepRegionBoss(this, dt);
    p.x = clamp(p.x, 3480, 4400 - p.w);
  }

  rematchMother() {
    const w = this.world;
    if (w.town) return;
    resetMother(w.boss);
    w.boss.shieldUsed = false;
    w.boss.dead = false;
    w.boss.deathTime = 0;
    w.projectiles = [];
    w.hazards = [];
    this.finished = false;
    this.player.x = w.region === 0 ? 3560 : 3660;
    this.player.y = 446;
    this.player.vx = 0;
    this.player.vy = 0;
    for (const key of [
      "jumps",
      "wall",
      "wallKick",
      "absorb",
      "wallCoyote",
      "dash",
      "dashCooldown",
      "attack",
      "attackCooldown",
      "jumpBuffer",
      "coyote",
    ])
      this.player[key] = 0;
    this.player.animation = createHeroAnimation();
    this.clearInput();
    this.player.health = this.maxHealth();
    this.player.invulnerable = 2;
    this.camera = clamp(3260, 0, w.width - this.renderer.viewWidth);
    this.cameraY = 0;
    this.cb.toast(
      "Повторный бой. Найденные жетоны и открытые земли сохранены.",
    );
  }
  damage(fall = false) {
    const p = this.player;
    if (!fall && p.invulnerable > 0) return;
    if (
      !fall &&
      this.world.boss.active &&
      hasService(this.progress, "mercenary") &&
      !this.world.boss.shieldUsed
    ) {
      this.world.boss.shieldUsed = true;
      p.invulnerable = 2;
      this.cb.toast("Щит Грука принял удар!");
      return;
    }
    p.health--;

    this.cb.sound("hit");
    this.emit(p.x + 15, p.y + 20, "#f1c292", 10);
    p.invulnerable = this.progress.mode === "gentle" ? 2.2 : 1.4;
    if (p.health <= 0 || fall) {
      if (p.health <= 0) {
        p.health = this.maxHealth();
        this.cb.toast("Герои пробуют снова. Все жетоны с тобой.");
      } else this.cb.toast("Возвращаемся к последнему тёплому огоньку.");
      p.x = this.checkpointUsed ? this.world.checkpoint.x : this.world.spawn.x;
      p.y = this.checkpointUsed
        ? this.world.checkpoint.y - 54
        : this.world.spawn.y;
      p.vx = 0;
      p.vy = 0;
      p.jumps = 0;
      p.wall = 0;
      p.wallKick = 0;
      p.wallCoyote = 0;
      this.camera = Math.max(0, p.x - 300);
      this.world.projectiles = [];
      this.world.hazards = [];
      if (!this.world.boss.dead) resetMother(this.world.boss);
      this.cameraY = this.world.expanded
        ? clamp(p.y - 330, 0, Math.max(0, this.world.height - 620))
        : 0;
      this.world.boss.active = false;
      this.world.boss.phase = 0;
      this.world.boss.timer = 2.1;
    } else {
      p.vy = -220;
      const x = clamp(p.x - p.dir * 30, 0, WORLD_WIDTH - p.w);
      if (
        !this.world.platforms.some(
          (s) => (s.solid || s.ground) && overlaps({ ...p, x }, s),
        )
      )
        p.x = x;
    }
  }
  persist() {
    if (this.world.town) {
      this.cb.save(this.progress);
      return;
    }
    this.progress.revealed[this.world.region] = this.world.tokens
      .filter((t) => t.revealed)
      .map((t) => t.id);
    this.progress.secrets[this.world.region] = this.world.secrets
      .filter((s) => s.found)
      .map((s) => s.id);
    this.progress.discovered[this.world.region] = [...this.world.discovered];
    this.progress.region = this.world.region;
    this.progress.tokens[this.world.region] = this.world.tokens
      .filter((t) => t.collected)
      .map((t) => t.id);
    this.progress.checkpoint = this.checkpointUsed;
    this.cb.save(this.progress);
  }
  updateHud() {
    const p = this.player,
      w = this.world;
    const key = [
      p.health,
      w.tokens.filter((t) => t.collected).length,
      w.boss.hp,
      w.boss.active,
      w.boss.dead,
      growth(this.progress).level,
      w.town,
    ].join();
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.cb.hud({
      town: w.town,
      level: growth(this.progress).level,
      health: p.health,
      maxHealth: this.maxHealth(),
      tokens: w.tokens,
      boss: w.boss,
      region: w.region,
    });
  }
  snapshot() {
    return {
      town: this.world?.town,
      progression: growth(this.progress),
      secrets: this.world?.secrets,
      running: this.running,
      paused: this.paused,
      region: this.world?.region,
      player: this.player
        ? { ...this.player, animation: { ...this.player.animation } }
        : null,
      tokens: this.world?.tokens.map((t) => ({ ...t })),
      boss: this.world ? { ...this.world.boss } : null,
      enemies: this.world?.enemies.map((e) => ({ ...e })),
      platforms: this.world?.platforms.map((e) => ({ ...e })),
      camera: this.camera,
      cameraY: this.cameraY,
      room: this.world?.roomId,
      hazards: this.world?.hazards.map((a) => ({ ...a })),
    };
  }
}
