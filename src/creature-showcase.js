import { drawCreature } from "./creatures.js";
export class CreatureShowcase {
  constructor(canvases, assets, keys) {
    this.canvases = canvases;
    this.assets = assets;
    this.keys = keys;
    this.mode = "idle";
    this.frame = requestAnimationFrame((t) => this.draw(t));
  }
  draw(t) {
    this.canvases.forEach((canvas, i) => {
      const ctx = canvas.getContext("2d");
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 200, 180);
      const phase = (t / 1000) % 2;
      const e = {
        x: 0,
        y: 0,
        w: 38,
        h: 40,
        dir: 1,
        hp: 2,
        state: this.mode,
        id: 0,
        timer: 1,
        behavior: this.keys[i] === "masked-corvid" ? "bird" : "walker",
      };
      if (this.mode === "attack") {
        e.state = phase < 1 ? "windup" : "attack";
        e.timer = phase < 1 ? 1 - phase : (2 - phase) * 0.4;
      }
      if (this.mode === "hit") e.hit = phase < 1 ? 0.18 : 0.08;
      if (this.mode === "defeat") {
        e.hp = 0;
        e.deathTime = phase < 0.4 ? 0.1 : 0.4;
      }
      drawCreature(ctx, this.assets, this.keys[i], e, t / 1000, {
        x: 100,
        y: 165,
        size: i === 3 ? 165 : 140,
        alpha: 1,
      });
    });
    this.frame = requestAnimationFrame((t) => this.draw(t));
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }
}
