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
