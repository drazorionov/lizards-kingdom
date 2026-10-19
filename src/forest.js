import { carveCaverns } from "./caverns.js";
// Forest pilot: the source board's upper route, root underpass, wall shaft,
// secret chamber and guarded exit, authored in one continuous coordinate space.
export const FOREST_ROOMS = [
  {
    id: "fields",
    name: "Споровые поля",
    x: 0,
    y: 0,
    w: 950,
    h: 700,
    art: "canopy",
  },
  {
    id: "roots",
    name: "Светящиеся корни",
    x: 750,
    y: 0,
    w: 800,
    h: 1120,
    art: "roots",
  },
  {
    id: "undercroft",
    name: "Подземный ручей",
    x: 750,
    y: 1120,
    w: 1850,
    h: 480,
    art: "roots",
  },
  {
    id: "shaft",
    name: "Колодец корней",
    x: 1550,
    y: 300,
    w: 600,
    h: 820,
    art: "roots",
  },
  {
    id: "hearth",
    name: "Тёплый камень",
    x: 2150,
    y: 580,
    w: 450,
    h: 540,
    art: "roots",
  },
  {
    id: "secret",
    name: "Тайная грибница",
    x: 2150,
    y: 0,
    w: 760,
    h: 580,
    art: "canopy",
  },
  {
    id: "canopy",
    name: "Грибная чаща",
    x: 2600,
    y: 300,
    w: 830,
    h: 1300,
    art: "canopy",
  },
  {
    id: "sanctum",
    name: "Забытое дерево",
    x: 3430,
    y: 0,
    w: 1120,
    h: 1600,
    art: "sanctum",
  },
];
// Open space, following the reference's looping forest topology. These are
// connected passages carved out of earth, not decorative room bounding boxes.
export const FOREST_PASSAGES = [
  // Spore fields: a sheltered arrival chamber with a rising mushroom alcove.
  [40, 180, 720, 320],
  [100, 140, 510, 360],
  [410, 180, 450, 205],
  // Upper loop: bends east, drops through the roots, then reaches the shaft.
  [790, 160, 390, 220],
  [1100, 220, 300, 200],
  [1320, 300, 300, 200],
  [1530, 300, 300, 230],
  // Lower entrance: broad descending chamber and narrow root corridor.
  [760, 340, 380, 710],
  [950, 840, 420, 210],
  [1320, 850, 1060, 200],
  [1250, 1000, 250, 450],
  // Root well: continuous cliff faces, the main vertical connection.
  [1778, 300, 132, 750],
  [1740, 240, 470, 190],
  [1958, 280, 410, 170],
  [2200, 220, 218, 160],
  // Sealed mycelium room. Its only entrance is the destructible wall.
  [2380, 170, 470, 210],
  // Stream loop and its breakable return passage to the warm-stone refuge.
  [750, 1140, 1850, 310],
  [950, 1100, 550, 350],
  [2150, 750, 450, 300],
  [2380, 990, 220, 460],
  // Mushroom thicket: a winding ascent with broad landings cut from rock.
  [2380, 730, 400, 260],
  [2580, 580, 390, 280],
  [2770, 450, 410, 280],
  [2960, 320, 420, 280],
  [3200, 280, 340, 220],
  // The Forgotten Tree is an enclosed arena, reached through the upper neck.
  [3430, 130, 1080, 370],
  [3570, 80, 770, 420],
].map(([x, y, w, h], id) => ({ id, x, y, w, h }));

