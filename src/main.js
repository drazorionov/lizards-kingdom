import { regionMapMarkup, townMapMarkup } from "./region-renderer.js";
import { REGION_KEYS } from "./regions.js";
import { growth, LEVELS, TOKEN_TYPES } from "./progression.js";
import { RESIDENTS, residentProgress } from "./town.js";
import { CreatureShowcase } from "./creature-showcase.js";
import { CREATURES, REGION_CREATURES, BOSSES } from "./creatures.js";
import { HeroShowcase } from "./hero-showcase.js";
import { REGIONS, sanitizeProgress } from "./world.js";
import { SaveStore, SAVE_KEY } from "./save.js";
import { Sound } from "./audio.js";
import { Renderer } from "./renderer.js";
import { Game } from "./engine.js";
const $ = (s) => document.querySelector(s),
  sound = new Sound();
const store = new SaveStore(
  (message) => ($("#save-status").textContent = message),
);
let heroShowcase,
  creatureShowcase,
  startSerial = 0,
  progress = store.value,
  game,
  assetsPromise,
  toastTimer,
  modalReturnFocus,
  modalKind = "",
  selectedHero = progress.hero;
const unlocked = (i) =>
  i === 0 || progress.cleared.includes(i - 1) || progress.visited.includes(i);
function save(p = progress) {
  const value = store.update({ ...p, hero: selectedHero });
  if (value.resetAt > (p.resetAt || 0)) returnToNewJourney(value);
  else progress = value;
}
function updateMenu() {
  $("#region-cards").innerHTML = REGIONS.map(
    (r, i) =>
      `<button class="region-card ${i === progress.region ? "active" : ""}" data-region="${i}" aria-label="${r.name}${unlocked(i) ? "" : " — закрыто"}"><img src="/assets/region-${i}.webp" alt="${r.name} — пейзаж"><span class="card-state">${progress.cleared.includes(i) ? "✓" : unlocked(i) ? "✦" : "◇"}</span><span class="card-text"><small>ГЛАВА ${r.chapter}</small>${r.name}</span></button>`,
  ).join("");
  const started =
    Object.values(progress.tokens).some((t) => t.length) ||
    progress.checkpoint ||
    progress.cleared.length;
  $("#start span").textContent = started ? "Продолжить путь" : "Начать путь";
  $("#journey-note").textContent = started
    ? `Глава ${REGIONS[progress.region].chapter} · ${REGIONS[progress.region].name}`
    : "Первая глава — Дремучий грибной лес";
  document.querySelectorAll(".hero-choice").forEach((b) => {
    const yes = Number(b.dataset.hero) === selectedHero;
    b.classList.toggle("selected", yes);
    b.setAttribute("aria-pressed", String(yes));
  });
  document.querySelectorAll("[data-region]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.region);
        if (unlocked(i)) start(i);
        else regionPreview(i);
      }),
  );
}
async function loadAssets() {
  if (assetsPromise) return assetsPromise;
  assetsPromise = (async () => {
    const manifest = await fetch("/assets/manifest.json").then((r) => {
      if (!r.ok) throw new Error("Art could not be loaded");
      return r.json();
    });
    const assets = {};
    await Promise.all(
      [
        ...Object.keys(manifest),
        "hero-quirel-painted-atlas",
        "hero-urmasa-painted-atlas",
        "elder-atlas",
        ...Array.from({ length: 5 }, (_, i) => `token-type-${i}`),
      ]
        .filter((k) => !k.startsWith("hero-") || k.endsWith("painted-atlas"))
        .filter(
          (k) =>
            !k.startsWith("enemy-") &&
            !k.startsWith("boss-") &&
            !k.startsWith("background-"),
        )
        .filter(
          (k) =>
            ![
              "elder",
              "cover",
              "world-map",
              "castle",
              "kingdom-panorama",
              "forest-panorama",
            ].includes(k),
        )
        .map(async (key) => {
          const im = new Image();
          im.src = `/assets/${key}.webp`;
          await im.decode();
          assets[key] = im;
        }),
    );
    assets.expansion = await fetch("/assets/expansion.json").then((r) =>
      r.json(),
    );
    return assets;
  })();
  return assetsPromise;
}
const creatureLoads = new Map();
const loadedRegions = [];
async function loadCreatureAssets(region) {
  const assets = await loadAssets();
  await loadExtra(assets, [
    "vertical-walls-painted",
    `save-shrine-${region}-v1`,
  ]);
  const keys = [...REGION_CREATURES[region], BOSSES[region]];
  await Promise.all(
    keys.map(async (key) => {
      if (assets[`creature-${key}`]) return;
      if (!creatureLoads.has(key))
        creatureLoads.set(
          key,
          (async () => {
            const im = new Image();
            im.src = `/assets/${key}-atlas.webp`;
            await im.decode();
            assets[`creature-${key}`] = im;
          })().finally(() => creatureLoads.delete(key)),
        );
      await creatureLoads.get(key);
    }),
  );
  if (region === 0) {
    await Promise.all(
      [
        "canopy",
        "roots",
        "sanctum",
        "terrain",
        "ledges",
        "mother-attacks-atlas",
        "cave-edges-v2",
        "cave-walls-v2",
        "cave-joins-floor-v2",
        "cave-joins-ceiling-v2",
        "cave-overlays-v1",
      ].map(async (name) => {
        const key = "forest-" + name;
        if (assets[key]) return;
        if (!creatureLoads.has(key))
          creatureLoads.set(
            key,
            (async () => {
              const im = new Image();
              im.src = "/assets/" + key + ".webp";
              await im.decode();
              assets[key] = im;
            })().finally(() => creatureLoads.delete(key)),
          );
        await creatureLoads.get(key);
      }),
    );
  }
  if (region !== 0)
    await loadExtra(assets, [
      `${REGION_KEYS[region]}-background`,
      `${REGION_KEYS[region]}-surface-v1`,
      `${REGION_KEYS[region]}-ledges`,
      `${REGION_KEYS[region]}-terrain`,
      `${REGION_KEYS[region]}-boss-attacks-atlas`,
    ]);
  const old = loadedRegions.indexOf(region);
  if (old >= 0) loadedRegions.splice(old, 1);
  loadedRegions.push(region);
  while (loadedRegions.length > 2) loadedRegions.shift();
  const keepRegions = new Set([
    ...loadedRegions,
    ...(game?.running ? [game.world.region] : []),
  ]);
  const keep = new Set(
    [...keepRegions].flatMap((r) => [...REGION_CREATURES[r], BOSSES[r]]),
  );
  for (const key of Object.keys(assets))
    if (key.startsWith("creature-") && !keep.has(key.slice(9)))
      delete assets[key];
  if (!keepRegions.has(0))
    for (const key of Object.keys(assets))
      if (key.startsWith("forest-")) delete assets[key];
  for (const [i, prefix] of REGION_KEYS.entries())
    if (i > 0 && !keepRegions.has(i))
      for (const suffix of [
        "background",
        "ledges",
        "terrain",
        "surface-v1",
        "boss-attacks-atlas",
      ])
        delete assets[`${prefix}-${suffix}`];
  return assets;
}
async function loadExtra(assets, keys) {
  await Promise.all(
    keys.map(async (key) => {
      if (assets[key]) return;
      const im = new Image();
      im.src = `/assets/${key}.webp`;
      await im.decode();
      assets[key] = im;
    }),
  );
}
function toast(message, duration = 2600) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    duration,
  );
}
async function start(region = progress.region, town = false) {
  if (!unlocked(region)) region = 0;
  const serial = ++startSerial;
  $("#start").disabled = true;
  $("#start span").textContent = "Открываем королевство…";
  try {
    const assets = await loadCreatureAssets(region);
    if (town)
      await loadExtra(assets, [
        "town-tree-painted",
        "town-homes-painted",
        "town-platforms-painted",
        "forest-terrain",
        "town-npcs-0-atlas",
        "town-npcs-1-atlas",
        "town-npcs-2-atlas",
      ]);
    if (serial !== startSerial) return;
    if (!game) {
      const renderer = new Renderer($("#canvas"), assets);
      game = new Game($("#canvas"), assets, renderer, {
        pause: showPause,
        toast,
        sound: (type) => sound.play(type),
        save: (p) => save(p),
        complete: showComplete,
        interact: showResident,
        travel: (to) => {
          if (to === "town") startTown();
          else {
            progress.visited = [...new Set([...progress.visited, to])];
            save();
            start(to);
          }
        },
        hud: updateHud,
      });
    }
    closeModal(false);
    $("#menu").classList.add("hidden");
    $("#game").classList.remove("hidden");
    if (progress.region !== region) progress.checkpoint = false;
    progress.region = region;
    progress.hero = selectedHero;
    if (town) game.startTown(progress);
    else game.start(region, progress);
    $("#canvas").focus();
    save();
  } catch (e) {
    console.error(e);
    showModal(
      "error",
      `<div class="eyebrow">НЕБОЛЬШАЯ ПАУЗА</div><h2 id="modal-title">Лес ещё просыпается.</h2><p>Не удалось загрузить рисунки. Проверь соединение и попробуй ещё раз.</p><button class="primary-button" id="retry">Попробовать снова →</button>`,
    );
    assetsPromise = null;
    $("#retry").onclick = () => start(region);
  } finally {
    $("#start").disabled = false;
    updateMenu();
  }
}
function updateHud({ health, maxHealth, tokens, boss, region, town, level }) {
  $("#chapter-label").textContent =
    `${town ? "ГОРОД" : "ГЛАВА " + REGIONS[region].chapter} · ${selectedHero === 0 ? "КВИРЕЛ" : "УРМАСА"} · УР. ${level}`;
  $("#region-name").textContent = town
    ? "Древоград · Город в ветвях"
    : REGIONS[region].name;
  $("#hearts").innerHTML = Array.from(
    { length: maxHealth },
    (_, i) =>
      `<span class="${i < health ? "" : "heart-empty"}">${i < health ? "♥" : "♡"}</span>`,
  ).join("");
  $("#hearts").setAttribute(
    "aria-label",
    `Здоровье: ${health} из ${maxHealth}`,
  );
  $("#token-count").innerHTML = tokens
    .map(
      (t) =>
        `<span class="token-pip ${t.collected ? "found" : ""}" style="color:${TOKEN_TYPES[t.type].color}" aria-label="${TOKEN_TYPES[t.type].name}: ${t.collected ? "найден" : "не найден"}">✧</span>`,
    )
    .join("");
  $("#boss-hud").classList.toggle("hidden", !boss.active || boss.dead);
  $("#boss-name").textContent = REGIONS[region].boss;
  $("#boss-health").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  $("#objective").textContent = town
    ? "↑ / W — прыгать по уступам · Пробел / меч — говорить · M — карта"
    : tokens.every((t) => t.collected)
      ? "Пять огоньков найдены. К вратам →"
      : boss.dead
        ? "Страж отдыхает. Найди остальных жетонов."
        : "Исследуй тропы. Найди все пять жетонов.";
}
function showModal(kind, html) {
  creatureShowcase?.stop();
  creatureShowcase = null;
  heroShowcase?.stop();
  heroShowcase = null;
  if (game?.running) game.pause();
  if ($("#modal").classList.contains("hidden"))
    modalReturnFocus = document.activeElement;
  pointerControls.clear();
  document
    .querySelectorAll("[data-control].pressed")
    .forEach((button) => button.classList.remove("pressed"));
  $("#menu").inert = true;
  $("#game").inert = true;
  $("#pause").inert = true;
  $("#pause").setAttribute("aria-expanded", "true");
  modalKind = kind;
  $("#modal").dataset.kind = kind;
  $("#reset-progress").classList.toggle("hidden", kind === "reset");
  $("#modal-content").innerHTML = html;
  $("#modal").classList.remove("hidden");
  requestAnimationFrame(() => {
    $("#modal-close").focus();
    const map = $("#modal-content .map-viewport");
    if (map) {
      map.scrollLeft =
        Number(map.dataset.focusX) * map.scrollWidth - map.clientWidth / 2;
      map.scrollTop =
        Number(map.dataset.focusY) * map.scrollHeight - map.clientHeight / 2;
    }
  });
}
function closeModal(resume = true) {
  creatureShowcase?.stop();
  creatureShowcase = null;
  heroShowcase?.stop();
  heroShowcase = null;
  $("#modal").classList.add("hidden");
  modalKind = "";
  $("#reset-progress").classList.remove("hidden");
  $("#menu").inert = false;
  $("#game").inert = false;
  $("#pause").inert = false;
  $("#pause").setAttribute("aria-expanded", "false");
  if (resume && game?.running) game.resume();
  else modalReturnFocus?.focus();
}
function modeSetting() {
  return `<label class="setting-line">Сложность <select id="mode"><option value="gentle" ${progress.mode === "gentle" ? "selected" : ""}>Спокойно · больше сердец и времени</option><option value="adventure" ${progress.mode === "adventure" ? "selected" : ""}>Приключение · чуть сложнее</option></select></label>`;
}
function bindMode() {
  const mode = $("#mode");
  if (mode)
    mode.onchange = () => {
      progress.mode = mode.value;
      if (game?.player) {
        game.progress.mode = mode.value;
        game.player.health = game.maxHealth();
        game.updateHud();
      }
      save();
    };
}
function showPause() {
  if (!game?.running) {
    showModal(
      "pause",
      `<div class="eyebrow">КОРОЛЕВСТВО ЯЩЕРИЦ</div><h2 id="modal-title">Меню</h2>${modeSetting()}<div class="modal-actions"><button id="menu-done" class="primary-button">Вернуться <b>→</b></button><button id="help-pause" class="secondary-button">Как играть</button></div>`,
    );
    $("#menu-done").onclick = () => closeModal();
    $("#help-pause").onclick = showHelp;
    bindMode();
    return;
  }
  showModal(
    "pause",
    `<div class="eyebrow">ПЕРЕДОХНИ, МАЛЕНЬКИЙ СТРАННИК</div><h2 id="modal-title">Королевство подождёт.</h2><p>${$("#region-name").textContent} · ${$("#chapter-label").textContent}</p><p>${$("#objective").textContent}</p>${modeSetting()}<div class="modal-actions"><button id="resume" class="primary-button">Вернуться в приключение <b>→</b></button>${!game.world.town ? '<button id="forest-rematch" class="secondary-button">Повторить бой со стражем</button>' : ""}<button id="map-pause" class="secondary-button">Карта мира</button><button id="bestiary-pause" class="secondary-button">Бестиарий</button><button id="heroes-pause" class="secondary-button">Герои</button><button id="help-pause" class="secondary-button">Как играть</button><button id="town-pause" class="secondary-button">В город</button><button id="growth-pause" class="secondary-button">Развитие героя</button><button id="home" class="secondary-button">Главное меню</button></div>`,
  );
  $("#resume").onclick = () => closeModal();
  const rematch = $("#forest-rematch");
  if (rematch)
    rematch.onclick = () => {
      game.rematchMother();
      closeModal();
    };
  $("#map-pause").onclick = showMap;
  $("#bestiary-pause").onclick = () => showBestiary(game.world.region);
  $("#heroes-pause").onclick = showHeroes;
  $("#home").onclick = goHome;
  $("#town-pause").onclick = startTown;
  $("#growth-pause").onclick = showGrowth;
  $("#help-pause").onclick = showHelp;
  bindMode();
}
function goHome() {
  if (game) {
    game.persist();
    game.stop();
  }
  closeModal(false);
  $("#game").classList.add("hidden");
  $("#menu").classList.remove("hidden");
  updateMenu();
  $("#start").focus();
}
function returnToNewJourney(value) {
  ++startSerial;
  game?.stop();
  progress = value;
  selectedHero = value.hero;
  if (game) game.progress = value;
  closeModal(false);
  $("#game").classList.add("hidden");
  $("#menu").classList.remove("hidden");
  $("#start").disabled = false;
  updateMenu();
  $("#start").focus();
}
function showResetProgress() {
  if (modalKind === "reset") return;
  showModal(
    "reset",
    `<div class="eyebrow">НОВОЕ ПРИКЛЮЧЕНИЕ</div><h2 id="modal-title">Сбросить весь прогресс?</h2><p>Открытые главы, жетоны, тайны, побеждённые стражи, улучшения и поручения города будут удалены для обоих героев. Отменить сброс нельзя.</p><p>Выбранный герой, сложность и звук сохранятся. Сброс синхронизируется с облаком при подключении.</p><div class="modal-actions"><button id="reset-cancel" class="primary-button">Оставить мой прогресс</button><button id="reset-confirm" class="secondary-button danger-button">Сбросить прогресс</button></div>`,
  );
  $("#reset-cancel").onclick = showPause;
  $("#reset-confirm").onclick = () => {
    game?.stop();
    returnToNewJourney(store.reset());
  };
  requestAnimationFrame(() => $("#reset-cancel")?.focus());
}
function acceptStoreValue(value) {
  const activeReset = game?.running ? game.progress.resetAt : progress.resetAt;
  if (value.resetAt > activeReset) returnToNewJourney(value);
  else if (!game?.running) {
    progress = value;
    selectedHero = value.hero;
    updateMenu();
  }
}
async function showHeroes() {
  showModal(
    "heroes",
    `<div class="eyebrow">ДВА СТРАННИКА. ОДНО БОЛЬШОЕ ПРИКЛЮЧЕНИЕ.</div><h2 id="modal-title">Знакомься с героями</h2><div class="hero-gallery"><section><canvas width="480" height="420" aria-label="Анимация Квирел"></canvas><h3>Квирел</h3><span>ЗОЛОТАЯ СТРАННИЦА</span><p>Спокойствие, точность, равновесие. Квирел сражается круговыми ударами посоха с двумя клинками и отталкивается от стен.</p></section><section><canvas width="480" height="420" aria-label="Анимация Урмасы"></canvas><h3>Урмаса</h3><span>АЛАЯ ИСКРА</span><p>Стремительные шаги и парные клинки. Алая искра на пути к новым открытиям.</p></section></div><div class="hero-preview-modes" role="group" aria-label="Движения героев"><button data-motion="idle" aria-pressed="true">Покой</button><button data-motion="walk" aria-pressed="false">Бег</button><button data-motion="jump" aria-pressed="false">Прыжок</button><button data-motion="attack" aria-pressed="false">Атака</button><button data-motion="wall" aria-pressed="false">На стене</button></div><p id="hero-preview-status" class="hero-preview-status">Будим странников…</p>`,
  );
  try {
    const assets = await loadAssets();
    if (modalKind !== "heroes") return;
    heroShowcase = new HeroShowcase(
      [...document.querySelectorAll(".hero-gallery canvas")],
      assets,
    );
    $("#hero-preview-status").textContent =
      "Выбери движение, чтобы увидеть героев в действии.";
    document.querySelectorAll("[data-motion]").forEach(
      (button) =>
        (button.onclick = () => {
          heroShowcase.setMode(button.dataset.motion);
          document
            .querySelectorAll("[data-motion]")
            .forEach((b) =>
              b.setAttribute("aria-pressed", String(b === button)),
            );
        }),
    );
  } catch {
    if (modalKind === "heroes")
      $("#hero-preview-status").textContent =
        "Рисунки не загрузились. Открой просмотр ещё раз.";
  }
}
async function showBestiary(region = 0) {
  showModal(
    "bestiary",
    `<div class="eyebrow">ОБИТАТЕЛИ КОРОЛЕВСТВА</div><h2 id="modal-title">Бестиарий</h2><div class="bestiary-regions">${REGIONS.map((r, i) => `<button data-beasts="${i}" aria-pressed="${i === region}">${r.name}</button>`).join("")}</div><div class="beast-gallery">${[...REGION_CREATURES[region], BOSSES[region]].map((key) => `<section><canvas width="400" height="360"></canvas><h3>${CREATURES[key]?.name || REGIONS[region].boss}</h3></section>`).join("")}</div><div class="hero-preview-modes">${[
      ["idle", "Покой"],
      ["move", "Движение"],
      ["attack", "Атака"],
      ["hit", "Ранение"],
      ["defeat", "Отдых"],
    ]
      .map(
        ([key, label]) =>
          `<button data-beast-motion="${key}" aria-pressed="${key === "idle"}">${label}</button>`,
      )
      .join("")}</div><p id="beast-status">Загружаем рисунки…</p>`,
  );
  document
    .querySelectorAll("[data-beasts]")
    .forEach((b) => (b.onclick = () => showBestiary(Number(b.dataset.beasts))));
  const panel = $("#beast-status");
  try {
    const assets = await loadCreatureAssets(region);
    if (modalKind !== "bestiary" || $("#beast-status") !== panel) return;
    creatureShowcase = new CreatureShowcase(
      [...document.querySelectorAll(".beast-gallery canvas")],
      assets,
      [...REGION_CREATURES[region], BOSSES[region]],
    );
    panel.textContent = "Выбери движение. Те же рисунки используются в игре.";
    document.querySelectorAll("[data-beast-motion]").forEach(
      (b) =>
        (b.onclick = () => {
          creatureShowcase.mode = b.dataset.beastMotion;
          document
            .querySelectorAll("[data-beast-motion]")
            .forEach((v) => v.setAttribute("aria-pressed", String(v === b)));
        }),
    );
  } catch {
    if (panel.isConnected)
      panel.textContent =
        "Не удалось загрузить рисунки. Открой бестиарий ещё раз.";
  }
}
function showHelp() {
  showModal(
    "help",
    `<div class="eyebrow">ПЕРЕД НАЧАЛОМ ПУТИ</div><h2 id="modal-title">Маленькие шаги. Смелые приключения.</h2><div class="help-grid"><div><strong>← → Движение · ↑ Прыжок</strong><p>Нажми ↑ ещё раз в воздухе для второго прыжка. Удерживай кнопку, чтобы прыгнуть выше. Коснись стены и нажми ↑: герой оттолкнётся. Чередуй стены, чтобы забраться наверх.</p></div><div><strong>ПРОБЕЛ — атака · ↓ Рывок</strong><p>Квирел бьёт посохом по кругу, Урмаса — клинками перед собой. Рывок помогает пройти сквозь опасность. Пробел рядом со Старейшиной начинает разговор.</p></div><div><strong>Пять жетонов</strong><p>Исследуй верхние тропы. Успокой стража, забери последнего жетона и дойди до врат.</p></div><div><strong>Тёплые огоньки сохраняют путь</strong><p>Отдохни у огонька в середине уровня. После падения ты вернёшься к нему. Жетоны всегда остаются с тобой.</p></div><div><strong>Можно играть на iPad</strong><p>Используй экранные стрелки, прыжок, рывок и меч. Удерживай направление и нажимай прыжок или атаку другим пальцем. От стен можно прыгать той же кнопкой ↑.</p></div><div><strong>Твоё приключение, твой темп</strong><p>Спокойный режим даёт больше сердец и времени между ранениями. Escape или ☰ в углу экрана — меню и пауза. M — карта.</p></div></div>${modeSetting()}<div class="modal-actions"><button id="help-done" class="primary-button">Я готов <b>→</b></button></div>`,
  );
  $("#help-done").onclick = () => closeModal();
  bindMode();
}
function showMap() {
  showModal(
    "map",
    `<div class="eyebrow">РАЗНЫЕ ЗЕМЛИ. ОДНО КОРОЛЕВСТВО.</div><h2 id="modal-title">Атлас странника</h2><p>Чтобы открыть следующий путь, найди пять жетонов и дойди до врат. В открытые земли можно вернуться.</p>${game?.running ? (game.world.town ? townMapMarkup(game) : regionMapMarkup(game)) : ""}<details><summary>Оригинальная карта-подсказка · содержит расположение тайн</summary><img class="map-image" src="/assets/world-secrets.webp" alt="Карта королевства с шестью землями"></details><div class="map-regions"><button id="map-town">⌂ Древоград</button>${REGIONS.map((r, i) => `<button data-travel="${i}" ${unlocked(i) ? "" : "disabled"}>${progress.cleared.includes(i) ? "✓" : unlocked(i) ? "✦" : "◇"} ${r.name}</button>`).join("")}</div>`,
  );
  $("#map-town").onclick = startTown;
  document.querySelectorAll("[data-travel]").forEach(
    (b) =>
      (b.onclick = () => {
        if (game?.running) game.persist();
        start(Number(b.dataset.travel));
      }),
  );
}
function regionPreview(i) {
  const r = REGIONS[i];
  showModal(
    "region",
    `<div class="eyebrow">ГЛАВА ${r.chapter}</div><h2 id="modal-title">${r.name}</h2><img class="map-image" style="max-height:250px;object-fit:cover" src="/assets/region-${i}.webp" alt="${r.name}"><p>${r.subtitle}. Пройди предыдущую главу «${REGIONS[i - 1].name}», чтобы открыть этот путь.</p><button id="preview-close" class="primary-button">Приключение ждёт <b>→</b></button>`,
  );
  $("#preview-close").onclick = () => closeModal();
}
function showComplete(region) {
  const last = region === 5;
  showModal(
    "complete",
    `<div class="eyebrow">${last ? "ШЕСТЬ ЗЕМЕЛЬ. ОДИН СМЕЛЫЙ ГЕРОЙ." : "ОТКРЫТ НОВЫЙ ПУТЬ"}</div><h2 id="modal-title">${last ? "Ты вернул королевству жизнь." : "Чуть смелее. Чуть светлее."}</h2><p>${last ? "Все жетоны найдены. Все стражи успокоились. Твоя история стала частью королевства. Возвращайся в любимые земли, когда захочешь." : `Пять огоньков сияют в земле «${REGIONS[region].name}». За вратами ждёт следующая глава: ${REGIONS[region + 1].name}.`}</p><div style="color:var(--gold);font-size:35px;letter-spacing:15px;margin:24px 0">✧ ✧ ✧ ✧ ✧</div><div class="modal-actions"><button id="next-chapter" class="primary-button">${last ? "Исследовать королевство" : "Вперёд: " + REGIONS[region + 1].name}<b>→</b></button><button id="complete-home" class="secondary-button">Отдохнуть в лагере</button></div>`,
  );
  $("#next-chapter").onclick = () => (last ? showMap() : start(region + 1));
  $("#complete-home").onclick = startTown;
}
async function startTown() {
  if (game?.running) game.persist();
  await start(progress.region, true);
}
function showResident(n) {
  const status = residentProgress(n, progress),
    reward = n.service || n.quest;
  if (["neli", "sola", "keeper"].includes(n.id)) {
    game.player.health = game.maxHealth();
    game.updateHud();
  }
  showModal(
    "resident",
    `<div class="resident-dialog"><img src="/assets/npc-${n.sheet}-${n.row}.webp" alt="${n.name}"><div><div class="eyebrow">${n.role} · ${n.home}</div><h2 id="modal-title">${n.name}</h2><p>${n.text}</p>${reward ? `<p>${status.done ? "✓ Дар уже с тобой" : `${status.count} / ${n.need} · ${status.ready ? "Можно получить награду" : "Продолжай исследовать"}`}</p>` : ""}<div class="modal-actions">${reward && !status.done ? `<button id="resident-reward" class="primary-button" ${status.ready ? "" : "disabled"}>Принять дар</button>` : ""}<button id="resident-done" class="secondary-button">Продолжить прогулку →</button><button id="resident-map" class="text-button">Карта королевства</button></div></div></div>`,
  );
  const b = $("#resident-reward");
  if (b)
    b.onclick = () => {
      if (!residentProgress(n, progress).ready) return;
      const key = n.service ? "services" : "quests";
      progress[key] = [...new Set([...progress[key], reward])];
      game.progress = progress;
      game.player.health = game.maxHealth();
      save();
      game.updateHud();
      showResident(n);
    };
  $("#resident-done").onclick = () => closeModal();
  $("#resident-map").onclick = showMap;
}
function showGrowth() {
  const g = growth(progress);
  showModal(
    "growth",
    `<div class="eyebrow">ЖЕТОНЫ МУХ — ТВОЙ РОСТ</div><h2 id="modal-title">Уровень ${g.level} · ${LEVELS[g.level - 1][0]}</h2><p>Общий путь Квирела и Урмасы: ${g.flies}/30 жетонов · ${g.secrets}/30 тайн. Каждые пять жетонов и каждые десять тайн дают уровень. Найденное сохраняется навсегда.</p><div class="token-types">${TOKEN_TYPES.map((t, i) => `<article><img src="/assets/token-type-${i}.webp" alt=""><h3>${t.name}</h3><p>${t.description}</p><small>${Object.values(progress.tokens).filter((a) => a.includes(i)).length} / 6</small></article>`).join("")}</div><ol class="growth-list">${LEVELS.map(([name, description], i) => `<li class="${i < g.level ? "earned" : ""}"><strong>${i + 1}. ${name}</strong><span>${description}</span></li>`).join("")}</ol><p>Улучшения города: ${progress.services.length}/6 · Поручения жителей: ${progress.quests.length}/4</p>`,
  );
}
$("#town-menu").onclick = startTown;
$("#growth-menu").onclick = showGrowth;
$("#bestiary-menu").onclick = () => showBestiary();
$("#heroes-menu").onclick = showHeroes;
$("#start").onclick = () => start();
$("#help-menu").onclick = showHelp;
$("#map-menu").onclick = showMap;
$("#pause").onclick = showPause;
$("#modal-close").onclick = () => {
  if (modalKind === "complete") goHome();
  else closeModal();
};
document.querySelectorAll(".hero-choice").forEach(
  (b) =>
    (b.onclick = () => {
      selectedHero = Number(b.dataset.hero);
      save();
      updateMenu();
    }),
);
$("#sound").onclick = () => {
  const enabled = sound.toggle();
  $("#sound").textContent = enabled ? "Звук: вкл." : "Звук: выкл.";
  $("#sound").setAttribute("aria-pressed", String(enabled));
  $("#sound").setAttribute(
    "aria-label",
    enabled ? "Выключить звук" : "Включить звук",
  );
};
$("#reset-progress").onclick = showResetProgress;
$("#fullscreen").onclick = async () => {
  $("#fullscreen-status").textContent = "";
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else
      $("#fullscreen-status").textContent =
        "Скрой панель инструментов Safari, чтобы увеличить обзор.";
  } catch {
    $("#fullscreen-status").textContent =
      "Полноэкранный режим недоступен в этом браузере.";
  }
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (e.repeat) return;
    if (!$("#modal").classList.contains("hidden")) {
      if (modalKind === "complete") goHome();
      else closeModal();
    } else showPause();
  }
  if (
    e.code === "KeyM" &&
    game?.running &&
    !/INPUT|SELECT/.test(e.target.tagName)
  ) {
    e.preventDefault();
    if (modalKind === "map") closeModal();
    else showMap();
  }
  if (e.key === "Tab" && !$("#modal").classList.contains("hidden")) {
    const nodes = [
      ...$("#modal").querySelectorAll("button:not(:disabled),select,a[href]"),
    ];
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
const pointerControls = new Map();
document.querySelectorAll("[data-control]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    if (!game?.running || game.paused) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    pointerControls.set(e.pointerId, b.dataset.control);
    b.classList.add("pressed");
    game.press(b.dataset.control);
  });
  const end = (e) => {
    e.preventDefault();
    const control = pointerControls.get(e.pointerId);
    pointerControls.delete(e.pointerId);
    if (![...pointerControls.values()].includes(control))
      game?.release(control);
    b.classList.remove("pressed");
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", end);
  b.addEventListener("lostpointercapture", end);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
});
window.addEventListener("pagehide", () => {
  if (game?.running) game.persist();
  store.flush();
});
window.addEventListener("online", () => {
  store.connect().then(acceptStoreValue);
});
window.addEventListener("storage", (event) => {
  if (event.key !== SAVE_KEY) return;
  try {
    const value = sanitizeProgress(JSON.parse(event.newValue));
    const activeReset = game?.running
      ? game.progress.resetAt
      : progress.resetAt;
    if (value && value.resetAt > activeReset) {
      store.value = value;
      returnToNewJourney(value);
    }
  } catch {}
});
updateMenu();
store.connect().then(acceptStoreValue);
// Read-only diagnostic surface for browser QA; no gameplay mutation hooks in production.
Object.defineProperty(window, "__kingdom", {
  value: {
    snapshot: () => game?.snapshot(),
    performance: () => ({
      fps: game?.renderer.fps,
      canvasPixels: $("#canvas").width * $("#canvas").height,
      particles: game?.particles.length,
    }),
  },
  writable: false,
});
