import { SERVICES } from "./progression.js";
import { buildLevel } from "./levels.js";
import { CREATURES, REGION_CREATURES, BOSSES } from "./creatures.js";
export const REGIONS = [
  {
    name: "Дремучий грибной лес",
    subtitle: "Здесь начинается приключение",
    boss: "Споровая мать",
    color: "#67dbc2",
    glow: "#9e72fc",
    sky: "#092733",
    chapter: "I",
  },
  {
    name: "Топи",
    subtitle: "Следуй за огоньками",
    boss: "Трясинный страж",
    color: "#b4ce72",
    glow: "#b3cd53",
    sky: "#18291f",
    chapter: "II",
  },
  {
    name: "Гора Гроз",
    subtitle: "Смелость выше облаков",
    boss: "Грозовой зверь",
    color: "#9ac9fa",
    glow: "#79b5ff",
    sky: "#15243c",
    chapter: "III",
  },
  {
    name: "Колокольня Пустоши",
    subtitle: "Искра в тишине",
    boss: "Звонарь Пустоши",
    color: "#e5b47a",
    glow: "#f59b60",
    sky: "#32201b",
    chapter: "IV",
  },
  {
    name: "Забытые глубины",
    subtitle: "Освети путь в глубинах",
    boss: "Теневой хранитель",
    color: "#75c4ed",
    glow: "#53aaff",
    sky: "#081e33",
    chapter: "V",
  },
  {
    name: "Аметистовое озеро",
    subtitle: "Каждый путь оставляет свет",
    boss: "Владычица озера",
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
  const level = buildLevel(region);
  const platforms = level.platforms.filter(
    (s) => !(progress.broken?.[region] || []).includes(s.id),
  );
  const found = progress.tokens?.[region] || [];
  const tokens = [...level.tokens, { x: 4195, y: 445, boss: true }].map(
    (t, id) => ({
      ...t,
      id,
      type: id,
      revealed:
        found.includes(id) || (progress.revealed?.[region] || []).includes(id),
      collected: found.includes(id),
    }),
  );
  const roster = REGION_CREATURES[region];
  const enemies = [];
  for (const platform of platforms) {
    if (
      platform.wall ||
      platform.ceiling ||
      platform.x > 3500 ||
      (region === 0 && platform.x >= 3430) ||
      platform.w < 140
    )
      continue;
    const positions = platform.ground
      ? Array.from(
          { length: Math.max(1, Math.floor(platform.w / 330)) },
          (_, i) => platform.x + 90 + i * 290,
        )
      : [platform.x + 35];
    for (const x of positions) {
      if (
        x < 540 ||
        Math.abs(x - 2240) < 160 ||
        platforms.some((s) => s.wall && x + 100 > s.x && x < s.x + s.w + 40)
      )
        continue;
      const id = enemies.length,
        key = roster[id % roster.length],
        info = CREATURES[key];
      enemies.push({
        key,
        behavior: info.behavior,
        x,
        y: platform.y - 40,
        baseY: platform.y - 40,
        w: 38,
        h: 40,
        min: Math.max(platform.x + 8, x - 60),
        max: Math.min(platform.x + platform.w - 46, x + 130),
        hp: key === "armored-corvid" ? 4 : 2 + Math.floor(region / 3),
        dir: id % 2 ? -1 : 1,
        hit: 0,
        id,
        state: "idle",
        timer: 1 + (id % 3) * 0.5,
        deathTime: 0,
      });
    }
  }
  const cleared = progress.cleared?.includes(region) || false;
  return {
    region,
    width: level.width || WORLD_WIDTH,
    height: level.height || 690,
    rooms: level.rooms,
    signs: level.signs || [],
    spawn: level.spawn || { x: 110, y: 410 },
    discovered: new Set(progress.discovered?.[region] || []),
    expanded: true,
    artKey: level.artKey,
    secrets: level.secrets.map((s) => ({
      ...s,
      found: (progress.secrets?.[region] || []).includes(s.id),
    })),
    veils: level.veils,
    portals: level.portals,
    springs: level.springs,
    water: level.water || [],
    wind: level.wind || [],
    hazards: [],
    shaft: level.shaft,
    title: level.title,
    platforms,
    tokens,
    enemies: enemies.filter((e) => e.x < 3430),
    checkpoint: level.checkpoint || { x: 2240, y: 450 },
    elder: { x: 240, y: level.spawn.y },
    boss: {
      key: BOSSES[region],
      dir: -1,
      deathTime: progress.defeated?.includes(region) || cleared ? 2 : 0,
      x: 4020,
      y: 380,
      w: 125,
      h: 120,
      hp: region === 0 ? 24 : 12 + region * 2,
      maxHp: region === 0 ? 24 : 12 + region * 2,
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
export function movePlayer(p, platforms, dt, width = WORLD_WIDTH) {
  const oldX = p.x,
    oldY = p.y;
  p.x = clamp(p.x + p.vx * dt, 0, width - p.w);
  p.wall = 0;
  for (const s of platforms) {
    if (!(s.solid || s.ground) || !overlaps(p, s)) continue;
    if (oldX + p.w <= s.x + 1) {
      p.x = s.x - p.w;
      p.vx = 0;
      if (s.wall) p.wall = 1;
    } else if (oldX >= s.x + s.w - 1) {
      p.x = s.x + s.w;
      p.vx = 0;
      if (s.wall) p.wall = -1;
    }
  }
  // Maintain contact when the player releases the direction on a wall.
  for (const s of platforms) {
    if (!s.wall || p.y + p.h <= s.y || p.y >= s.y + s.h) continue;
    if (Math.abs(p.x + p.w - s.x) < 1) p.wall = 1;
    if (Math.abs(p.x - s.x - s.w) < 1) p.wall = -1;
  }
  p.vy = Math.min(
    p.wall && p.vy > 0 ? 105 : PHYSICS.maxFall,
    p.vy + PHYSICS.gravity * dt,
  );
  p.y += p.vy * dt;
  p.grounded = false;
  for (const s of platforms) {
    if (p.x + p.w <= s.x + 1 || p.x >= s.x + s.w - 1) continue;
    if (p.vy >= 0 && oldY + p.h <= s.y + 4 && p.y + p.h >= s.y) {
      p.y = s.y - p.h;
      p.vy = 0;
      p.grounded = true;
      p.jumps = 0;
    } else if (
      s.solid &&
      p.vy < 0 &&
      oldY >= s.y + s.h - 1 &&
      p.y < s.y + s.h &&
      p.y + p.h > s.y
    ) {
      p.y = s.y + s.h;
      p.vy = 0;
    }
  }
  if (p.grounded) p.wall = 0;
  if (p.wall) {
    p.wallCoyote = 0.12;
    p.lastWall = p.wall;
  }
}
const cleanIds = (v, max) =>
  [
    ...new Set(
      (Array.isArray(v) ? v : []).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < max,
      ),
    ),
  ].sort((a, b) => a - b);
const cleanWords = (v, allowed) => [
  ...new Set((Array.isArray(v) ? v : []).filter((n) => allowed.includes(n))),
];
const cleanRegions = (v, max) =>
  Object.fromEntries(REGIONS.map((_, i) => [i, cleanIds(v?.[i], max)]));
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
    version: 2,
    secrets: cleanRegions(value.secrets, 5),
    revealed: cleanRegions(value.revealed, 5),
    broken: cleanRegions(value.broken, 80),
    discovered: Object.fromEntries(
      REGIONS.map((_, i) => [
        i,
        [
          ...new Set(
            (Array.isArray(value.discovered?.[i])
              ? value.discovered[i]
              : []
            ).filter((id) => buildLevel(i).rooms.some((r) => r.id === id)),
          ),
        ],
      ]),
    ),
    services: cleanWords(value.services, SERVICES),
    quests: cleanWords(value.quests, ["dar", "child", "stranger", "sola"]),
    visited: cleanIds(value.visited, 6),
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
    ...Object.fromEntries(
      ["secrets", "revealed", "broken", "discovered"].map((key) => [
        key,
        Object.fromEntries(
          REGIONS.map((_, i) => [
            i,
            [...new Set([...a[key][i], ...b[key][i]])],
          ]),
        ),
      ]),
    ),
    ...Object.fromEntries(
      ["services", "quests", "visited"].map((key) => [
        key,
        [...new Set([...a[key], ...b[key]])],
      ]),
    ),
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
