export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        this.ctx ||= new Audio();
        this.ctx.resume();
        this.play("token");
      }
    }
    return this.enabled;
  }
  play(type) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = {
      jump: [280, 420],
      attack: [150, 80],
      token: [660, 880, 1100],
      hit: [100, 65],
      checkpoint: [330, 440, 660],
      win: [392, 494, 587, 784],
    };
    (notes[type] || [440]).forEach((frequency, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = type === "attack" ? "triangle" : "sine";
      o.frequency.setValueAtTime(frequency, now + i * 0.09);
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.045, now + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.25);
    });
  }
}
