import { carveCaverns, sculptIsland } from "./caverns.js";

const DUNGEON_NAMES = {
  1: [
    "Тропа огоньков",
    "Утонувшие корни",
    "Затопленные руины",
    "Каменный затвор",
    "Сады трясины",
    "Забытый храм",
    "Болотный шпиль",
    "Гнилая заводь",
    "Галерея тростника",
    "Глубокий колодец",
    "Привал огоньков",
    "Склеп корней",
    "Утонувший двор",
    "Ступени храма",
    "Подводная пещера",
    "Нижние шлюзы",
    "Тёмный водоём",
    "Колодец памяти",
    "Обратный поток",
    "Тайная переправа",
    "Корни шпиля",
  ],
  4: [
    "Вход в Глубины",
    "Синие своды",
    "Капельные залы",
    "Забытая комната",
    "Мост древних",
    "Звёздный колодец",
    "Верхний затвор",
    "Теневой проход",
    "Зал эха",
    "Лаборатория древних",
    "Привал исследователя",
    "Сталактитовый ход",
    "Тихая обсерватория",
    "Ступени бездны",
    "Подводный тоннель",
    "Затонувший архив",
    "Пещера памяти",
    "Нижние лаборатории",
    "Колодец отражений",
    "Выход к озеру",
    "Сердце Глубин",
    "Провал тишины",
    "Усыпальница света",
    "Дальние лаборатории",
    "Потерянный механизм",
    "Хранилище звёзд",
    "Последний затвор",
  ],
  5: [
    "Кристальные гроты",
    "Острова отражений",
    "Фиолетовые арки",
    "Верхний родник",
    "Зеркальная галерея",
    "Кристальный колодец",
    "Берег аметиста",
    "Глубинные родники",
    "Тихие отражения",
    "Расколотая жеода",
    "Привал у озера",
    "Сияющие уступы",
    "Пещера за водопадом",
    "Серебряный берег",
    "Скрытый ручей",
    "Подземное озеро",
    "Зал преломлений",
    "Корни кристалла",
    "Нижняя заводь",
    "Возвратный родник",
    "Сердце аметиста",
    "Пурпурная галерея",
    "Тропа осколков",
    "Зал двойников",
    "Дальние отражения",
    "Поющий камень",
    "Грот переливов",
    "Спящий водопад",
    "Сад призм",
    "Чёрное зеркало",
    "Остров тишины",
    "Свет под водой",
    "Обратный берег",
  ],
};
// Every link is authored: loops reconnect at different heights, with optional
// branches and short broken-seal routes rather than a single horizontal lane.
const LINKS = {
  1: {
    horizontal: [
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
    ],
    vertical: [
      [0, 2, 4, 6],
      [1, 3, 5, 6],
    ],
    startRow: 0,
  },
  4: {
    horizontal: [
      [0, 1, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
    ],
    vertical: [
      [0, 2, 3, 5, 6],
      [0, 1, 3, 4, 6],
    ],
    startRow: 0,
  },
  5: {
    horizontal: [
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 4, 5],
      [0, 1, 2, 3, 4, 5],
    ],
    vertical: [
      [0, 1, 3, 4, 6],
      [0, 2, 3, 5, 6],
    ],
    startRow: 1,
  },
};
export const REGION_CAMP_IDS = [
  "entry",
  "crossroads",
  "deep",
  "upper",
  "approach",
];
const point = (x, floor) => ({ x, y: floor - 54 });

