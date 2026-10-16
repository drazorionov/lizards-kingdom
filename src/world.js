export const REGIONS = [
  {
    name: "Mushroom Forest",
    subtitle: "Where the adventure begins",
    boss: "The Spore Mother",
    color: "#67dbc2",
    glow: "#9e72fc",
    sky: "#092733",
    chapter: "I",
  },
  {
    name: "Whispering Mire",
    subtitle: "Follow the lanterns",
    boss: "The Mire Guardian",
    color: "#b4ce72",
    glow: "#b3cd53",
    sky: "#18291f",
    chapter: "II",
  },
  {
    name: "Stormpeak",
    subtitle: "Courage above the clouds",
    boss: "The Storm Beast",
    color: "#9ac9fa",
    glow: "#79b5ff",
    sky: "#15243c",
    chapter: "III",
  },
  {
    name: "The Ashen Belfry",
    subtitle: "A spark in the silence",
    boss: "The Bell Keeper",
    color: "#e5b47a",
    glow: "#f59b60",
    sky: "#32201b",
    chapter: "IV",
  },
  {
    name: "Forgotten Depths",
    subtitle: "Light the way below",
    boss: "The Shadow Warden",
    color: "#75c4ed",
    glow: "#53aaff",
    sky: "#081e33",
    chapter: "V",
  },
  {
    name: "Amethyst Lake",
    subtitle: "Every journey leaves a light",
    boss: "The Lady of the Lake",
    color: "#cba7f1",
    glow: "#be73fa",
    sky: "#211737",
    chapter: "VI",
  },
];
export const WORLD_WIDTH = 4550;
export const PHYSICS = {
  speed: 270,
  gravity: 1500,
  jump: -550,
  doubleJump: -490,
  maxFall: 830,
  dashSpeed: 760,
};
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function createWorld(region = 0, progress = {}) {
  // Every gap is shorter than one jump; alternate upper routes reward double jumping.
  const platforms = [
    [0, 500, 650, 130],
    [750, 500, 540, 130],
    [1410, 500, 490, 130],
    [2040, 500, 620, 130],
    [2790, 500, 560, 130],
    [3470, 500, 1080, 130],
    [400, 390, 175, 24],
    [680, 320, 160, 24],
    [920, 260, 200, 24],
    [1210, 360, 140, 24],
    [1530, 370, 160, 24],
    [1780, 295, 180, 24],
    [2010, 230, 200, 24],
    [2300, 350, 180, 24],
    [2540, 270, 170, 24],
    [2810, 350, 190, 24],
    [3090, 285, 170, 24],
    [3320, 390, 170, 24],
  ].map(([x, y, w, h], i) => ({ x, y, w, h, id: i, ground: h > 24 }));
  const found = progress.tokens?.[region] || [];
  const tokens = [
    { x: 500, y: 350 },
    { x: 1020, y: 220 },
    { x: 1855, y: 255 },
    { x: 2605, y: 230 },
    { x: 4195, y: 445, boss: true },
  ].map((t, id) => ({ ...t, id, collected: found.includes(id) }));
  const enemies = [
    { x: 890, y: 460, min: 770, max: 1200 },
    { x: 1640, y: 460, min: 1430, max: 1810 },
    { x: 2240, y: 460, min: 2080, max: 2550 },
    { x: 2900, y: 460, min: 2820, max: 3260 },
    { x: 3090, y: 245, min: 3090, max: 3210 },
  ].map((e, id) => ({
    ...e,
    w: 38,
    h: 40,
    hp: 2 + Math.floor(region / 3),
    dir: id % 2 ? -1 : 1,
    hit: 0,
    cooldown: 0,
    id,
  }));
  const cleared = progress.cleared?.includes(region) || false;
  return {
    region,
    platforms,
    tokens,
    enemies,
    checkpoint: { x: 2240, y: 450 },
    elder: { x: 240, y: 446 },
    boss: {
      x: 4020,
      y: 380,
      w: 125,
      h: 120,
      hp: 12 + region * 2,
      maxHp: 12 + region * 2,
      phase: 0,
      timer: 2.4,
      hit: 0,
      active: false,
      dead: progress.defeated?.includes(region) || cleared,
      attackId: 0,
    },
    projectiles: [],
    cleared,
  };
}
export function movePlayer(p, platforms, dt) {
  p.x += p.vx * dt;
  p.x = clamp(p.x, 0, WORLD_WIDTH - p.w);
  // Elevated platforms are one-way, so jumps never catch on their undersides.
  for (const s of platforms) {
    if (!s.ground || !overlaps(p, s)) continue;
    if (p.y + p.h > s.y + 12 && p.y < s.y + s.h) {
      p.x = p.vx > 0 ? s.x - p.w : s.x + s.w;
      p.vx = 0;
    }
  }
  const oldBottom = p.y + p.h;
  p.vy = Math.min(PHYSICS.maxFall, p.vy + PHYSICS.gravity * dt);
  p.y += p.vy * dt;
  p.grounded = false;
  if (p.vy >= 0) {
    for (const s of platforms) {
      if (
        p.x + p.w > s.x + 2 &&
        p.x < s.x + s.w - 2 &&
        oldBottom <= s.y + 5 &&
        p.y + p.h >= s.y
      ) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        break;
      }
    }
  }
}
export function sanitizeProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const tokens = {};
  for (let i = 0; i < 6; i++) {
    tokens[i] = [
      ...new Set(
        (Array.isArray(value.tokens?.[i]) ? value.tokens[i] : []).filter(
          (v) => Number.isInteger(v) && v >= 0 && v < 5,
        ),
      ),
    ].sort();
  }
  const defeated = [
    ...new Set(
      (Array.isArray(value.defeated) ? value.defeated : []).filter(
        (v) => Number.isInteger(v) && v >= 0 && v < 6,
      ),
    ),
  ].sort();
  const cleared = [
    ...new Set(
      (Array.isArray(value.cleared) ? value.cleared : []).filter(
        (v) => Number.isInteger(v) && v >= 0 && v < 6,
      ),
    ),
  ].sort();
  return {
    version: 1,
    hero: value.hero === 1 ? 1 : 0,
    region: clamp(Number.isInteger(value.region) ? value.region : 0, 0, 5),
    tokens,
    cleared,
    defeated,
    checkpoint: value.checkpoint === true,
    mode: value.mode === "adventure" ? "adventure" : "gentle",
    updatedAt: Number.isFinite(value.updatedAt)
      ? Math.max(0, Math.min(value.updatedAt, Date.now() + 60000))
      : 0,
  };
}
export function mergeProgress(local, remote) {
  if (!remote) return sanitizeProgress(local);
  if (!local) return sanitizeProgress(remote);
  const a = sanitizeProgress(local),
    b = sanitizeProgress(remote);
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  return {
    ...newer,
    tokens: Object.fromEntries(
      REGIONS.map((_, i) => [
        i,
        [...new Set([...a.tokens[i], ...b.tokens[i]])].sort(),
      ]),
    ),
    cleared: [...new Set([...a.cleared, ...b.cleared])].sort(),
    defeated: [...new Set([...a.defeated, ...b.defeated])].sort(),
  };
}
