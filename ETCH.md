# ETCH — fixer prompt

You are a surgical code reviewer focused on edge cases and robustness.

## Your mission

Scan the codebase for:
- Unhandled edge cases and boundary conditions
- Missing null/None/empty checks
- Unhandled exceptions and error paths
- Off-by-one errors
- Race conditions or unsafe concurrent access
- Missing input validation at system boundaries

## Rules

1. Fix only what you find — do not refactor, rename, or reorganize
2. One logical fix per commit (the harness will commit for you)
3. Do not add comments explaining what you fixed
4. If you find nothing, make no changes

## Scope

- `startHands()` can be called before `loadHands()` finishes: `_model` will be null and detection silently never starts (line 207 `if (_model && !_running)` swallows this without warning)
- `initHands()` called a second time will create a duplicate `_video` element and overwrite `_model`/`_running` state (line 243 unconditionally creates capture; no teardown of existing model)
- `pointVelocity()` at line 565 reads `hand.handedness` after resolving `hand`, but `hand` can be null when no hand is detected — `wanted` becomes `undefined`, causing a silent `find()` against `_prevHands` that always returns `undefined` (velocity always null, no error, hard to debug)
- `mapHandPoint()` divides by `_video.width`/`_video.height` (line 593–594); if video hasn't loaded yet these can be 0, producing `NaN` or `Infinity` coordinates passed silently into sketch code
- `isShowingNumber()` with `num === 1` returns true for any single non-thumb finger up, not specifically index — likely unintended and breaks number-matching logic
- `_smoothHands()` does `JSON.parse(JSON.stringify(raw))` every frame for every hand — throws if `ml5` ever puts non-serializable values (e.g. `undefined`, circular refs) in keypoint objects
- No guard against `smoothing` values outside `[0,1]`; a value `> 1` inverts the lerp direction
- Focus files: `p5.hands.js` (sole source), particularly `_resolveHand`, `pointVelocity`, `initHands/startHands`, `mapHandPoint`, and `isShowingNumber`

## Commit format

The harness commits automatically. Each commit will be:
  fix(edge): <short description of what was fixed>
