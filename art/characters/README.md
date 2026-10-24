# Main character animation art, version 2

Created with the built-in image-generation tool, using the original progression board and cover illustration as identity/style references. The exact final prompts are in [prompts.json](prompts.json).

## Saved source artwork

- `quirel-v2-source.png`: golden scales, weathered cloak, bronze fittings, fighting staff.
- `urmasa-v2-source.png`: crimson scales, dark cloak, leather harness, twin daggers.

Both are transparent RGBA sheets with 16 detailed poses. Each character keeps a consistent costume and silhouette across the sheet. No background removal or color replacement is performed on these assets.

## Runtime assets

`scripts/prepare-heroes.py` extracts the 16 connected silhouettes from each source rather than cutting at rigid grid boundaries. This preserves tails and weapons that extend across the source's approximate cells. It packs them with transparent padding and a registered hip/foot origin into a 1536 × 1536 WebP atlas (384 × 384 cells), preserving the same scale for every pose. Two character atlases total about 1.06 MiB compressed. The original source PNGs remain in this directory and are excluded from Vercel deployment.

- `public/assets/hero-quirel-atlas-v2.webp`
- `public/assets/hero-urmasa-atlas-v2.webp`
- `public/assets/hero-quirel-portrait-v2.webp`
- `public/assets/hero-urmasa-portrait-v2.webp`
- `public/assets/heroes-v2.json`: source bounds, pose registrations, and frame rectangles.

## Animation mapping

| Frames | Use                                                     |
| ------ | ------------------------------------------------------- |
| 0–3    | Breathing idle, played forward and back                 |
| 4–11   | Eight-frame walk cycle, advanced with movement distance |
| 12     | Takeoff anticipation and landing crouch                 |
| 13     | Rising jump; also reused for a dash                     |
| 14     | Jump apex                                               |
| 15     | Falling, feet ready for landing                         |

Jump selection follows the actual vertical velocity; walking frames never play in the air. Double jumps restart the takeoff sequence. Attacks reuse a detailed stance with weapon-arc follow-through. Left-facing sprites mirror around the same registered feet position. All animation updates use the existing fixed simulation step and stop on pause. Collision dimensions, movement speeds, save data, enemies, and bosses are unchanged.

The “Meet the wanderers” preview uses the same atlases, animation controller, and drawing function as the game. The old hero extracts remain as source-history assets but are no longer loaded for gameplay.

## Painted reference update

The active character assets now use `quirel-painted-source.png` and
`urmasa-painted-source.png`, generated through the built-in image tool. Quirel's
new identity reference is `quirel-reference.png`, supplied by the user. The exact
24-pose generation prompt is `quirel-v3-prompt.txt`; the shared painted style
transfer prompt and targets are in `../creatures/style-pass.json`.

Quirel retains her lean golden reptile anatomy, dark scarf, leather harness, long
tail, and a single staff with a curved blade at each end. Her first 16 frames cover
idle, gait and jumps; frames 16–19 are a circular two-ended staff attack; 20–23
are wall cling, wall kick, double-jump twist, and airborne attack. The staff sweep
hits on both sides with a slower cadence than Urmasa's forward dagger attack.

`prepare-creatures.py` packs both active heroes into padded 384px cells and writes
`heroes-painted.json`. The older hero sheets and their original packer remain for
provenance, but are no longer downloaded by the game. Both heroes can wall-slide
and wall-jump, with the same physics and stable collision boxes. The gallery also
previews attacks and wall poses.

## Ten-frame motion update (active)

Both playable heroes now use ten run poses (24–33) and ten combat poses (34–43).
The old eight-frame gait and four-frame/reused-stance attacks are superseded.
See [motion-v4/README.md](motion-v4/README.md) for reviewed source artwork,
registration, rebuilding, and the slow-motion/frame inspection controls.

## Continuous walking rig (active)

Idle and walking now use stable layered artwork with continuously interpolated
leg joints. Ten foot key poses replace the rapidly changing full-body walking
images. See [walk-rig-v5/README.md](walk-rig-v5/README.md) for the source parts,
rendering details, tests, and continuous-motion preview. Combat still uses the
v4 ten-pose painted sequences.
