# Shred Or Dead 2D Parallel Build Handoff

## Branch
Use this parallel branch:

```bash
git fetch origin
git checkout parallel/2d-mainline-fun-pass-2026-04-29
```

This branch is intentionally separate from `main` so the current public-facing build is not overwritten.

## Goal
Review the current 2D mainline build and implement the highest-impact opportunities to increase overall game fun. Treat FUN as the core metric: quicker delight, stronger "one more run" pull, clearer skill expression, and more satisfying moment-to-moment feedback.

Do not restart the game around 3D. Keep the existing 2D architecture and add small, focused systems.

## Current Build State
The updated 2D build is in the repo root:

```bash
npm install
npm run qa
npm start
```

You can also open `index.html` directly. The custom music file is `assets/music/shredordead.mp3`.

Important recent updates included in this branch:

- 2D gameplay visual atmosphere pass: synthwave sky, static top horizon mountains, slope texture, map palettes.
- Wider playfield and improved lateral room.
- Performance pass: capped lane simulation density, capped non-fullscreen internal render size, moved neon canvas glow to a static wrapper.
- Custom music startup hardening for preview/autoplay behavior.
- Trick input agency: preload jump, directional spin intent, release-to-stabilize behavior layered over auto-tricks.
- Trick landing juice: scalable particles, flash, shake, brief slow-mo, haptics where available.
- Guided tutorial updates with touch-specific prompts.
- Terrain fairness guard and safer opening stretch.
- Beast telegraph/escape reward work.
- Progression wiring: daily reset helper, ghost replay fix, achievements/cosmetics loop visibility.
- Deterministic QA smoke script at `scripts/qa-smoke.mjs`.

## Current Verification
Latest verification before handoff:

```bash
npm run qa
```

Expected result:

```text
QA smoke passed for mobile, 720p, 1080p, daily reset, and 15-second survivability.
```

Also verify manually at:

- `390x844`
- `1280x720`
- `1920x1080`

Check menu, gameplay, daily challenge, game over, first 15 seconds, music, ghost replay after a best run, and mobile fill.

## Top 10 Fun Opportunities

1. **Make trick lines deliberate, not accidental.**
   Add authored or semi-authored "trick lanes": ramp into landing zone, rail after ramp, collectible arc over hazard, jump-to-rail combos. The current features are present, but too much fun depends on random alignment.

2. **Make near-misses a core dopamine loop.**
   Scripted playtests showed near-miss streaks rarely triggering. Tune detection so close dodges are frequent and legible. Add stronger feedback: "THREAD THE NEEDLE," score burst, flow gain, camera pulse, and sound accent.

3. **Turn the Beast into a readable duel.**
   The Beast creates pressure, but escapes should feel earned. Add a clear proximity meter, lunge lane telegraph, stronger dodge window readability, and bigger escape reward. The player should think, "I outplayed it."

4. **Create stronger 30-second pacing waves.**
   Runs currently feel continuous. Add rotating beats: speed slope, trick park, tight forest, breather collectible line, Beast attack. Make each 20-30 second segment feel distinct.

5. **Improve ramp readability and attraction.**
   Ramps are easy to miss at speed. Add neon approach chevrons, subtle shadows, more forgiving hitboxes, and short "preload now" cues when aligned.

6. **Make carving feel skillful, not wall-to-wall.**
   Desktop play can ping-pong to far slope edges. Add soft edge resistance, speed-preserving carve arcs, and "perfect carve" flow bonuses for controlled S-turns.

7. **Keep important hazards out from under the HUD zone.**
   The bottom HUD is stylish but visually dominant. Reserve a safer bottom band or make approaching hazards draw/telegraph above the HUD before they become dangerous.

8. **Give every run a fun mini-goal.**
   Add quick objectives like "land 2 grabs," "dodge 3 close calls," "hit one rail," "escape one Beast lunge." This gives short runs purpose before high-score chasing takes over.

9. **Make post-run motivation more visceral.**
   Game over should sell the next run. Show a progress bar to next unlock, preview the locked map/cosmetic, and name exactly what one more run can earn.

10. **Make maps and daily modifiers change feel, not just rules.**
    Each map should have a different fun verb: Classic = balanced, Backcountry = powder speed, Blizzard = visibility tension, X Games = trick density. Daily modifiers should be obvious from the first seconds of play.

## Recommended Implementation Order

Start with the biggest fun-per-change wins:

1. Trick lane generation.
2. Near-miss tuning and feedback.
3. Beast duel readability.
4. Pacing wave director.
5. Post-run next-unlock presentation.

Keep changes additive. Existing controls, auto-tricks, maps, modes, cosmetics, achievements, localStorage, and ghost data should remain compatible.

## Acceptance Criteria

- A new player finds a jump/rail/close-call reward within the first 20 seconds.
- A skilled player can intentionally chase trick lines and Beast dodges.
- Mobile and desktop both feel readable and fair.
- The first 15 seconds remain survivable across fixed seeds.
- `npm run qa` still passes.
- No regression to custom music playback.
- No regression to static top horizon mountains.
- No push to `main` unless explicitly requested.

## Notes For Claude

- Primary files are `game.js` and `index.html`.
- The smoke test is intentionally lightweight; add focused checks if you change terrain generation, Beast behavior, or progression.
- Prefer deterministic seed hooks for QA instead of relying only on manual play.
- The Codex in-app browser automation backend was unavailable during the last review, so please verify in the actual preview window manually when possible.
