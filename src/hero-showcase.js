import {
  createHeroAnimation,
  updateHeroAnimation,
  drawHero,
} from "./hero-animation.js";
export class HeroShowcase {
  constructor(canvases, assets) {
    this.canvases = canvases;
    this.assets = assets;
    this.mode = "idle";
    this.players = [0, 1].map((hero) => ({
      hero,
      x: 0,
      y: 0,
      w: 31,
      h: 54,
      dir: 1,
      vx: 0,
      vy: 0,
      grounded: true,
      attack: 0,
      dash: 0,
      jumps: 0,
      animation: createHeroAnimation(),
    }));
    this.previous = 0;
    this.jumpWait = 0.6;
    this.frame = requestAnimationFrame((t) => this.draw(t));
  }
  setMode(mode) {
    this.mode = mode;
    this.jumpWait = 0.1;
    for (const p of this.players) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      p.jumps = 0;
      p.animation = createHeroAnimation();
    }
  }
  draw(time) {
    const dt = this.previous
      ? Math.min((time - this.previous) / 1000, 0.04)
      : 0;
    this.previous = time;
    this.jumpWait -= dt;
    for (let i = 0; i < 2; i++) {
      const p = this.players[i],
        canvas = this.canvases[i],
        ctx = canvas.getContext("2d");
      p.vx = this.mode === "walk" ? 210 : 0;
      p.attackDuration = 0.32;
      p.attack = this.mode === "attack" ? 0.32 - ((time / 1000) % 0.8) : 0;
      p.wall = this.mode === "wall" ? 1 : 0;
      if (this.mode === "wall") {
        p.grounded = false;
        p.vy = 105;
      }
      if (this.mode === "jump") {
        if (p.grounded && this.jumpWait <= 0) {
          p.vy = -370;
          p.grounded = false;
          p.jumps = 1;
        }
        if (!p.grounded) {
          p.vy += 1400 * dt;
          p.y += p.vy * dt;
          if (p.y >= 0) {
            p.y = 0;
            p.vy = 0;
            p.grounded = true;
            p.jumps = 0;
          }
        }
      }
      updateHeroAnimation(p, dt);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 240, 210);
      const glow = ctx.createRadialGradient(126, 120, 0, 126, 120, 108);
      glow.addColorStop(0, i === 0 ? "#b4872933" : "#9b283333");
      glow.addColorStop(1, "#0c182000");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 240, 210);
      ctx.fillStyle = "#0005";
      ctx.beginPath();
      ctx.ellipse(140, 194, 37, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHero(
        ctx,
        this.assets[`hero-${i === 0 ? "quirel" : "urmasa"}-painted-atlas`],
        p,
        { x: 120, y: 193 + p.y, size: 205 },
      );
    }
    if (
      this.mode === "jump" &&
      this.jumpWait <= 0 &&
      this.players.every((p) => p.grounded)
    )
      this.jumpWait = 0.85;
    this.frame = requestAnimationFrame((t) => this.draw(t));
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }
}
