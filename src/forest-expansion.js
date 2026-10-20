// Two new connected routes and a deep return network. Coordinates describe air;
// movement scale stays unchanged as the authored forest gains three times its area.
export const FOREST_SIZE = { width: 9100, height: 2400 };
export const FOREST_ARENA_OFFSET = 4550;
export const FOREST_CAMPS = [
  { id: "hearth", x: 2240, y: 1000 },
  { id: "old-heart", x: 4100, y: 450 },
  { id: "lanterns", x: 6030, y: 1350 },
  { id: "deep-rest", x: 4400, y: 2200 },
  { id: "last-root", x: 7850, y: 450 },
];
export const NEW_FOREST_ROOMS = [
  ["hollow-trunk", "Полый ствол", 3430, 700, 1120, 900, "roots"],
  ["buried-garden", "Погребённый сад", 750, 1600, 950, 800, "roots"],
  ["mycelium-vault", "Своды грибницы", 1700, 1600, 950, 800, "roots"],
  ["silent-well", "Тихий колодец", 2650, 1600, 950, 800, "roots"],
  ["deep-rest", "Глубинный привал", 3600, 1600, 950, 800, "roots"],
  ["spore-gallery", "Галерея спор", 4550, 0, 1150, 800, "canopy"],
  ["violet-crown", "Фиолетовая крона", 5700, 0, 1150, 800, "canopy"],
  ["hanging-gardens", "Висячие сады", 6850, 0, 1130, 800, "canopy"],
  ["root-descent", "Сплетение корней", 4550, 800, 1150, 800, "roots"],
  ["lantern-hall", "Зал фонарей", 5700, 800, 1150, 800, "roots"],
  ["echo-shaft", "Колодец эха", 6850, 800, 1130, 800, "roots"],
  ["spore-catacombs", "Споровые катакомбы", 4550, 1600, 1150, 800, "roots"],
  ["blue-reservoir", "Лазурный водоём", 5700, 1600, 1150, 800, "roots"],
  ["last-roots", "Последние корни", 6850, 1600, 1130, 800, "roots"],
  ["under-tree", "Под древом", 7980, 800, 1120, 1600, "roots"],
  ["sanctum", "Забытое дерево", 7980, 0, 1120, 800, "sanctum"],
].map(([id, name, x, y, w, h, art]) => ({ id, name, x, y, w, h, art }));
export const NEW_FOREST_PASSAGES = [
  // Arrival hub and fork: climb through the crown or descend to the lanterns.
  [4400, 300, 550, 200],
  [4800, 280, 720, 260],
  [4550, 440, 250, 1810],
  [5220, 420, 260, 980],
  // Short upper route: tighter rising turns and a sequence of wall-jump wells.
  [5400, 240, 450, 220],
  [5720, 110, 440, 250],
  [6050, 210, 390, 240],
  [6330, 330, 400, 250],
  [6600, 420, 490, 200],
  [6950, 300, 370, 260],
  [7190, 180, 400, 250],
  [7470, 280, 520, 220],
  [7830, 280, 300, 220],
  // Longer middle loop with return rungs and side alcoves.
  [4720, 940, 650, 250],
  [5000, 1150, 550, 250],
  [5400, 1120, 600, 280],
  [5850, 1110, 650, 290],
  [6380, 1050, 730, 350],
  [6950, 500, 230, 900],
  [7100, 1080, 600, 260],
  [7580, 920, 570, 280],
  [8050, 740, 450, 300],
  [8230, 570, 250, 410],
  [7750, 420, 230, 780],
  [6100, 740, 270, 480],
  [5980, 710, 750, 230],
  // A second route below the entire old forest, with looping stepped chambers.
  [3950, 1990, 850, 260],
  [3500, 1840, 650, 290],
  [3000, 1980, 660, 270],
  [2500, 1840, 650, 280],
  [2000, 1980, 650, 270],
  [1500, 1800, 650, 320],
  [800, 1970, 850, 280],
  [800, 1690, 500, 420],
  [1170, 1660, 880, 240],
  [1950, 1690, 1100, 220],
  [2920, 1660, 1200, 240],
  [3990, 1500, 720, 390],
  // Eastern catacombs reconnect both central wells and the last root climb.
  [4670, 1990, 800, 260],
  [5350, 1820, 650, 300],
  [5870, 1990, 850, 260],
  [6600, 1790, 690, 330],
  [7160, 1970, 900, 280],
  [7920, 1800, 820, 300],
  [8510, 940, 230, 1160],
  [8300, 940, 400, 230],
  [6100, 1320, 250, 930],
  [7160, 1270, 230, 820],
  // The final arena retains its proven encounter dimensions and floor height.
  [7980, 130, 1080, 370],
  [8120, 80, 770, 420],
].map(([x, y, w, h]) => ({ x, y, w, h }));

