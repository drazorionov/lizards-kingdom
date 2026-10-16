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
    this.world = createWorld(region, progress);
    this.region = REGIONS[region];
    this.checkpointUsed = progress.region === region && progress.checkpoint;
    this.player = {
      animation: createHeroAnimation(),
      x: this.checkpointUsed ? 2220 : 110,
      y: 410,
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
    this.camera = Math.max(0, this.player.x - 300);
    this.running = true;
    this.paused = false;
    this.finished = false;
    this.gateHint = false;
    this.lastHud = "";
    this.clearInput();
    this.renderer.prepare(region);
    this.previous = 0;
    this.accumulator = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    this.cb.toast(
      this.checkpointUsed
        ? "Welcome back, little wanderer."
        : `${this.region.name} · Your next adventure begins.`,
    );
    this.updateHud();
  }
  maxHealth() {
    return (
      (this.progress?.mode === "adventure" ? 5 : 7) +
      Math.min(2, Math.floor((this.progress?.cleared.length || 0) / 2))
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
    for (const key of [
      "invulnerable",
      "attack",
      "attackCooldown",
      "dash",
      "dashCooldown",
      "coyote",
      "jumpBuffer",
    ])
      p[key] = Math.max(0, p[key] - dt);
    if (p.grounded) p.coyote = 0.12;
    if (this.pressed.has("jump")) p.jumpBuffer = 0.14;
    if (p.jumpBuffer > 0 && (p.coyote > 0 || p.jumps < 2)) {
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
      p.dash = 0.18;
      p.dashCooldown = 0.8;
      p.invulnerable = Math.max(p.invulnerable, 0.22);
      this.emit(p.x, p.y + 25, this.region.color, 8);
    }
    let direction =
      (this.keys.has("right") ? 1 : 0) - (this.keys.has("left") ? 1 : 0);
    if (direction) p.dir = direction;
    if (p.dash > 0) {
      p.vx = p.dir * PHYSICS.dashSpeed;
      p.vy = -15;
    } else p.vx = direction * PHYSICS.speed;
    if (this.keys.has("attack") && p.attackCooldown === 0) {
      p.attack = 0.21;
      p.attackCooldown = 0.32;
      this.attackSerial++;
      this.cb.sound("attack");
      if (Math.abs(p.x - w.elder.x) < 100)
        this.cb.toast(
          "Elder: Five firefly tokens awaken each land. The last is guarded. You can jump twice!",
        );
    }
    movePlayer(p, w.platforms, dt);
    if (p.y > 690) this.damage(true);
    const attack = {
      x: p.dir > 0 ? p.x + 10 : p.x - 86,
      y: p.y - 10,
      w: 108,
      h: 80,
    };
    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      e.hit = Math.max(0, e.hit - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.x += e.dir * (38 + w.region * 5) * dt;
      if (e.x < e.min) {
        e.x = e.min;
        e.dir = 1;
      }
      if (e.x > e.max) {
        e.x = e.max;
        e.dir = -1;
      }
      if (
        p.attack > 0 &&
        overlaps(attack, e) &&
        e.lastAttack !== this.attackSerial
      ) {
        e.lastAttack = this.attackSerial;
        e.hp -= 1 + Math.floor(this.progress.cleared.length / 2);
        e.hit = 0.18;
        this.emit(e.x + 20, e.y + 20, this.region.glow);
        if (e.hp <= 0) this.cb.sound("token");
      }
      if (e.hp > 0 && overlaps(p, e) && p.dash === 0) this.damage();
    }
    for (const token of w.tokens) {
      if (token.collected || (token.boss && !w.boss.dead)) continue;
      if (Math.hypot(p.x + 15 - token.x, p.y + 27 - token.y) < 44) {
        token.collected = true;
        this.emit(token.x, token.y, "#f8d78d", 20);
        this.cb.sound("token");
        this.persist();
        const count = w.tokens.filter((t) => t.collected).length;
        this.cb.toast(
          count === 5
            ? "All five tokens found! The gate is open."
            : `Firefly token found · ${count} / 5`,
        );
        if (count === 5) p.health = this.maxHealth();
      }
    }
    if (
      !this.checkpointUsed &&
      Math.abs(p.x - w.checkpoint.x) < 70 &&
      p.y > 390
    ) {
      this.checkpointUsed = true;
      p.health = this.maxHealth();
      this.emit(p.x, p.y, this.region.color, 20);
      this.cb.sound("checkpoint");
      this.cb.toast("A warm light. Health restored. Journey saved.");
      this.persist();
    }
    this.stepBoss(dt, attack);
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
        "The gate needs five tokens. You can return along the path.",
      );
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const a = this.particles[i];
      a.life -= dt;
      if (a.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy += 210 * dt;
    }
    const view = this.renderer.viewWidth;
    const target = clamp(p.x - view * 0.36, 0, WORLD_WIDTH - view);
    this.camera += (target - this.camera) * Math.min(1, dt * 6);
    updateHeroAnimation(p, dt);
    this.pressed.clear();
    this.updateHud();
  }
  stepBoss(dt, attack) {
    const b = this.world.boss,
      p = this.player,
      w = this.world;
    if (b.dead) return;
    if (p.x > 3600 && !b.active) {
      b.active = true;
      b.timer = 2.1;
      this.cb.toast(`${this.region.boss} · Jump over the glowing waves!`);
    }
    if (!b.active) return;
    b.hit = Math.max(0, b.hit - dt);
    b.timer -= dt;
    if (
      p.attack > 0 &&
      overlaps(attack, b) &&
      b.lastAttack !== this.attackSerial
    ) {
      b.lastAttack = this.attackSerial;
      b.hp -= 1 + Math.floor(this.progress.cleared.length / 2);
      b.hit = 0.17;
      this.emit(b.x + 50, b.y + 50, "#edd296", 15);
      if (b.hp <= 0) {
        b.dead = true;
        b.active = false;
        w.projectiles = [];
        this.emit(b.x + 60, b.y + 50, this.region.glow, 40);
        this.cb.sound("win");
        this.cb.toast("Guardian calmed! Your final firefly token is waiting.");
        this.progress.defeated = [
          ...new Set([...this.progress.defeated, w.region]),
        ];
        this.persist();
        return;
      }
    }
    if (overlaps(p, b)) this.damage();
    // A long, visible wind-up before every shockwave. Gentle mode sends one wave.
    if (b.timer <= 0) {
      b.phase = (b.phase + 1) % 3;
      if (b.phase === 0) {
        b.timer = this.progress.mode === "gentle" ? 2.1 : 1.4;
      } else if (b.phase === 1) {
        b.timer = 1.0;
        this.emit(b.x + 60, b.y + 100, "#f6c989", 8);
      } else {
        b.timer = 0.4;
        b.attackId++;
        w.projectiles.push({
          x: b.x,
          y: 476,
          w: 32,
          h: 24,
          vx: -230 - w.region * 12,
          life: 5,
        });
        if (this.progress.mode === "adventure" && b.attackId % 2 === 0)
          w.projectiles.push({
            x: b.x + 30,
            y: 395,
            w: 23,
            h: 23,
            vx: -180,
            life: 5,
          });
        this.emit(b.x + 50, 492, this.region.glow, 15);
      }
    }
    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const a = w.projectiles[i];
      a.x += a.vx * dt;
      a.life -= dt;
      if (overlaps(p, a)) {
        this.damage();
        a.life = 0;
      }
      if (a.life <= 0) w.projectiles.splice(i, 1);
    }
  }
  damage(fall = false) {
    const p = this.player;
    if (!fall && p.invulnerable > 0) return;
    p.health--;
    this.cb.sound("hit");
    this.emit(p.x + 15, p.y + 20, "#f1c292", 10);
    p.invulnerable = this.progress.mode === "gentle" ? 2.2 : 1.4;
    if (p.health <= 0 || fall) {
      if (p.health <= 0) {
        p.health = this.maxHealth();
        this.cb.toast("Every hero tries again. Your tokens are safe.");
      } else this.cb.toast("A soft landing at your last warm light.");
      p.x = this.checkpointUsed ? 2240 : 110;
      p.y = 400;
      p.vx = 0;
      p.vy = 0;
      p.jumps = 0;
      this.camera = Math.max(0, p.x - 300);
      this.world.projectiles = [];
      this.world.boss.active = false;
      this.world.boss.phase = 0;
      this.world.boss.timer = 2.1;
    } else {
      p.vy = -220;
      p.x = clamp(p.x - p.dir * 30, 0, WORLD_WIDTH - p.w);
    }
  }
  persist() {
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
    ].join();
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.cb.hud({
      health: p.health,
      maxHealth: this.maxHealth(),
      tokens: w.tokens,
      boss: w.boss,
      region: w.region,
    });
  }
  snapshot() {
    return {
      running: this.running,
      paused: this.paused,
      region: this.world?.region,
      player: this.player
        ? { ...this.player, animation: { ...this.player.animation } }
        : null,
      tokens: this.world?.tokens.map((t) => ({ ...t })),
      boss: this.world ? { ...this.world.boss } : null,
      camera: this.camera,
    };
  }
}