export function forestRoom(p) {
  return (
    FOREST_ROOMS.find(
      (r) =>
        p.x + p.w / 2 >= r.x &&
        p.x + p.w / 2 < r.x + r.w &&
        p.y + p.h / 2 >= r.y &&
        p.y + p.h / 2 < r.y + r.h,
    ) || FOREST_ROOMS[0]
  );
}
export function buildForest() {
  const platforms = [];
  const solid = (x, y, w, h, extra = {}) =>
    platforms.push({ x, y, w, h, solid: true, ground: true, ...extra });
  const ledge = (x, y, w) =>
    platforms.push({ x, y, w, h: 22, solid: false, ground: false });
  // The first descent is reversible; lower passages loop back through the hub.
  solid(0, 500, 760, 120);
  ledge(430, 385, 180);
  ledge(670, 300, 170);
  ledge(780, 640, 170);
  ledge(920, 790, 170);
  ledge(790, 920, 160);
  solid(950, 1050, 300, 90);
  solid(1500, 1050, 880, 90);
  solid(750, 1450, 1850, 150);
  ledge(1000, 1320, 160);
  ledge(1190, 1190, 160);
  ledge(1380, 1320, 150);
  // Return ladder between the stream and the save point.
  ledge(2410, 1320, 170);
  ledge(2240, 1190, 160);
  // Alternating wall kicks reach the third token; low left entrance stays open.
  solid(1730, 380, 48, 530, { wall: true, ground: false });
  solid(1910, 450, 48, 600, { wall: true, ground: false });
  ledge(1780, 430, 70);
  ledge(1980, 430, 160);
  ledge(2210, 380, 150);
  // A cracked root wall protects the secret. Its floor/roof are fully solid.
  solid(2380, 170, 38, 210, {
    wall: true,
    ground: false,
    breakable: true,
    hp: 1,
    secret: true,
  });
  solid(2418, 380, 432, 60);
  solid(2850, 100, 55, 500, { wall: true, ground: false });
  solid(2350, 100, 555, 70, { ceiling: true, ground: false });
  // Ascent from the hearth to the canopy and the Forgotten Tree.
  ledge(2410, 920, 180);
  ledge(2600, 790, 180);
  ledge(2790, 660, 180);
  ledge(2980, 530, 190);
  ledge(3230, 500, 220);
  solid(3430, 500, 1120, 180);
  // Tunnel roofs have collision; the art and the navigable space agree.
  solid(0, 35, 640, 85, { ceiling: true, ground: false });
  solid(1020, 800, 230, 70, { ceiling: true, ground: false });
  solid(1510, 1120, 70, 330, {
    wall: true,
    ground: false,
    breakable: true,
    hp: 1,
    shortcut: true,
  });
  solid(2620, 1110, 250, 490, { wall: true, ground: false });
  // Boundary roots prevent falling out of the stream chamber sideways.
  solid(710, 1070, 40, 530, { wall: true, ground: false });
  // Existing landmark IDs stay stable so discoveries and broken seals survive.
  platforms.push(...carveCaverns(4550, 1600, FOREST_PASSAGES));
  platforms.forEach((s, id) => (s.id = id));
  return {
    platforms,
    caverns: FOREST_PASSAGES,
    width: 4550,
    height: 1600,
    rooms: FOREST_ROOMS,
    tokens: [
      { x: 520, y: 455 },
      { x: 1420, y: 1395 },
      { x: 1840, y: 390 },
      { x: 2690, y: 325, secret: true },
    ],
    shaft: { x: 1845, y: 1020, top: 380 },
    title: "Споровые поля · Светящиеся корни · Забытое дерево",
    spawn: { x: 110, y: 446 },
    checkpoint: { x: 2240, y: 1000 },
    signs: [
      { x: 640, y: 430, text: "СВЕТЯЩИЕСЯ КОРНИ ↘" },
      { x: 1070, y: 1006, text: "↓ ПОДЗЕМНЫЙ РУЧЕЙ" },
      { x: 1680, y: 1006, text: "↑ КОЛОДЕЦ КОРНЕЙ" },
      { x: 2225, y: 335, text: "ТРЕЩИНЫ… ПРОБЕЛ" },
      { x: 2350, y: 1020, text: "ОБРАТНЫЙ ТОННЕЛЬ ↘" },
      { x: 2450, y: 880, text: "ГРИБНАЯ ЧАЩА ↗" },
      { x: 3290, y: 460, text: "ЗАБЫТОЕ ДЕРЕВО →" },
    ],
  };
}
