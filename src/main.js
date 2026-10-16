import { forestMapMarkup } from "./forest-renderer.js";
import { CreatureShowcase } from "./creature-showcase.js";
import { CREATURES, REGION_CREATURES, BOSSES } from "./creatures.js";
import { HeroShowcase } from "./hero-showcase.js";
import { REGIONS, sanitizeProgress } from "./world.js";
import { SaveStore } from "./save.js";
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
const unlocked = (i) => i === 0 || progress.cleared.includes(i - 1);
function save(p = progress) {
  progress = { ...p, hero: selectedHero };
  store.update(progress);
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
      ]
        .filter((k) => !k.startsWith("hero-") || k.endsWith("painted-atlas"))
        .filter((k) => !k.startsWith("enemy-") && !k.startsWith("boss-"))
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
    return assets;
  })();
  return assetsPromise;
}
const creatureLoads = new Map();
const loadedRegions = [];
async function loadCreatureAssets(region) {
  const assets = await loadAssets();
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
  return assets;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
async function start(region = progress.region) {
  if (!unlocked(region)) region = 0;
  const serial = ++startSerial;
  $("#start").disabled = true;
  $("#start span").textContent = "Открываем королевство…";
  try {
    const assets = await loadCreatureAssets(region);
    if (serial !== startSerial) return;
    if (!game) {
      const renderer = new Renderer($("#canvas"), assets);
      game = new Game($("#canvas"), assets, renderer, {
        pause: showPause,
        toast,
        sound: (type) => sound.play(type),
        save: (p) => save(p),
        complete: showComplete,
        hud: updateHud,
      });
    }
    closeModal(false);
    $("#menu").classList.add("hidden");
    $("#game").classList.remove("hidden");
    if (progress.region !== region) progress.checkpoint = false;
    progress.region = region;
    progress.hero = selectedHero;
    game.start(region, progress);
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
function updateHud({ health, maxHealth, tokens, boss, region }) {
  $("#chapter-label").textContent =
    `ГЛАВА ${REGIONS[region].chapter} · ${selectedHero === 0 ? "КВИРЕЛ" : "УРМАСА"}`;
  $("#region-name").textContent = REGIONS[region].name;
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
        `<span class="token-pip ${t.collected ? "found" : ""}" aria-label="Светлячок ${t.id + 1}: ${t.collected ? "найден" : "не найден"}">✧</span>`,
    )
    .join("");
  $("#boss-hud").classList.toggle("hidden", !boss.active || boss.dead);
  $("#boss-name").textContent = REGIONS[region].boss;
  $("#boss-health").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  $("#objective").textContent = tokens.every((t) => t.collected)
    ? "Пять огоньков найдены. К вратам →"
    : boss.dead
      ? "Страж отдыхает. Найди остальных светлячков."
      : "Исследуй тропы. Найди всех пятерых светлячков.";
}
function showModal(kind, html) {
  creatureShowcase?.stop();
  creatureShowcase = null;
  heroShowcase?.stop();
  heroShowcase = null;
  if (game?.running) game.pause();
  modalKind = kind;
  modalReturnFocus = document.activeElement;
  $("#modal-content").innerHTML = html;
  $("#modal").classList.remove("hidden");
  requestAnimationFrame(() => $("#modal-close").focus());
}
function closeModal(resume = true) {
  creatureShowcase?.stop();
  creatureShowcase = null;
  heroShowcase?.stop();
  heroShowcase = null;
  $("#modal").classList.add("hidden");
  modalKind = "";
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
  if (!game?.running) return;
  showModal(
    "pause",
    `<div class="eyebrow">ПЕРЕДОХНИ, МАЛЕНЬКИЙ СТРАННИК</div><h2 id="modal-title">Королевство подождёт.</h2><p>Все найденные светлячки сохранены. Возвращайся, когда захочешь.</p>${modeSetting()}<div class="modal-actions"><button id="resume" class="primary-button">Вернуться в приключение <b>→</b></button>${game.world.region === 0 ? '<button id="forest-rematch" class="secondary-button">Снова сразиться со Споровой матерью</button>' : ""}<button id="help-pause" class="secondary-button">Как играть</button><button id="home" class="secondary-button">В лагерь</button></div>`,
  );
  $("#resume").onclick = () => closeModal();
  const rematch = $("#forest-rematch");
  if (rematch)
    rematch.onclick = () => {
      game.rematchMother();
      closeModal();
    };
  $("#home").onclick = goHome;
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
    `<div class="eyebrow">ПЕРЕД НАЧАЛОМ ПУТИ</div><h2 id="modal-title">Маленькие шаги. Смелые приключения.</h2><div class="help-grid"><div><strong>← → Движение · ↑ Прыжок</strong><p>Нажми ↑ ещё раз в воздухе для второго прыжка. Удерживай кнопку, чтобы прыгнуть выше. Коснись стены и нажми ↑: герой оттолкнётся. Чередуй стены, чтобы забраться наверх.</p></div><div><strong>ПРОБЕЛ — атака · ↓ Рывок</strong><p>Квирел бьёт посохом по кругу, Урмаса — клинками перед собой. Рывок помогает пройти сквозь опасность. Пробел рядом со Старейшиной начинает разговор.</p></div><div><strong>Пять светлячков</strong><p>Исследуй верхние тропы. Успокой стража, забери последнего светлячка и дойди до врат.</p></div><div><strong>Тёплые огоньки сохраняют путь</strong><p>Отдохни у огонька в середине уровня. После падения ты вернёшься к нему. Светлячки всегда остаются с тобой.</p></div><div><strong>Можно играть на iPad</strong><p>Используй экранные стрелки, прыжок, рывок и меч. Удерживай направление и нажимай прыжок или атаку другим пальцем. От стен можно прыгать той же кнопкой ↑.</p></div><div><strong>Твоё приключение, твой темп</strong><p>Спокойный режим даёт больше сердец и времени между ранениями. Escape — пауза. M — карта.</p></div></div>${modeSetting()}<div class="modal-actions"><button id="help-done" class="primary-button">Я готов <b>→</b></button></div>`,
  );
  $("#help-done").onclick = () => closeModal();
  bindMode();
}
function showMap() {
  showModal(
    "map",
    `<div class="eyebrow">РАЗНЫЕ ЗЕМЛИ. ОДНО КОРОЛЕВСТВО.</div><h2 id="modal-title">Атлас странника</h2><p>Чтобы открыть следующий путь, найди пять светлячков и дойди до врат. В открытые земли можно вернуться.</p>${game?.running && game.world.region === 0 ? forestMapMarkup(game) : ""}<details ${game?.running && game.world.region === 0 ? "" : "open"}><summary>Карта всего королевства</summary><img class="map-image" src="/assets/world-map.webp" alt="Карта королевства с шестью землями"></details><div class="map-regions">${REGIONS.map((r, i) => `<button data-travel="${i}" ${unlocked(i) ? "" : "disabled"}>${progress.cleared.includes(i) ? "✓" : unlocked(i) ? "✦" : "◇"} ${r.name}</button>`).join("")}</div>`,
  );
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
    `<div class="eyebrow">${last ? "ШЕСТЬ ЗЕМЕЛЬ. ОДИН СМЕЛЫЙ ГЕРОЙ." : "ОТКРЫТ НОВЫЙ ПУТЬ"}</div><h2 id="modal-title">${last ? "Ты вернул королевству жизнь." : "Чуть смелее. Чуть светлее."}</h2><p>${last ? "Все светлячки найдены. Все стражи успокоились. Твоя история стала частью королевства. Возвращайся в любимые земли, когда захочешь." : `Пять огоньков сияют в земле «${REGIONS[region].name}». За вратами ждёт следующая глава: ${REGIONS[region + 1].name}.`}</p><div style="color:var(--gold);font-size:35px;letter-spacing:15px;margin:24px 0">✧ ✧ ✧ ✧ ✧</div><div class="modal-actions"><button id="next-chapter" class="primary-button">${last ? "Исследовать королевство" : "Вперёд: " + REGIONS[region + 1].name}<b>→</b></button><button id="complete-home" class="secondary-button">Отдохнуть в лагере</button></div>`,
  );
  $("#next-chapter").onclick = () => (last ? showMap() : start(region + 1));
  $("#complete-home").onclick = goHome;
}
$("#bestiary-menu").onclick = () => showBestiary();
$("#heroes-menu").onclick = showHeroes;
$("#start").onclick = () => start();
$("#help-menu").onclick = showHelp;
$("#map-menu").onclick = showMap;
$("#map-game").onclick = showMap;
$("#pause").onclick = showPause;
$("#modal-close").onclick = () => {
  if (modalKind === "complete") goHome();
  else closeModal();
};
$(".wordmark").onclick = (e) => {
  e.preventDefault();
  if (game?.running) showPause();
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
  $("#sound").classList.toggle("sound-on", enabled);
  $("#sound").setAttribute(
    "aria-label",
    enabled ? "Выключить звук" : "Включить звук",
  );
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else if (game?.running)
      toast("Скрой панель инструментов Safari, чтобы увеличить обзор.");
  } catch {
    if (game?.running) toast("Полноэкранный режим недоступен в этом браузере.");
  }
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (!$("#modal").classList.contains("hidden")) {
      if (modalKind === "complete") goHome();
      else closeModal();
    } else if (game?.running) showPause();
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
  store.connect().then((value) => {
    if (!game?.running) {
      progress = value;
      selectedHero = value.hero;
      updateMenu();
    }
  });
});
updateMenu();
store.connect().then((value) => {
  if (!game?.running) {
    progress = value;
    selectedHero = value.hero;
    updateMenu();
  }
});
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
