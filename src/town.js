import { growth } from "./progression.js";
// Feet coordinates are shared by scenery, interaction, navigation and the map.
export const TOWN_DISTRICTS = [
  {
    id: "roots",
    name: "Корни · Двор ремесленников",
    y: 1330,
    color: "#d89d65",
  },
  {
    id: "gardens",
    name: "Сады · Рынок и живая вода",
    y: 1060,
    color: "#9fc592",
  },
  { id: "boughs", name: "Ветви · Жилой квартал", y: 790, color: "#b8cdb0" },
  {
    id: "crown",
    name: "Крона · Совет и звёздные карты",
    y: 520,
    color: "#e5c997",
  },
];
const HOMES = {
  vart: {
    x: 330,
    y: 1330,
    home: "Сторожка у корней",
    kind: "guard",
    district: "roots",
  },
  rong: {
    x: 710,
    y: 1330,
    home: "Кузня в тёплом камне",
    kind: "forge",
    district: "roots",
  },
  gruk: {
    x: 1190,
    y: 1330,
    home: "Дом щитов",
    kind: "barracks",
    district: "roots",
  },
  dar: {
    x: 1760,
    y: 1330,
    home: "Приют странников",
    kind: "inn",
    district: "roots",
  },
  neli: {
    x: 770,
    y: 1060,
    home: "Лавка под листьями",
    kind: "market",
    district: "gardens",
  },
  sola: {
    x: 1260,
    y: 1060,
    home: "Дом травницы",
    kind: "garden",
    district: "gardens",
  },
  keeper: {
    x: 1840,
    y: 1060,
    home: "Святилище живой воды",
    kind: "spring",
    district: "gardens",
  },
  kai: {
    x: 990,
    y: 790,
    home: "Двор учителя",
    kind: "training",
    district: "boughs",
  },
  child: {
    x: 1600,
    y: 790,
    home: "Семейные гнёзда",
    kind: "nest",
    district: "boughs",
  },
  tess: {
    x: 1160,
    y: 520,
    home: "Мастерская карт",
    kind: "observatory",
    district: "crown",
  },
  elder: {
    x: 1640,
    y: 520,
    home: "Дом совета",
    kind: "council",
    district: "crown",
  },
  stranger: {
    x: 2080,
    y: 520,
    home: "Тихая обитель",
    kind: "hollow",
    district: "crown",
  },
};
export const RESIDENTS = [
  {
    id: "rong",
    name: "Кузнец Ронг",
    role: "Кузнец · улучшение оружия",
    sheet: 0,
    row: 0,
    service: "forge",
    need: 2,
    text: "Хорошее оружие — не роскошь, а возможность выжить. Принеси два древних жетона: я укреплю твоё оружие. Каждый удар станет сильнее.",
  },
  {
    id: "neli",
    name: "Торговка Нели",
    role: "Лавка снадобий",
    sheet: 0,
    row: 1,
    service: "medicine",
    need: 5,
    text: "Вещи с собой, а не жизнь — самая тяжёлая ноша. Найди пять жетонов, и дорожная аптечка будет твоей: ещё одно сердце. Здесь можно бесплатно восстановить силы.",
  },
  {
    id: "tess",
    name: "Картограф Тесс",
    role: "Карты и слухи",
    sheet: 0,
    row: 2,
    service: "compass",
    need: 0,
    text: "Мир огромен, но на каждой карте всегда остаётся место для тайны. Возьми компас. На карте появятся названия пяти тайн каждой земли. Точное место откроется, когда ты найдёшь его.",
  },
  {
    id: "dar",
    name: "Путешественник Дар",
    role: "Рассказы о дальних землях",
    sheet: 0,
    row: 3,
    quest: "dar",
    need: 3,
    text: "Я видел много мест… и в каждом есть что-то, что стоит увидеть. Посети три земли. Тогда я покажу обходные пути на твоих картах.",
  },
  {
    id: "sola",
    name: "Травница Сола",
    role: "Травы и восстановление",
    sheet: 1,
    row: 0,
    quest: "sola",
    need: 3,
    text: "Светящиеся жетоны помнят живую воду. Найди три, и мои травы будут усиливать дар источника. А пока отдохни: я восстановлю твои сердца.",
  },
  {
    id: "vart",
    name: "Страж Варт",
    role: "Городские ворота",
    sheet: 1,
    row: 1,
    text: "Город открыт каждому страннику. Следующая земля откроется после пяти жетонов и победы над её стражем. Подземные переходы связывают Топи, Глубины и Озеро — их ещё нужно найти.",
  },
  {
    id: "kai",
    name: "Учитель Кай",
    role: "Тренировочный двор",
    sheet: 1,
    row: 2,
    service: "training",
    need: 10,
    text: "Сила — в дисциплине. Повтори снова. После десяти жетонов я научу тебя быстрее готовить следующую атаку. На стенах нажимай прыжок снова; в воздухе береги второй прыжок.",
  },
  {
    id: "child",
    name: "Маленький ящерёнок",
    role: "Искатель сокровищ",
    sheet: 1,
    row: 3,
    quest: "child",
    need: 5,
    text: "А ты видел сияние за водопадом? Найди пять секретов! Я подарю тебе талисман: источники будут защищать тебя дольше.",
  },
  {
    id: "stranger",
    name: "Загадочный странник",
    role: "Хранитель слухов",
    sheet: 2,
    row: 0,
    quest: "stranger",
    need: 15,
    text: "Не все тайны хотят быть найденными. Найди пятнадцать, и я открою на картах непройденные комнаты. Сами сокровища останутся скрытыми.",
  },
  {
    id: "keeper",
    name: "Хранитель источника",
    role: "Живая вода",
    sheet: 2,
    row: 1,
    service: "spring",
    need: 0,
    text: "Здесь ты можешь перевести дух. Но путь — лишь продолжается. Прими благословение: источники на пути будут исцелять тебя. Начиная с пятого уровня, они на время усиливают удар.",
  },
  {
    id: "gruk",
    name: "Наёмник Грук",
    role: "Помощь в трудном бою",
    sheet: 2,
    row: 2,
    service: "mercenary",
    need: 2,
    text: "За золото, кулак и доброе слово. Успокой двух стражей — и я поделюсь щитом. Во время каждого боя он один раз убережёт от ранения.",
  },
  {
    id: "elder",
    name: "Старейшина",
    role: "Дом Старейшины",
    sheet: 2,
    row: 3,
    text: "Каждый встреченный тобой ящер — часть истории. Пять жетонов дают новый уровень. Десять открытых тайн — ещё один. Вместе Квирел и Урмаса могут достичь десятой ступени.",
  },
].map((n) => ({ ...n, ...HOMES[n.id] }));

