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

Gentle mode is the default: seven hearts and longer protection after damage. Adventurer mode starts with five. Every two completed chapters adds a heart (up to two extra) and stronger attacks. Collected tokens survive falls and defeat. Each boss announces its shockwave; jump at the “ПРЫГАЙ!” cue. Find all five tokens and reach the far-right gate to unlock the next region. Landscape tablet use is recommended; narrow phone layouts intentionally show a device notice.

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
- Both heroes, all 12 enemy species, six guardians, and the Elder use detailed painted transparent animation sheets. Quirel has 24 poses, including her double-bladed staff sweep and wall kick. Other cast members have 16 poses. See [character notes](art/characters/README.md) and [creature notes](art/creatures/README.md) for exact prompts and references.
- `scripts/prepare-creatures.py` packs the active sprites. Open «Познакомиться с героями» or «Бестиарий» from camp to inspect animation states.
- Each level has an authored platform route, a wall-jump shaft, three enemy species, and regional scenery details. Corvids match the user's masked feathered bird reference.

No Hollow Knight art, music, characters, or code is included. Exploration, close-range combat, double jumps, checkpoints, and atmospheric regional progression are the mechanical inspiration.

## Rendering and performance

Vanilla ES modules and Canvas 2D; no UI framework or game engine runtime. Fixed 60 Hz simulation, bounded catch-up time, cached background and platform textures, camera culling, at most 100 particles, capped device pixel ratio (1.6) and 1.5-million-pixel canvas budget, event-driven HUD changes, and WebP textures. Painted scenery is cached. Common assets decode before play; creature sheets load by region with a bounded recent-region cache. The render loop suspends simulation on pause or when hidden. Audio is procedural and opt-in. Fonts are self-hosted.

Measured desktop Chromium rendering was approximately 60 fps during the smoke test; this is not a guarantee for every device. iPad layout, touch controls, and WebKit are covered by browser checks; physical iPad hardware has not been tested.

## Verification

`npm test` exercises the production physics and input loop, including replayed production-input routes for a full five-token traversal and boss defeat in every chapter, alternating wall kicks for both heroes, bird wingbeat/attack states, ranged-enemy telegraphs, directional versus circular attacks, one-way platforms, falling and checkpoint recovery, boss telegraphs, progression separation, and offline/cloud save merging.

```sh
npx playwright install chromium webkit
node scripts/browser-qa.mjs
node scripts/webkit-qa.mjs
node scripts/hero-qa.mjs
node scripts/creature-qa.mjs
```

Run the dev server first. Set `QA_URL` to test another deployment. Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` / `PLAYWRIGHT_WEBKIT_EXECUTABLE` variables reuse an existing browser installation. QA screenshots are written to the system temporary directory.

## Deployment

```sh
npm test
npm run build
git push origin main
vercel --prod --yes
```

Deploy through the Vercel CLI. Automatic GitHub deployments require the repository owner to add a GitHub Login Connection in Vercel; the initial direct deployment does not depend on that connection.
