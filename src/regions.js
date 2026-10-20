import { buildExpandedRegion } from "./expanded-regions.js";
import { buildForest } from "./forest.js";
export const REGION_KEYS = [
  "forest",
  "marsh",
  "storm",
  "belfry",
  "depths",
  "lake",
];
export const SECRET_NAMES = [
  [
    "Скрытая пещера",
    "Ломаемая стена",
    "Тайный проход",
    "Секретная комната",
    "Скрытая тропа",
  ],
  [
    "Подводная пещера",
    "Тайник на дереве",
    "Ломаемая стена",
    "Заброшенный храм",
    "Скрытый проход в Глубины",
  ],
  [
    "Пещера за водопадом",
    "Тайная тропа",
    "Скрытая комната",
    "Рухнувший мост",
    "Проход на вершину",
  ],
  [
    "Тайный подвал",
    "Ломаемая стена",
    "Забытая башня",
    "Секретная комната",
    "Скрытая тропа",
  ],
  [
    "Подводный тоннель",
    "Лаборатория древних",
    "Тайник за сталактитами",
    "Скрытый проход в Озеро",
    "Забытая комната",
  ],
  [
    "Пещера за водопадом",
    "Ломаемая стена",
    "Секретная комната",
    "Скрытая тропа",
    "Тайный проход",
  ],
];
export function roomAt(w, p) {
  return (
    w.rooms?.find(
      (r) =>
        p.x + p.w / 2 >= r.x &&
        p.x + p.w / 2 < r.x + r.w &&
        p.y + p.h / 2 >= r.y &&
        p.y + p.h / 2 < r.y + r.h,
    ) || w.rooms?.[0]
  );
}
export function buildRegion(region) {
  if (region !== 0)
    return buildExpandedRegion(
      region,
      SECRET_NAMES[region],
      REGION_KEYS[region],
    );
  const l = buildForest();
  l.expanded = true;
  l.artKey = REGION_KEYS[region];
  l.platforms.forEach((s, id) => (s.id = id));
  // Five discoverable places follow each numbered list in the supplied secret map.
  // Some hide a required token; other secrets contain an optional memory relic.
  const points = [
    [
      [1420, 1395],
      [1510, 1390],
      [2520, 1410],
      [2690, 325],
      [745, 250],
    ],
    [
      [1420, 1395],
      [510, 675],
      [1510, 1390],
      [2690, 325],
      [2520, 1410],
    ],
    [
      [1420, 1395],
      [740, 875],
      [2690, 325],
      [1840, 390],
      [1450, 490],
    ],
    [
      [1420, 1395],
      [2380, 340],
      [1630, 220],
      [2690, 325],
      [2520, 1410],
    ],
    [
      [1420, 1395],
      [1840, 390],
      [510, 335],
      [2520, 1410],
      [2690, 325],
    ],
    [
      [1420, 1395],
      [1510, 1390],
      [2690, 325],
      [1190, 280],
      [2520, 1410],
    ],
  ][region];
  l.secrets = points.map(([x, y], id) => ({
    id,
    name: SECRET_NAMES[region][id],
    x,
    y,
    kind: id === 1 ? "wall" : id === 0 ? "veil" : id === 3 ? "room" : "trail",
    found: false,
  }));
  l.veils = [
    {
      x: points[0][0] - 110,
      y: points[0][1] - 170,
      w: 220,
      h: 230,
      secretId: 0,
      kind: region === 0 ? "roots" : region === 3 ? "dust" : "waterfall",
    },
  ];
  for (const t of l.tokens) t.hidden = region !== 0 || t.secret || t.y > 1100;
  l.tokens[3].secret = true;
  l.tokens[3].secretId = [3, 3, 2, 3, 4, 2][region];
  l.portals = [
    { x: 110, y: l.spawn.y + 27, to: "town", name: "В город" },
    {
      x: 2520,
      y: 1410,
      to: region === 1 ? 4 : region === 4 ? 5 : region === 5 ? 0 : "town",
      name:
        region === 1
          ? "Проход в Глубины"
          : region === 4
            ? "Проход в Озеро"
            : region === 5
              ? "Путь к корням"
              : "В город",
      secretId: [2, 4, null, 4, 3, 4][region],
    },
  ];

  l.signs.push(
    { x: 240, y: l.spawn.y - 20, text: "← ГОРОД · ПРОБЕЛ У ВРАТ" },
    { x: 2225, y: 335, text: "ТРЕЩИНЫ… ПРОБЕЛ" },
    { x: 2350, y: l.checkpoint.y + 15, text: "ИСТОЧНИК · ПУТЬ К ВЕРШИНЕ ↗" },
  );
  l.springs = [
    ...(region === 0
      ? l.checkpoints
          .slice(1)
          .map((c) => ({ x: c.x, y: c.y + 50, refuge: true }))
      : []),
    { x: l.checkpoint.x, y: l.checkpoint.y + 50 },
    { x: 3385, y: 500, refuge: true },
  ];
  return l;
}