export function nearbyResident(world, player) {
  return world.npcs
    .filter(
      (n) =>
        Math.abs(n.x - player.x - player.w / 2) < 85 &&
        Math.abs(n.y - player.y - player.h) < 65,
    )
    .sort(
      (a, b) =>
        Math.abs(a.x - player.x - player.w / 2) -
        Math.abs(b.x - player.x - player.w / 2),
    )[0];
}

export function residentProgress(n, p) {
  const g = growth(p),
    countType = (id) =>
      Object.values(p.tokens).filter((a) => a.includes(id)).length;
  const count =
    n.id === "rong"
      ? countType(2)
      : n.id === "gruk"
        ? p.defeated.length
        : n.id === "dar"
          ? p.visited.length
          : n.id === "sola"
            ? countType(1)
            : ["child", "stranger"].includes(n.id)
              ? g.secrets
              : g.flies;
  return {
    count,
    ready: count >= (n.need || 0),
    done: n.service
      ? p.services.includes(n.service)
      : n.quest
        ? p.quests.includes(n.quest)
        : false,
  };
}
export function createTown(region) {
  const terraces = [
    {
      x: 0,
      y: 1330,
      w: 2700,
      h: 170,
      solid: true,
      ground: true,
      material: "rock",
    },
    { x: 170, y: 1240, w: 190, h: 24, material: "rock" },
    { x: 350, y: 1150, w: 180, h: 24, material: "rock" },
    { x: 510, y: 1060, w: 1990, h: 34, material: "branch" },
    { x: 2310, y: 970, w: 180, h: 22, material: "wood" },
    { x: 2150, y: 880, w: 170, h: 22, material: "wood" },
    { x: 680, y: 790, w: 1460, h: 32, material: "branch" },
    { x: 570, y: 700, w: 170, h: 22, material: "wood" },
    { x: 740, y: 610, w: 180, h: 22, material: "wood" },
    { x: 910, y: 520, w: 1320, h: 32, material: "branch" },
  ];
  return {
    region,
    town: true,
    width: 2700,
    height: 1500,
    spawn: { x: 110, y: 1276 },
    platforms: terraces.map((s, id) => ({ ...s, id })),
    npcs: RESIDENTS.map((n) => ({ ...n })),
    districts: TOWN_DISTRICTS,
    portals: [{ x: 125, y: 1303, to: region, name: "Вернуться в путь" }],
    tokens: [],
    enemies: [],
    projectiles: [],
    hazards: [],
    secrets: [],
    discovered: new Set(),
    boss: { dead: true, active: false, hp: 0, maxHp: 1 },
    checkpoint: { x: 1840, y: 1006 },
    elder: { x: 1640, y: 466 },
  };
}