function dungeon(region) {
  const columns = region === 1 ? 7 : region === 4 ? 9 : 11;
  const width = 700 + columns * 1200,
    height = region === 1 ? 2500 : region === 4 ? 3000 : 3400;
  const floors = [550, Math.round(height * 0.54), height - 250],
    xs = Array.from({ length: columns }, (_, i) => 550 + i * 1200);
  const openings = [],
    platforms = [],
    rooms = [],
    links = [],
    nodes = [];
  const addAir = (x, y, w, h) => openings.push({ x, y, w, h });
  const ledge = (x, y, w = 150) =>
    platforms.push({ x, y, w, h: 20, solid: false, ground: false });
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < columns; col++) {
      const x = xs[col],
        floor = floors[row],
        id = row * columns + col;
      nodes.push({ id, x, floor, ...point(x, floor) });
      const chamberHeight = 350 + ((col * 3 + row + region) % 4) * 35;
      addAir(x - 410, floor - chamberHeight, 820, chamberHeight);
      rooms.push({
        id: `r${region}-${id}`,
        name:
          DUNGEON_NAMES[region][id] ||
          `${region === 4 ? "Дальний архив" : "Зеркальный грот"} ${id - 20}`,
        x: Math.max(0, x - 600),
        y: row === 0 ? 0 : Math.round((floors[row - 1] + floors[row]) / 2),
        w: col === columns - 1 ? 830 : 1200,
        h:
          (row === 2
            ? height
            : Math.round((floors[row] + floors[row + 1]) / 2)) -
          (row === 0 ? 0 : Math.round((floors[row - 1] + floors[row]) / 2)),
      });
      // Discrete encounter shelves make the tall chambers worth exploring.
      ledge(x - 260, floor - 130, 170);
      platforms.at(-1).encounter = (row + col) % 2 === 0;
      ledge(x + 30, floor - 250, 165);
    }
  const connect = (a, b, via) => links.push({ a, b, via });
  for (let row = 0; row < 3; row++)
    for (const col of [
      ...LINKS[region].horizontal[row],
      ...Array.from({ length: columns - 7 }, (_, i) => i + 6),
    ]) {
      const x = xs[col],
        nx = xs[col + 1],
        floor = floors[row];
      addAir(x + 300, floor - 215, nx - x - 600, 215);
      openings.at(-1).rolling = true;
      connect(row * columns + col, row * columns + col + 1, [
        point(x + 400, floor),
        point(nx - 400, floor),
      ]);
    }
  for (let row = 0; row < 2; row++)
    for (const col of [
      ...LINKS[region].vertical[row],
      ...Array.from({ length: columns - 7 }, (_, i) => i + 7).filter(
        (c) => c % 2 === row || c === columns - 1,
      ),
    ]) {
      const x = xs[col] + 240,
        upper = floors[row],
        lower = floors[row + 1];
      addAir(x, upper - 200, 230, lower - upper + 200);
      const via = [];
      for (let floor = lower - 120, i = 0; floor >= upper; floor -= 120, i++) {
        const lx = x + (i % 2 ? 60 : 0);
        ledge(lx, floor, 165);
        via.unshift(point(lx + 50, floor));
      }
      connect(row * columns + col, (row + 1) * columns + col, [
        point(x + 70, upper),
        ...via,
        point(x + 70, lower),
      ]);
    }
  // A broad, unchanged combat footprint at the end of the upper loop.
  const arenaStart = width - 1120;
  addAir(arenaStart, 130, 1080, 370);
  addAir(arenaStart - 130, 280, 300, 270);
  ledge(arenaStart - 50, 500, 240);
  const arena = {
    id: columns * 3,
    x: arenaStart + 250,
    floor: 500,
    ...point(arenaStart + 250, 500),
  };
  nodes.push(arena);
  connect(columns - 1, columns * 3, [point(arenaStart - 50, 500)]);
  rooms.push({
    id: `r${region}-${columns * 3}`,
    name:
      region === 1
        ? "Корона болот"
        : region === 4
          ? "Святилище бездны"
          : "Аметистовое озеро",
    x: arenaStart,
    y: 0,
    w: 1120,
    h: height,
  });
  // Narrow seals offer optional shortcuts; the main network never depends on them.
  const seals = [
    { x: 2280, y: floorAt(1) - 205, w: 38, h: 205 },
    { x: 5880, y: floorAt(2) - 205, w: 38, h: 205 },
  ];
  function floorAt(row) {
    return floors[row];
  }
  seals.forEach((s, i) =>
    platforms.push({
      ...s,
      solid: true,
      wall: true,
      breakable: true,
      shortcut: true,
      hp: 2,
      id: 900 + i,
    }),
  );
  platforms.push(...carveCaverns(width, height, openings));
  const campsAt = [
    LINKS[region].startRow * columns,
    columns + 3,
    columns * 2 + Math.floor(columns / 2),
    columns - 2,
    columns - 1,
  ];
  const checkpoints = campsAt.map((n, i) => ({
    id: REGION_CAMP_IDS[i],
    x: nodes[n].x - 80,
    y: nodes[n].floor - 50,
  }));
  // Required exploration fans into three loops before the final upper ascent.
  const tokenNodes =
    region === 1
      ? [1, 15, 11, 19]
      : region === 4
        ? [columns + 1, columns * 2 + 2, columns + 6, columns * 3 - 2]
        : [0, columns * 2, columns + 7, columns * 3 - 2];
  const secretsAt = [
    columns * 2,
    3,
    columns + 5,
    columns * 2 + 4,
    columns * 3 - 1,
  ];
  return {
    width,
    height,
    platforms,
    caverns: openings,
    rooms,
    checkpoints,
    checkpoint: checkpoints[1],
    spawn: point(xs[0] - 210, floors[LINKS[region].startRow]),
    arenaOffset: width - 4550,
    tokens: tokenNodes.map((n) => ({
      x: nodes[n].x,
      y: nodes[n].floor - 45,
      hidden: true,
    })),
    secretPoints: secretsAt.map((n) => [nodes[n].x + 80, nodes[n].floor - 45]),
    nodes,
    links,
    startNode: LINKS[region].startRow * columns,
    tokenNodes,
    secretNodes: secretsAt,
    water: [columns * 2, columns * 2 + 2, columns * 3 - 2].map((n) => ({
      x: nodes[n].x - 300,
      y: nodes[n].floor - 60,
      w: 560,
      h: 60,
    })),
    wind: [],
    routeSummary:
      "Исследуй верхние галереи, средние залы и нижние петли. Колодцы возвращают к привалам; верхняя восточная тропа ведёт к стражу.",
  };
}

