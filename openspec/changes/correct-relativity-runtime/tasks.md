## Implementation

- [x] Correct and regress physics, emissions, reception and numerical limits.
- [x] Correct fixed-step propulsion, pause/reset and observer selection.
- [x] Correct resource disposal, interrupted controls and initialization errors.
- [x] Build local Three 0.186.1 and lil-gui 0.21.0 with existing tooling.
- [x] Run scoped Jest, ESLint, real-browser tests and OpenSpec validation in Docker.
- [x] Record reproducible findings, verified results and modeling limits.

## Evidence (2026-10-02, dedicated Docker runtime)

- `npm test -- --runInBand --silent --verbose=false tools/relativity-lab`:
  120 tests passed, including real Three vectors, geometries and materials.
- Scoped ESLint passed; `npm run build:relativity-vendors` passed with
  Three 0.186.1 and lil-gui 0.21.0. Wrong installed versions are rejected.
- Nine Playwright cases passed on Chrome 151 via dedicated CDP, with local
  real distributions and no external runtime requests. Coverage includes
  320/390/paysage layouts, native pinch, touch cancellation, real lil-gui
  numeric entry, missing modules, WebGL loss, pause/reset and destruction.
- `openspec validate correct-relativity-runtime --strict --no-interactive`
  passed. This is structural validation, not a claim of delivery approval.
- Offline npm installed the public parent-provided tarballs. The generated
  lock retains their verified SHA-512 integrity and public registry URLs,
  not container-local `file:` paths. Only the two root pins and package
  entries changed; no repository-wide dependency update.

The browser uncovered the lil-gui 0.21 CSS namespace change:
`root/title/children` became `lil-root/lil-title/lil-children`. The scoped
styles and browser assertions now use the actual current classes.

The source review, formulas, reproducible examples and approximation limits
are in `tools/relativity-lab/README.md` and the scoped regression tests.

## Final internal-photon correction

- The parent reproduced a remaining inertial-clock bug: βx=0.6 and
  dtlab=0.1 produced a horizontal photon speed of 1.24c. A triangular
  phase interpolation with reflection at 0.5 was incompatible with
  lab simultaneity after arm contraction.
- The source now shares lab-time photon interpolation between `update`
  and `setLabVelocity`, storing β·e and reflecting at q=L(1+β·e).
  Acceleration remains a documented discrete approximation.
- New real-Three regressions cover both H/V axes, outgoing/returning
  vectors of magnitude c, transverse/oblique velocities with both signs,
  reflection continuity and synchronized 2L ticks.
- [x] Run targeted Docker Jest and ESLint for this final source correction,
  including reset after a velocity change: 44 tests passed (21 new clock
  regressions) in the restored `playlab42-astra-validation` runtime.
  Scoped ESLint passed for `Observer.js` and `Simulation.test.js`.
  No host Node/npm/make validation or dependency installation.
- [x] Parent: strict OpenSpec validation and full browser regressions after
  this correction: 9 scoped Chromium cases passed, then 36 integrated
  cases passed after composing both library builds. Complete Jest:
  70 suites, 1 587 tests passed; lint, types, local build and strict
  OpenSpec validation (20 items) passed in the dedicated Docker runtime.

## Delivery

- [x] Parent/operator review and preparation of a separate pull request
  based on the library branch, with both build hooks composed.
- [x] Publication as PR #126 based on the library PR #125; no merge
  or archive performed. Native Chromium workflow_dispatch run
  37073211009 succeeded on code commit 15d4e4c. Automatic CI targets
  PRs into main and will run again when the base is switched after #125.
