# Continuous walking rig (v5)

The playable heroes now use one stable upper-body image during idle, walking,
and landing, with independently articulated thighs, shins and feet. The cape
and tail sway slightly behind both legs. Combat, jumps and wall poses retain
the existing painted action atlas.

`quirel-parts.png` and `urmasa-parts.png` were generated with the built-in
image_gen tool using the established character portraits as identity references.
The exact prompts are in `prompts.json`. Each source has six disconnected
components: torso/arms/weapon, thigh, shin, foot, tail, and cape. Packing preserves
the source alpha and colors, with no generated in-between full-body pictures.

The active legs come from `quirel-legs-v7.png` and `urmasa-legs-v7.png`, generated
with built-in image_gen (prompts in `leg-prompts-v7.json`). Each hero has six
distinct pieces: near thigh/shin/foot and far thigh/shin/foot. The thigh owns the
visible kneecap; the shin socket rotates behind it at the same pivot. Greave
width is fitted perpendicular to the bone without moving the joint endpoints.
The far hip remains beneath the back of the pelvis. Both leg chains draw
separately, from foot to shin to thigh, before the torso covers the hips.
Both thighs are authored in the same forward-facing profile; no individual limb
reflection is needed. The former v6 artwork remains as source history.
Both feet render 20% larger for a fuller silhouette relative to the torso. The
ankle height, pelvis registration and heel/toe contact offsets scale together,
keeping the soles grounded and the legs upright.

`python3 scripts/prepare-hero-rig.py` rebuilds the two runtime
`public/assets/hero-*-walk-rig-v5.webp` atlases and `src/hero-rig-data.js`.
Each atlas now packs nine parts in a 3-by-3 grid: body, tail, cape, and six leg pieces.
The normal `npm run assets` pipeline includes this step.

`src/hero-walk-rig.js` contains ten authored foot targets with continuous cubic
interpolation. Contact, load, support, toe-off, flight, heel recovery, fold,
passing, extension and lowering form one full running cycle. During stance,
the rolling heel/toe contact cancels player travel at steady speed. The ankle
rises around the toe at push-off, then the heel folds behind the knee. Opposite
legs are half a cycle apart. Two-bone inverse kinematics keeps
leg lengths fixed. The longer legs and raised pelvis give the resting pose nearly
straight knees, with ankles directly beneath the hips. Running uses up to 26
world pixels of recovery clearance, a restrained 2.5-pixel pelvis excursion,
and a small forward torso lean. Starting/stopping eases the
geometry over roughly 80 ms; it never dissolves the character. Mirroring and the
existing movement speed, collision dimensions, attack cadence and saves remain.
Run cadence is 1.10 times the original rate: the cycle covers 100 world units
instead of 110. Horizontal foot travel shortens by the same ratio to avoid sliding.

Invulnerability uses a steady warm tint instead of toggling hero opacity. Tinted
rig parts are cached once, avoiding repeated color filters on rotating sprites.
Far legs use darker colors at full opacity. Hip cloth covers the rounded joints;
the long cloak renders behind the feet.

Validation covers world-relative foot planting, pose continuity across all ten
keys and the wrap, bone lengths, clearance, start/stop easing, alpha, and browser
silhouette continuity. `scripts/hero-rig-qa.mjs` exercises the gallery controls and
captures `contact-sheet.png` and the resting alignment in `standing-preview.png`;
`scripts/hero-qa.mjs` tests gameplay and pause.
`run-anatomy.png` overlays near (mint) and far (orange) joint chains on the ten
poses. `scripts/record-hero-rig-preview.mjs` captures `running-preview.webm`, showing
continuous running, stops and reversals with moving ground markers.

## Running references reviewed

- [AnimSchool: The Key Poses of a Run Cycle](https://blog.animschool.edu/2024/04/10/the-key-poses-of-a-run-cycle/)
  includes the contact/down/push/peak breakdown, a side-view seven-pose storyboard,
  and footage of a runner. The reference informed heel recovery, forward knee
  swing, a modest landing reach and flight between alternating contacts.
- [Souza: An Evidence-Based Videotaped Running Biomechanics Analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC4714754/)
  distinguishes terminal swing, initial contact and loading response. These are
  kept as distinct moments in the authored cycle rather than one flat-foot pose.

The curves are a stylized game adaptation, not motion-capture measurements.
Tests check the forward knee-bend branch, heel recovery, flight, grounded contact
travel, segment lengths, opacity at joints, and smooth start/stop transitions.

The browser scripts accept `QA_URL` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
