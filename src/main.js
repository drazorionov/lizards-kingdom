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
      `<button class="region-card ${i === progress.region ? "active" : ""}" data-region="${i}" aria-label="${r.name}${unlocked(i) ? "" : " — locked"}"><img src="/assets/region-${i}.webp" alt="${r.name} landscape"><span class="card-state">${progress.cleared.includes(i) ? "✓" : unlocked(i) ? "✦" : "◇"}</span><span class="card-text"><small>CHAPTER ${r.chapter}</small>${r.name}</span></button>`,
  ).join("");
  const started =
    Object.values(progress.tokens).some((t) => t.length) ||
    progress.checkpoint ||
    progress.cleared.length;
  $("#start span").textContent = started
    ? "Continue your journey"
    : "Begin your journey";
  $("#journey-note").textContent = started
    ? `Chapter ${REGIONS[progress.region].chapter} · ${REGIONS[progress.region].name}`
    : "Your first chapter starts in the Mushroom Forest";
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
      [...Object.keys(manifest), "hero-quirel-atlas-v2", "hero-urmasa-atlas-v2"]
        .filter((k) => !k.startsWith("hero-") || k.endsWith("atlas-v2"))
        .filter(
          (k) =>
            ![
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
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
async function start(region = progress.region) {
  if (!unlocked(region)) region = 0;
  $("#start").disabled = true;
  $("#start span").textContent = "Opening the kingdom…";
  try {
    const assets = await loadAssets();
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
      `<div class="eyebrow">A LITTLE PAUSE</div><h2 id="modal-title">The forest is still waking up.</h2><p>The artwork could not load. Check your connection and try again.</p><button class="primary-button" id="retry">Try again →</button>`,
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
    `CHAPTER ${REGIONS[region].chapter} · ${selectedHero === 0 ? "QUIREL" : "URMASA"}`;
  $("#region-name").textContent = REGIONS[region].name;
  $("#hearts").innerHTML = Array.from(
    { length: maxHealth },
    (_, i) =>
      `<span class="${i < health ? "" : "heart-empty"}">${i < health ? "♥" : "♡"}</span>`,
  ).join("");
  $("#hearts").setAttribute("aria-label", `${health} of ${maxHealth} health`);
  $("#token-count").innerHTML = tokens
    .map(
      (t) =>
        `<span class="token-pip ${t.collected ? "found" : ""}" aria-label="Token ${t.id + 1}: ${t.collected ? "found" : "missing"}">✧</span>`,
    )
    .join("");
  $("#boss-hud").classList.toggle("hidden", !boss.active || boss.dead);
  $("#boss-name").textContent = REGIONS[region].boss;
  $("#boss-health").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  $("#objective").textContent = tokens.every((t) => t.collected)
    ? "Five lights found. Head to the gate →"
    : boss.dead
      ? "The guardian rests. Find the remaining firefly tokens."
      : "Explore the paths. Find all five firefly tokens.";
}
function showModal(kind, html) {
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
  heroShowcase?.stop();
  heroShowcase = null;
  $("#modal").classList.add("hidden");
  modalKind = "";
  if (resume && game?.running) game.resume();
  else modalReturnFocus?.focus();
}
function modeSetting() {
  return `<label class="setting-line">Adventure style <select id="mode"><option value="gentle" ${progress.mode === "gentle" ? "selected" : ""}>Gentle · extra hearts, more time</option><option value="adventure" ${progress.mode === "adventure" ? "selected" : ""}>Adventurer · a little more challenge</option></select></label>`;
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
    `<div class="eyebrow">TAKE A BREATH, LITTLE WANDERER</div><h2 id="modal-title">The kingdom can wait.</h2><p>Your collected tokens are safe. Come back when you’re ready.</p>${modeSetting()}<div class="modal-actions"><button id="resume" class="primary-button">Back to the adventure <b>→</b></button><button id="help-pause" class="secondary-button">How to play</button><button id="home" class="secondary-button">Return to camp</button></div>`,
  );
  $("#resume").onclick = () => closeModal();
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
    `<div class="eyebrow">TWO WANDERERS. ONE GREAT ADVENTURE.</div><h2 id="modal-title">Meet your heroes</h2><div class="hero-gallery"><section><canvas width="480" height="420" aria-label="Animated Quirel preview"></canvas><h3>Quirel</h3><span>THE GOLDEN WANDERER</span><p>A steady heart, a weathered cloak, and a staff that has a few stories to tell.</p></section><section><canvas width="480" height="420" aria-label="Animated Urmasa preview"></canvas><h3>Urmasa</h3><span>THE CRIMSON SPARK</span><p>Quick on his feet, curious at heart. A flash of crimson on the path ahead.</p></section></div><div class="hero-preview-modes" role="group" aria-label="Preview hero movements"><button data-motion="idle" aria-pressed="true">Stand</button><button data-motion="walk" aria-pressed="false">Walk</button><button data-motion="jump" aria-pressed="false">Jump</button></div><p id="hero-preview-status" class="hero-preview-status">Waking up the wanderers…</p>`,
  );
  try {
    const assets = await loadAssets();
    if (modalKind !== "heroes") return;
    heroShowcase = new HeroShowcase(
      [...document.querySelectorAll(".hero-gallery canvas")],
      assets,
    );
    $("#hero-preview-status").textContent =
      "Choose a movement to see both heroes in action.";
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
        "The artwork could not load. Please reopen this preview to try again.";
  }
}
function showHelp() {
  showModal(
    "help",
    `<div class="eyebrow">A FEW THINGS BEFORE YOU WANDER</div><h2 id="modal-title">Small steps. Brave adventures.</h2><div class="help-grid"><div><strong>← → Move · ↑ Jump</strong><p>Press up again in the air for a double jump. Hold a little longer to jump higher.</p></div><div><strong>SPACE Attack · ↓ Dash</strong><p>Face a creature and swing your weapon. Dash through danger. Space also talks to the Elder.</p></div><div><strong>Five firefly tokens</strong><p>Explore the high paths. Calm each guardian to reveal the last token, then reach the gate.</p></div><div><strong>Warm lights keep you safe</strong><p>Rest at the glowing light halfway through each land. Falling returns you there. You never lose tokens.</p></div><div><strong>Made for iPad, too</strong><p>Use the on-screen arrows, jump, dash, and sword buttons. Hold a direction while tapping jump or attack.</p></div><div><strong>Your adventure, your pace</strong><p>Gentle mode gives extra hearts and more time between hits. Escape pauses. M opens the map.</p></div></div>${modeSetting()}<div class="modal-actions"><button id="help-done" class="primary-button">I’m ready <b>→</b></button></div>`,
  );
  $("#help-done").onclick = () => closeModal();
  bindMode();
}
function showMap() {
  showModal(
    "map",
    `<div class="eyebrow">DIFFERENT LANDS. ONE KINGDOM.</div><h2 id="modal-title">The wanderer’s atlas</h2><p>Open each path by finding its five tokens and reaching the gate. Revisit any unlocked land.</p><img class="map-image" src="/assets/world-map.webp" alt="Original illustrated kingdom map with six connected regions"><div class="map-regions">${REGIONS.map((r, i) => `<button data-travel="${i}" ${unlocked(i) ? "" : "disabled"}>${progress.cleared.includes(i) ? "✓" : unlocked(i) ? "✦" : "◇"} ${r.name}</button>`).join("")}</div>`,
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
    `<div class="eyebrow">CHAPTER ${r.chapter}</div><h2 id="modal-title">${r.name}</h2><img class="map-image" style="max-height:250px;object-fit:cover" src="/assets/region-${i}.webp" alt="${r.name}"><p>${r.subtitle}. Finish ${REGIONS[i - 1].name} to open this path.</p><button id="preview-close" class="primary-button">The adventure awaits <b>→</b></button>`,
  );
  $("#preview-close").onclick = () => closeModal();
}
function showComplete(region) {
  const last = region === 5;
  showModal(
    "complete",
    `<div class="eyebrow">${last ? "SIX LANDS. ONE BRAVE LITTLE HERO." : "A NEW PATH IS OPEN"}</div><h2 id="modal-title">${last ? "You brought the kingdom to life." : "A little braver. A little brighter."}</h2><p>${last ? "Every firefly found. Every guardian calmed. Your story is now part of the kingdom. Revisit your favorite lands whenever you like." : `Five lights shine in ${REGIONS[region].name}. Beyond the gate, ${REGIONS[region + 1].name} is waiting.`}</p><div style="color:var(--gold);font-size:35px;letter-spacing:15px;margin:24px 0">✧ ✧ ✧ ✧ ✧</div><div class="modal-actions"><button id="next-chapter" class="primary-button">${last ? "Explore your kingdom" : "Into " + REGIONS[region + 1].name}<b>→</b></button><button id="complete-home" class="secondary-button">Rest at camp</button></div>`,
  );
  $("#next-chapter").onclick = () => (last ? showMap() : start(region + 1));
  $("#complete-home").onclick = goHome;
}
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
    enabled ? "Turn sound off" : "Turn sound on",
  );
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else if (game?.running)
      toast("Use Safari’s Hide Toolbar for a bigger view.");
  } catch {
    if (game?.running) toast("Fullscreen is unavailable in this browser.");
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