function ascent(region) {
  const mountain = region === 2,
    height = mountain ? 5400 : 6800,
    width = 4550;
  const base = height - 180;
  const titles = mountain
    ? [
        "Под грозовыми тучами",
        "Нижний перевал",
        "Скалы ветров",
        "Храм ветров",
        "Разбитая обсерватория",
        "Над облаками",
        "Последний перевал",
        "Вершина гроз",
      ]
    : [
        "Погребённые ярусы",
        "Нижние аркады",
        "Звон забытых",
        "Цепные мосты",
        "Сломанные часы",
        "Забытая башня",
        "Последний звон",
        "Корона колокольни",
      ];
  const centers = mountain
    ? [550, 1900, 700, 2300, 900, 2500, 1500, 3230]
    : [550, 2000, 850, 2450, 1000, 2600, 1400, 3230];
  const floors = Array.from({ length: 8 }, (_, i) =>
    Math.round(base - ((base - 650) * i) / 7),
  );
  const platforms = [],
    rooms = [],
    nodes = [],
    links = [];
  const ledge = (x, y, w = 210, extra = {}) =>
    platforms.push({ x, y, w, h: 22, solid: false, ground: false, ...extra });
  const island = (x, y, w, h = 120) =>
    platforms.push(
      ...sculptIsland({
        x,
        y,
        w,
        h,
        solid: true,
        ground: true,
        terrain: true,
        wall: true,
      }),
    );
  for (let i = 0; i < 8; i++) {
    const x = centers[i],
      floor = floors[i];
    nodes.push({ id: i, x, floor, ...point(x, floor) });
    island(x - 100, floor, 220, i === 0 ? height - floor : 80);
    const top = i === 7 ? 0 : Math.round((floors[i] + floors[i + 1]) / 2);
    const bottom =
      i === 0 ? height : Math.round((floors[i - 1] + floors[i]) / 2);
    rooms.push({
      id: `r${region}-${i}`,
      name: titles[i],
      x: 0,
      y: top,
      w: 4550,
      h: bottom - top,
    });
  }
  function connect(a, b, branch = false) {
    const from = nodes[a],
      to = nodes[b],
      n = Math.max(
        Math.ceil(Math.abs(to.x - from.x) / 180),
        Math.ceil(Math.abs(to.floor - from.floor) / 95),
      );
    const via = [];
    for (let i = 1; i < n; i++) {
      const x = Math.round(from.x + ((to.x - from.x) * i) / n),
        floor = Math.round(from.floor + ((to.floor - from.floor) * i) / n);
      ledge(x - 80, floor, 190, {
        crumble: region === 3 && branch && i % 3 === 1,
      });
      platforms.at(-1).encounter = i % 4 === 2;
      via.push(point(x, floor));
    }
    links.push({ a, b, via });
  }
  for (let i = 0; i < 7; i++) connect(i, i + 1);
  // Each detour returns one tier higher: ruined balconies and exterior bridges.
  for (let i = 0; i < 4; i++) {
    const tier = i + 1,
      x = i % 2 ? 3600 : 340,
      floor = Math.round((floors[tier] + floors[tier + 1]) / 2);
    const id = nodes.length;
    nodes.push({ id, x, floor, ...point(x, floor) });
    island(x - 80, floor, 180, 80);
    connect(tier, id, true);
    connect(id, tier + 1, true);
  }
  for (const [i, n] of [1, 3].entries()) {
    island(centers[n] + 250, floors[n] + 120, 100, 100);
    platforms.push({
      id: 900 + i,
      x: centers[n] + 280,
      y: floors[n] - 10,
      w: 30,
      h: 130,
      solid: true,
      wall: true,
      breakable: true,
      shortcut: true,
      hp: 2,
    });
  }
  island(3430, 500, 1120, 140);
  nodes.push({ id: 12, x: 3570, floor: 500, ...point(3570, 500) });
  connect(7, 12);
  // Slender surviving spires support wall jumps without enclosing the skyline.
  for (let i = 1; i < 7; i++) island(centers[i] - 20, floors[i] + 80, 60, 240);
  const campsAt = [0, 2, 4, 6, 7],
    checkpoints = campsAt.map((n, i) => ({
      id: REGION_CAMP_IDS[i],
      x: nodes[n].x - 70,
      y: nodes[n].floor - 50,
    }));
  const tokenNodes = [8, 9, 10, 11],
    secretNodes = [1, 8, 9, 10, 11];
  return {
    width,
    height,
    platforms,
    caverns: [],
    openSky: true,
    rooms,
    nodes,
    links,
    startNode: 0,
    tokenNodes,
    secretNodes,
    spawn: point(centers[0] - 60, base),
    arenaOffset: 0,
    checkpoints,
    checkpoint: checkpoints[1],
    tokens: tokenNodes.map((n) => ({
      x: nodes[n].x,
      y: nodes[n].floor - 45,
      hidden: true,
    })),
    secretPoints: secretNodes.map((n) => [
      nodes[n].x + 60,
      nodes[n].floor - 45,
    ]),
    water: [],
    wind: mountain
      ? [
          { x: 1200, y: floors[3] - 260, w: 300, h: 220 },
          { x: 1750, y: floors[6] - 300, w: 350, h: 200 },
        ]
      : [],
    routeSummary: mountain
      ? "От подножия к храму ветров и вершине. Боковые уступы соединяются выше; привалы отмечают каждый новый высотный пояс."
      : "От нижних аркад к короне колокольни. Исследуй внешние мосты и боковые башни, затем вернись к центральному подъёму.",
  };
}

