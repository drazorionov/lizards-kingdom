# Eight-frame running correction

Both heroes retain their existing frame count, body scale and original upper-body
artwork. The run still uses atlas cells 4–11. New leg artwork was created with the
built-in image-generation tool; the full prompt set is in `prompts.json`.

The current material pass matches all running legs and feet to the original
upper-body art: subdued ochre for Quirel, brick crimson for Urmasa, matte worn
leather, softer highlights and subtler scale texture. Both the ordinary leg
sheets and the two leaping source poses use this treatment. The prompts are in
`body-material-match-prompts.json` (built-in image tool). Registration, frame
count, playback timing and original upper-body pixels remain unchanged.

The centered-stride revision lowers the forward knees, tucks the recovering
feet back toward the hips, and puts the supporting ankles beneath the torso.
Urmasa uses the same pose reference as Quirel, rendered with his crimson scales
and leather armor. `centered-stride-prompts.json` records these additional image
edits. The selected outputs remain `quirel-legs.png` and `urmasa-legs.png`.
Registration aligns the lowest foot to the original floor baseline (cell y=368)
while retaining each original body and hip destination. No torso is tilted or
resized to compensate for foot placement.

Poses 1 and 5 now show the widest stride: the trailing leg extends backward
instead of folding up, leaving a clear gap between the feet while the front
ankle remains close to the hips. The redundant knee outline in pose 5 was
removed from both heroes. `wide-stride-prompts.json` records these built-in
image edits. Only those two run cells changed; the other six were checked for
pixel equality against the centered-stride revision. Playback tests verify
that both extremes remain visible without skipped frames at 30/60/120 Hz,
in either direction. Each pose lasts five display ticks at 60 Hz at normal speed.

Urmasa's latest material-transfer pass uses the approved Quirel leg sheet as
the geometry reference, matching its thinner calf silhouettes, knee bends,
foot angles and heel recovery instead of the earlier bulkier red-leg version.
`urmasa-geometry-match-prompt.json` records the built-in image-tool prompt.
The red artwork is uniformly fitted at Urmasa's existing scale and registered
to his original hips and floor. Quirel's runtime atlas was verified unchanged
byte-for-byte during this pass. Both heroes retain the same eight-pose cadence.

The leaping-stride revision replaces poses 3 and 7 with a wider front/back leg
spread, as if clearing a small gap on each step. The body stays at its original
height: there is no runtime vertical bounce. Each leg remains connected through
one knee, with both complete feet visible. The other six poses are unchanged.
`quirel-leaping-source.png` and `urmasa-leaping-source.png` supply these two poses;
their wider crop boxes and native-pixel scale conversions are recorded under
`legSource` in `registration.json`, avoiding clipped toes without stretching
the limbs. `leaping-stride-prompts.json` records the built-in image-tool edits.
Tests cover steady body height and uninterrupted display of the contact and
leaping extremes at 30/60/120 Hz in both directions.

`quirel-legs.png` and `urmasa-legs.png` contain the selected eight pairs of legs.
The original run crops and joint guides record the references used. The near and
far legs exchange support and swing roles: contact, support, push-off, raised
heel, opposite contact, opposite support, forward swing, then reach into the loop.
The recovery foot rises behind the body rather than staying planted at the back.

`registration.json` records hip placement, a constant scale for each character,
the old-leg cutouts and the original foreground clothing/weapon regions.
`scripts/prepare-eight-frame-run.py` composites the selected leg art into the
original cells offline. There is no runtime limb rig, morph, opacity blend,
stretching, or extra animation frame. The tail and rear cloak sit behind the
legs; original torso and foreground clothing sit above their hip connections.

The original `hero-*-painted-atlas.webp` files are unchanged. The two new runtime
files are `public/assets/hero-quirel-run-eight-atlas.webp` and
`public/assets/hero-urmasa-run-eight-atlas.webp`. Lossless packing preserves the
original visible pixels in every non-running frame and the first 220 rows of
every run cell (heads, torsos and upper equipment). Lower equipment is retained
through foreground masks; only natural limb occlusion changes overlap.
The renderer selects these variants only while running. Other actions keep the
original atlas, including Urmasa's attack which shares cell 7 with the run.

Run `npm run assets:hero-run` to rebuild and check the output. This is also the
last step of `npm run assets`. The image check confirms frame counts, original
upper-body/non-run pixels, leg changes in all eight cells and padding below feet.
It regenerates `contact-sheet.png` and the eight-frame `running-preview.gif` for
visual review. `node scripts/hero-qa.mjs` checks both heroes in the browser.
