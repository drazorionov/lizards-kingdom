# Hero motion, version 4

Both playable heroes now use ten distinct painted run frames and ten distinct
painted attack frames. Generated with the built-in `image_gen` tool; final prompts
and refinements are retained in `prompts.json`. Earlier drafts with a fixed rear
leg or reversed facing were rejected. `run-pose-guide.png` records the intended
opposite leg phases: contact, push-off, heel lift, passing knee, and forward reach.

Sources: `quirel-run.png`, `urmasa-run.png`, `quirel-attack.png`,
`urmasa-attack.png`. Original RGBA pixels are retained. The packer only extracts,
resizes and registers artwork; it does not create in-between poses or recolor it.

Rebuild with `python3 scripts/prepare-hero-motion.py`. The normal asset pipeline
also calls this script after rebuilding the legacy character sheets. The packer
checks ten isolated poses, transparent cell gutters, and bounds, and writes:

- `public/assets/hero-quirel-painted-atlas.webp`
- `public/assets/hero-urmasa-painted-atlas.webp`
- `public/assets/heroes-painted.json`
- `src/hero-motion-data.js`

Both atlases use 384px cells in four columns. Frames 0–23 reserve the existing
idle, jump and wall poses (Urmasa's unused 16–23 are blank). Frames 24–33 are the
run loop; 34–43 are wind-up, strike, follow-through and recovery. Attacks use the
same ten poses on the ground and in the air, including Urmasa's attacking dash.
Wide combat silhouettes are rendered with calibrated scale/origin so weapons
fit without shrinking the character. Run phase follows distance travelled and
survives stops and turns. Gameplay collision boxes and attack durations are unchanged.

The hero gallery offers quarter-speed playback, mirroring, and a ten-frame
slider for running and combat. `runtime-contact-sheet.png` is drawn by the actual
game renderer, not directly from the source sheets. Visual review checks leg
articulation, facing, silhouettes, foot baseline, transparency, and weapon bounds.

Validation: `npm test`, `npm run build`, `scripts/hero-qa.mjs`, and
`scripts/hero-motion-qa.mjs`. Browser scripts accept `QA_URL` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` when a system browser is required.
