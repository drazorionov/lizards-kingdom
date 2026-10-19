# Lizards Kingdom

A browser arcade platformer for desktop keyboards and iPad, using the supplied Lizards Kingdom visual designs, with a painted animated cast and the original token, map, and cover artwork. The interface is in Russian, using names from the supplied boards. Six distinct region layouts, two heroes, 12 enemy species, six bosses, double jumps, wall slides and wall jumps, dash, melee combat, five collectible tokens per chapter, warm-light checkpoints, and forgiving retries.

**Play:** https://lizards-game.vercel.app

## Controls

| Action            | Keyboard                       | iPad                       |
| ----------------- | ------------------------------ | -------------------------- |
| Move              | Left / right arrows (or A / D) | Left / right buttons       |
| Jump, double jump | Up arrow (or W), twice         | Jump button, twice         |
| Wall jump         | Up while touching a wall       | Jump while touching a wall |
| Attack / talk     | Space (hold to repeat attacks) | Sword button               |
| Dash              | Down arrow (or S)              | Dash button                |
| Pause             | Escape                         | Pause button               |
| Map               | M                              | Map button                 |

Gentle mode is the default: seven hearts and longer protection after damage. Adventurer mode starts with five. Every two completed chapters adds a heart (up to two extra) and stronger attacks. Collected tokens survive falls and defeat. The forest guardian alternates marked root eruptions, arcing spores, burrowing and ground sweeps, then awakens at half health. The other guardians announce their shockwaves; jump at the “ПРЫГАЙ!” cue. Find all five tokens and reach the far-right gate to unlock the next region. Landscape tablet use is recommended; narrow phone layouts intentionally show a device notice.

## Forest pilot

The first chapter follows the supplied forest level board as a continuous 4550 × 1600 world: eight named areas, a lower root tunnel, an alternating wall-jump shaft, a breakable secret entrance, a return shortcut, a save-point hub and an ascent to the Forgotten Tree. A live minimap and the M / Map panel show the actual collision layout and token positions. Four names come directly from the world board; the connecting chamber names are new.

The Spore Mother has four attack timelines, a half-health awakening, 24 additional painted animation poses and explicit warning/recovery windows. In the pause menu, «Снова сразиться со Споровой матерью» starts a rematch while preserving collected tokens and unlocked regions. Existing Neon saves remain compatible. Discovery tint and broken root walls last for the current visit.

Three HD backdrop paintings, eight transparent ledge variants and a root/stone texture replace the first region's enlarged atlas tile. Sources, regional design study and exact generation prompts are in `art/forest/`; `scripts/prepare-forest.py` reproduces the optimized WebP assets. The other five regions retain their existing levels and encounters for subsequent pilots.

Forest terrain is built from **passages → solid earth → exposed perimeter → narrow skins → compact joins**. `FOREST_PASSAGES` describes the open rooms and tunnels; `carveCaverns` computes their solid complement, with stepped curved turns. That same solid geometry drives collision and the map. The renderer first fills the solid union near-black, merges adjacent exposed edges, and dresses floors, ceilings and both wall faces independently. No texture is tiled through the buried interior.

Each surface skin reaches at most 36 world pixels inward, or 38% of the distance to an opposing face. A 55-pixel wall therefore has two 20.9-pixel skins and a dark center at least 13.2 pixels wide; the same rule applies to thin roofs. A smooth fade hides the inner texture edge. Eight compact variants per inner/outer corner are selected by world coordinates; right-hand joints mirror their left-hand counterparts. Joints share the skin depth mask, so they cannot brighten a thin wall's center. Breaking a barrier invalidates the boundary and material caches. This geometry/material split can support another biome by replacing the four atlases without changing collision.

The four active skin atlases, generated with built-in image generation, are `art/forest-caverns/{edges,walls,joins-floor,joins-ceiling}-v2-source.png`; exact prompts are in `art/forest-caverns/skin-prompts.json`. `scripts/prepare-cavern-assets.py` preserves generated transparency and records sprite planes/anchors. `scripts/forest-cavern-qa.mjs` checks both textured faces and black centers of thin walls/roofs, compact joins, all forest chambers and destructible-wall phases.

## Development

