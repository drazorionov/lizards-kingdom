# Painted creatures

The active cast contains 12 enemy species, six guardians, and the friendly Elder.
Every creature has a transparent 16-pose sheet: idle (0–3), movement (4–7),
anticipation/attack (8–11), hit (12–13), and peaceful defeat/rest (14–15).

All illustrations were generated with the built-in `image_gen` tool. Original
reference designs remain in `inputs/`. `corvid-reference.png` is the user's
specific bird board; `paint-style-reference.png` is the user's final style guide.
The old dragon-like regular bird was discarded. Masked, armored, and red-crested
corvids have feathered wings, ivory masks, two bird legs, and short feather tails.

Exact generation instructions are in `prompts.json`, `extra-prompts.json`,
`style-pass.json`, and `elder-prompt.txt`. The `storm-bat` entry in the first prompt
set documents the superseded concept; it is not used by the game. The final three
extra creatures use the `extra-prompts.json` prompt plus:

> STYLE: Image 2 is the style guide. Match its hand-painted matte illustrative finish, visible brush texture and restrained highlights exactly.

Sources ending in `-painted-source.png` are the final painted versions. The three
corvids already matched the chosen style and use `-v2-source.png`. Earlier sources
are retained for provenance. All selected outputs are saved in this directory.

`python3 scripts/prepare-creatures.py` packs the RGBA poses without recoloring
artwork. It isolates connected sprites, splits occasional one-pixel contacts at
sparse seams, preserves a shared scale, and pads every cell. Creature atlases use
256px cells (1024×1024 WebP). The metadata in `public/assets/creatures.json` records
source bounds and atlas rectangles. The active region's three enemies and guardian
load on demand; the cache retains two recently used regions plus any paused game.

The bestiary uses the same drawing function and frames as gameplay. Flight uses a
four-frame feathered wingbeat. Birds perch, take off, warn, swoop, brake, and settle.
Ranged creatures warn before releasing a projectile; all defeated creatures stop
hurting the player immediately and briefly settle before fading.

Russian names follow the supplied boards. Region order is retained for save
compatibility even though the original board places the Belfry after the Lake.