export function addForestExpansion(platforms) {
  const ledge = (x, y, w = 150) =>
    platforms.push({ x, y, w, h: 22, solid: false, ground: false });
  const floor = (x, y, w) =>
    platforms.push({ x, y, w, h: 65, solid: true, ground: true });
  const ladder = (x, bottom, top, width = 230) => {
    for (let y = bottom - 130, i = 0; y > top + 60; y -= 130, i++)
      ledge(x + (i % 2 ? width - 120 : 10), y, 110);
  };
  floor(4800, 540, 420);
  floor(5480, 1400, 620);
  floor(6350, 1400, 600);
  floor(3950, 2250, 720);
  floor(7980, 500, 1120);
  // Rungs leave a continuous clear column for descending and wall kicking.
  ladder(4550, 2250, 440, 250);
  ladder(5220, 1400, 420, 260);
  ladder(6950, 1400, 500);
  ladder(8230, 980, 570, 250);
  ladder(7750, 1200, 420);
  ladder(8510, 2100, 940);
  ladder(6100, 2250, 1320, 250);
  ladder(7160, 2090, 1270);
  ladder(6100, 1220, 740, 270);
  // Crown landings are short, with variable gaps and 100–150px climbs.
  for (const [x, y, w] of [
    [5480, 440, 150],
    [5700, 340, 130],
    [5910, 270, 130],
    [6140, 390, 140],
    [6430, 510, 160],
    [6750, 570, 140],
    [7030, 480, 130],
    [7270, 360, 140],
    [7500, 430, 150],
    [7750, 500, 230],
    [4830, 1110, 150],
    [5100, 1280, 150],
    [5600, 1260, 170],
    [5830, 1160, 160],
    [6520, 1220, 170],
    [7210, 1250, 160],
    [7470, 1150, 150],
    [7760, 1080, 160],
    [8070, 970, 140],
    [8330, 840, 120],
    [4200, 2100, 150],
    [3750, 2060, 150],
    [3220, 2130, 150],
    [2720, 2050, 150],
    [2230, 2150, 150],
    [1740, 2010, 150],
    [1300, 2100, 150],
    [950, 1950, 150],
    [1010, 1810, 140],
    [1500, 1810, 160],
    [2230, 1840, 150],
    [2760, 1800, 150],
    [3320, 1780, 150],
    [3800, 1780, 150],
    [4160, 1740, 150],
    [4900, 2150, 160],
    [5480, 2020, 160],
    [5780, 1960, 160],
    [6380, 2140, 150],
    [6770, 2020, 140],
    [7050, 1920, 140],
    [7550, 2130, 150],
    [8070, 2010, 150],
  ])
    ledge(x, y, w);
  // Breakable seals open optional return links, never the only way out.
  for (const [x, y, h] of [
    [6100, 740, 230],
    [7160, 1340, 260],
    [3990, 1660, 230],
  ])
    platforms.push({
      x,
      y,
      w: 32,
      h,
      solid: true,
      wall: true,
      ground: false,
      breakable: true,
      hp: 2,
      shortcut: true,
    });
}
