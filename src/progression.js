export const TOKEN_TYPES = [
  {
    id: "ordinary",
    name: "Обычный жетон",
    color: "#e9c67d",
    description: "Память пути. Пять жетонов дают новый уровень.",
  },
  {
    id: "glowing",
    name: "Светящийся жетон",
    color: "#d4a7ff",
    description: "Скрыт в тайниках. С уровня 5 временно усиливает героя.",
  },
  {
    id: "ancient",
    name: "Древний жетон",
    color: "#b8d8ec",
    description: "Редкая память предков за скрытыми проходами.",
  },
  {
    id: "cursed",
    name: "Проклятый жетон",
    color: "#f48a7c",
    description: "Награда за испытание: сначала успокой стражей тайника.",
  },
  {
    id: "golden",
    name: "Золотой жетон",
    color: "#ffdd70",
    description: "Главную награду охраняет хозяин области.",
  },
];
export const LEVELS = [
  ["Первые шаги", "Двойной прыжок, атака и рывок."],
  ["Крепкое сердце", "Ещё одно сердце и более сильная атака."],
  ["Свой приём", "Квирел: широкий круг посохом. Урмаса: длинный боевой рывок."],
  ["Выше по стенам", "Более сильный толчок от стены."],
  ["Свет внутри", "Светящиеся жетоны и источники дарят временное усиление."],
  ["Оружие странника", "Сильнее удар и быстрее восстановление атаки."],
  [
    "Воздушная атака",
    "Удары в воздухе возвращают второй прыжок при попадании.",
  ],
  ["Ответный удар", "После уклонения рывком следующий удар сильнее."],
  ["Сила источника", "Ещё одно сердце и полный запас сил у источника."],
  ["Высшая форма", "Золотое сияние, ещё сильнее атаки и быстрее рывок."],
];
export function growth(progress) {
  const flies = Object.values(progress?.tokens || {}).reduce(
    (n, a) => n + a.length,
    0,
  );
  const secrets = Object.values(progress?.secrets || {}).reduce(
    (n, a) => n + a.length,
    0,
  );
  const level = Math.min(
    10,
    1 + Math.floor(flies / 5) + Math.floor(secrets / 10),
  );
  return {
    level,
    flies,
    secrets,
    damage:
      1 + (level >= 2 ? 1 : 0) + (level >= 6 ? 1 : 0) + (level >= 10 ? 1 : 0),
    hearts: (level >= 2 ? 1 : 0) + (level >= 9 ? 1 : 0),
    wallJump: level >= 4 ? -640 : -570,
  };
}
export const SERVICES = [
  "forge",
  "medicine",
  "compass",
  "training",
  "spring",
  "mercenary",
];
export function hasService(p, key) {
  return p.services?.includes(key) || false;
}
