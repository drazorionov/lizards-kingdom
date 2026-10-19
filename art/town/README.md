# Drevograd painted settlement

Generated with the built-in `image_gen` tool. The cover, original town painting, forest canopy and forest ledges supplied the style references: detailed dark fantasy, weathered stone and timber, amber lamps, cool mist, and organic vegetation. The initial geometric town artwork has been replaced completely.

## Artwork

- `tree-source.png`: ancient tree, roots, rocky escarpments, waterfalls and distant gothic skyline.
- `homes-source.png`: twelve transparent NPC buildings in reading order: guard, forge, mercenary lodge, inn; apothecary, herbalist, spring, training pavilion; family home, observatory, council hall, hermit hollow.
- `platforms-source.png`: four transparent walking surfaces: reinforced bough, stone terrace, timber bridge, stone step.
- [prompts.json](prompts.json): exact final prompts, including layout and style constraints.

`python3 scripts/prepare-town-assets.py` preserves the source paintings and alpha, creates optimized WebP assets in `public/assets/town-*-painted.webp`, and records sprite bounds and walking-surface offsets in `src/town-art.json`. The generated sheets have authored row divisions; these are recorded explicitly to avoid slicing neighboring roofs into another home. `npm run assets` includes this compiler.

The scene renderer draws the homes behind their corresponding residents and aligns the painted walkways with the physics geometry in `src/town.js`. The four-level route, NPC interactions, service rewards and saves are independent of the artwork. Buildings are outdoor scenery; entering interiors and NPC schedules are not implemented.