Requires Node 20.19+ (Node 22 recommended).

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run dev` serves the client on port 5173. It intentionally uses local saves when the Vercel API is unavailable. For local cloud API testing, use `vercel dev` with the linked environment.

## Neon saves

The Vercel project `lizards-game` is connected to the Neon resource `lizards-kingdom-db` (free plan, Frankfurt). `DATABASE_URL` is server-only. The API stores one small JSON progress document per anonymous browser journey. No child's name, email, analytics, or public leaderboard is collected.

```sh
vercel env pull .env.local
npm run db:migrate
```

The migration creates the `journeys` table idempotently. `/api/progress` supports GET and PUT. A random HttpOnly, Secure, SameSite cookie identifies a journey; only its SHA-256 hash is stored in Postgres. Parameterized queries, request-size limits, same-origin writes, validation, and timestamp checks protect saves. Cloud writes are debounced; a localStorage copy is written immediately. Offline cloud writes retry when connectivity returns. Saves belong to a browser profile; cross-device account synchronization is not implemented. Clearing browser storage starts a new anonymous journey.

Never commit `.env.local`, `.vercel/`, or database credentials.

## Artwork

- `inputs/`: supplied JPG boards, retained as source material.
- `scripts/prepare-assets.py`: reproducible sprite-region extraction, edge-connected matte removal, and WebP optimization (Python + Pillow).
- `public/assets/manifest.json`: exact source/crop provenance for every optimized asset.
- `art/environment-atlas.png`: generated environment extension matching the supplied world map; see [art notes](art/README.md) for the exact prompt and method.
- Both heroes, all 12 enemy species, six guardians, and the Elder use detailed painted transparent animation sheets. Quirel has 24 poses, including her double-bladed staff sweep and wall kick. Enemy cast members have 16 poses; every guardian now has 24 additional attack/awakening/recoil/defeat poses. See [character notes](art/characters/README.md) and [creature notes](art/creatures/README.md) for exact prompts and references.
- `scripts/prepare-creatures.py` packs the active sprites. Open «Познакомиться с героями» or «Бестиарий» from camp to inspect animation states.
- Each level has an authored platform route, a wall-jump shaft, three enemy species, and regional scenery details. Corvids match the user's masked feathered bird reference.

No Hollow Knight art, music, characters, or code is included. Exploration, close-range combat, double jumps, checkpoints, and atmospheric regional progression are the mechanical inspiration.

## Rendering and performance

Vanilla ES modules and Canvas 2D; no UI framework or game engine runtime. Fixed 60 Hz simulation, bounded catch-up time, cached background and platform textures, camera culling, at most 100 particles, capped device pixel ratio (1.6) and 1.5-million-pixel canvas budget, event-driven HUD changes, and WebP textures. All six tall regions draw only visible terrain tiles and never allocate a full-world scenery canvas. Regional art and creature atlases use a bounded recent-region cache. Common assets decode before play; creature sheets load by region with a bounded recent-region cache. The render loop suspends simulation on pause or when hidden. Audio is procedural and opt-in. Fonts are self-hosted.

Measured desktop Chromium rendering was approximately 60 fps during the smoke test; this is not a guarantee for every device. iPad layout, touch controls, and WebKit are covered by browser checks; physical iPad hardware has not been tested.

## Verification

`npm test` exercises the production physics and input loop, including replayed production-input routes for a full five-token traversal and boss defeat in every chapter, alternating wall kicks for both heroes, bird wingbeat/attack states, ranged-enemy telegraphs, directional versus circular attacks, one-way platforms, falling and checkpoint recovery, boss telegraphs, progression separation, and offline/cloud save merging.

```sh
npx playwright install chromium webkit
node scripts/browser-qa.mjs
node scripts/webkit-qa.mjs
node scripts/hero-qa.mjs
node scripts/creature-qa.mjs
node scripts/forest-qa.mjs
node scripts/expansion-qa.mjs
node scripts/expansion-scene-qa.mjs
```

Run the dev server first. `forest-qa.mjs` imports production modules into an isolated local test fixture for full traversal screenshots and all boss timelines; run it against the dev server. The other browser scripts also support deployed builds. Set `QA_URL` to test another deployment. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` / `PLAYWRIGHT_WEBKIT_EXECUTABLE` variables reuse an existing browser installation. QA screenshots are written to the system temporary directory.

## Deployment

```sh
npm test
npm run build
git push origin main
vercel --prod --yes
```

Deploy through the Vercel CLI. Automatic GitHub deployments require the repository owner to add a GitHub Login Connection in Vercel; the initial direct deployment does not depend on that connection.

## Six-region expansion

The new world follows the supplied six-region and 30-secret board. Each area is 4550 × 1600 world units with eight named rooms, a distinct initial route, shared readable wall-jump and return-path conventions, a sealed chamber, five collectible types and five optional numbered secrets. The belfry includes crumbling ledges that respawn. Lower passages connect the marsh to the depths, the depths to the lake, and the lake to the forest. These hidden links can open a region earlier than the main sequence.

Drevograd is a four-level settlement wrapped around an ancient tree growing through rock. The ancient-tree backdrop, twelve NPC buildings and walkways use detailed painted dark-fantasy assets matching the cover and level art (sources and exact prompts: `art/town/README.md`). Twelve animated residents have named homes and workplaces: the root-level forge and travellers’ quarter, market and healing gardens, residential branches, and the elder’s crown terrace. Connected 90-pixel climbing steps form a switchback route; the camera follows both axes and the town map shows every resident at their actual elevation. Space or the touch action button talks to the nearest resident. Six permanent services affect weapon damage, health, map hints, attack cooldown, springs and boss protection. Four discovery quests reward additional hints and spring benefits. No consumable spending or real-money purchases are involved.

Progression is shared between Quirel and Urmasa: `min(10, 1 + floor(tokens / 5) + floor(secrets / 10))`. Thirty tokens and thirty secrets make all ten levels attainable. Each region contains one ordinary, glowing, ancient, cursed and golden token. Cursed tokens require nearby guards to be defeated, golden tokens require the boss, and solid walls block token discovery/collection. Maps remember explored rooms, revealed tokens, discoveries and broken walls. The original reference map is available behind an explicit spoiler disclosure.

Save schema v2 migrates the original localStorage key and existing Neon JSON records without a SQL migration. All added IDs and services are bounded and merged monotonically. Levels and combat stats are derived from discoveries rather than trusted as stored numbers.

`art/expansion/` contains the references, exact built-in image-generation prompts and chosen PNG sources. `scripts/prepare-expansion.py` packs the runtime WebP sheets and records source bounds. `tests/secret-routes.json` replays all 30 secrets using production keyboard input; no teleportation or debug mutation is needed in those traversal tests. Browser scene QA uses a separate local fixture solely to inspect each rendered animation frame.