export function buildExpandedRegion(region, secretNames, artKey) {
  const l = [2, 3].includes(region) ? ascent(region) : dungeon(region);
  if (l.openSky) {
    const clearLanding = (p) =>
      !l.platforms.some(
        (s) =>
          s.solid &&
          p.x < s.x + s.w &&
          p.x + 30 > s.x &&
          p.y < s.y + s.h &&
          p.y + 54 > s.y,
      );
    // A balcony takes over the last step of an approach; never embed a
    // stepping stone (or its landing target) in the balcony's solid underside.
    l.platforms = l.platforms.filter(
      (s) => s.solid || clearLanding(point(s.x + 80, s.y)),
    );
    for (const link of l.links) link.via = link.via.filter(clearLanding);
  }
  // New barrier IDs cannot be confused with broken objects in legacy saves.
  l.platforms.forEach((s, i) => {
    s.id ??= 2000 + i;
  });
  l.expanded = true;
  l.artKey = artKey;
  l.signs = [];
  l.title = l.routeSummary;
  l.secrets = l.secretPoints.map(([x, y], id) => ({
    id,
    name: secretNames[id],
    x,
    y,
    kind: id === 1 ? "wall" : "room",
    found: false,
  }));
  l.veils = [];
  l.tokens[3].secret = true;
  l.tokens[3].secretId = 4;
  l.portals = [
    { x: l.spawn.x - 20, y: l.spawn.y + 27, to: "town", name: "В город" },
    {
      x: l.secretPoints[4][0],
      y: l.secretPoints[4][1],
      to: region === 1 ? 4 : region === 4 ? 5 : region === 5 ? 0 : "town",
      name:
        region === 1
          ? "Проход в Глубины"
          : region === 4
            ? "Проход в Озеро"
            : "Обратный путь",
      secretId: 4,
    },
  ];
  l.springs = l.checkpoints.map((c) => ({ x: c.x, y: c.y + 50, refuge: true }));
  l.shaft = {
    x: l.nodes[1].x,
    y: l.nodes[1].floor - 30,
    top: l.nodes[1].floor - 300,
  };
  return l;
}
