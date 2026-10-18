# Testing

Use Node.js 24 or newer. Install dependencies and browser binaries:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
```

On a fresh Linux machine, use `npx playwright install --with-deps chromium firefox webkit` to install browser system libraries too. CI does this automatically.

## Test layers

| Layer | Location | Coverage |
| --- | --- | --- |
| Unit | `tests/unit/` | Video IDs and trusted URL hosts, time parsing/formatting, loop range validation, session schema, Unicode and legacy links, malformed payloads, size boundaries, immutable defaults, and 300 deterministic generated round trips. |
| HTTP integration | `tests/integration/` | Real server on an ephemeral localhost port; exact asset bodies, MIME/security/cache headers, HEAD/query handling, unsupported methods, private paths and traversal attempts, missing assets, and CLI startup with a custom port and working directory. |
| Browser integration | `tests/browser/app.spec.js`, `editor.spec.js`, `player.spec.js`, `sharing.spec.js` | Real app modules and DOM with a controlled YouTube boundary; editing, focus, loop limits, URL persistence, playback boundaries, buffering, pause, metadata, player reuse, stale callbacks, navigation, timeouts/retry, page lifecycle, share success/cancel/failure, and clipboard fallbacks. |
| End-to-end journeys | `tests/browser/journeys.spec.js` | Build a multi-loop session, copy its URL and open it in a separate page, play/pause and reload it; browser Back/Forward; keyboard activation; offline editing and sharing. |
| Accessibility | `tests/browser/accessibility.spec.js` | Axe scans for WCAG A/AA rules in the initial editor, a loaded/error state, and active playback, plus explicit focus, button state, and iframe title assertions. |
| Responsive layout | `tests/browser/layout.spec.js` | Widths of 320, 390, 768, 1024, and 1440 pixels; no horizontal overflow, controls within the viewport, stacked/wide layouts, visible focus, and reduced-motion behavior. Screenshots are attached for review. |
| Live smoke | `tests/live/` | Real YouTube script loading, iframe embedding, readiness, and enabled player controls. Separate opt-in command; requires internet. |

All default browser specs run in desktop Chromium, Firefox, desktop WebKit, and mobile WebKit with iPhone 13 emulation. Tests do not retry automatically, so intermittent failures are visible. Mobile emulation is not a physical-device test.

Unit tests also exercise the release version guard and Dependabot auto-merge policy with simulated GitHub responses. They verify that major/human/fork/source-code updates, stale PR heads, missing required CI checks, and disabled merge settings cannot issue a merge command. No unit test contacts GitHub or performs a real merge.

The default browser fixture intercepts YouTube's IFrame API and fails on unexpected external requests or uncaught page errors. The fake player models readiness, state changes, seeking, duration, cueing, and destruction. The actual application code is not replaced. Native sharing and clipboard behavior are simulated when a test needs to control OS/browser outcomes. Browser journeys test the whole app, but not the real YouTube streaming service or OS share sheet.

## Commands

| Command | Runs |
| --- | --- |
| `npm run check` | Lint, unit/HTTP coverage gates, and every default browser spec/project. |
| `npm test` | Unit and HTTP integration tests. |
| `npm run test:unit` | State and parsing tests only. |
| `npm run test:integration` | HTTP server and CLI tests only. |
| `npm run test:coverage` | Unit and HTTP tests with enforced coverage thresholds. |
| `npm run test:browser` | All browser specs in all four projects. |
| `npm run test:e2e` | End-to-end journeys in all four projects. |
| `npm run test:a11y` | Automated accessibility scans in all four projects. |
| `npm run test:browser:ui` | Interactive Playwright UI for local debugging. |
| `npm run test:report` | Open the most recent browser HTML report. |
| `npm run test:live` | The real YouTube smoke test, outside the default suite. |
| `npm run test:docker` | The full check suite in the matching official Playwright Linux image; needs Docker. |
| `npm audit` | Security audit including development dependencies. |

Useful targeted runs:

```sh
npm run test:browser -- --project=chromium
npm run test:browser -- player.spec.js --project=firefox
npm run test:browser -- sharing.spec.js --headed
npm run test:browser -- --grep 'timeout|pending'
```

Node tests print coverage for `src/state.js` and `scripts/server.js`. The gate requires 100% lines, 100% functions, and at least 95% branches for those modules. This does **not** claim coverage percentages for the browser controller (`src/app.js`); its behavior is tested through Playwright. The CLI is tested by launching its real process.

### Firefox on macOS 27

On some macOS 27 machines, Firefox exits before tests with `Could not find profile folder`. This matches an [upstream Playwright issue](https://github.com/microsoft/playwright/issues/42768) involving access to Firefox's shared app-data directory. The suite does not change your browser data or OS permissions to work around it.

With Docker Desktop running, use `npm run test:docker` to run all engines in Linux. It downloads the official image matching the installed Playwright version, mounts project sources read-only, installs dependencies in a disposable container, and writes reports under `test-results/docker/`. This also avoids needing native browser binaries on the host. Open that report with `npx playwright show-report test-results/docker/playwright-report`.

To run the working engines directly on macOS:

```sh
npm run lint
npm run test:coverage
npm run test:browser -- --project=chromium --project=webkit --project=mobile
```

HTTP integration tests bind only to `127.0.0.1` and choose ephemeral ports. Browser tests start their own server on port 4173, and live smoke uses 4174. They never reuse your development server on port 3000, and they stop their own server at the end. Leave 4173/4174 free when running the corresponding suite.

## Reports and CI

Playwright writes an HTML report to `playwright-report/` and diagnostics to `test-results/`. Failed tests retain screenshots, a video, and a trace. Accessibility tests attach their complete axe results; layout tests attach full-page screenshots. These directories are ignored by Git.

```sh
npm run test:report
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Live smoke writes diagnostics to `test-results/live/` and a separate report to `playwright-report/live/`. To select a different embeddable video:

```sh
YOUTUBE_TEST_VIDEO_ID=M7lc1UVf-VE npm run test:live
```

GitHub Actions installs all three browser engines, runs lint, coverage gates, browser tests, and the dependency audit. Reports and diagnostics are uploaded even when tests fail, with seven-day retention. Live YouTube smoke is excluded from CI so a third-party outage or network policy cannot block a local app change.

Browser projects run as separate matrix jobs. The final `CI` job requires every test/audit job to succeed; select that single check in branch protection. The release workflow reuses the same CI workflow before publication. See [GITHUB_SETUP.md](GITHUB_SETUP.md) for the one-time repository settings.

## Manual checks

Automated accessibility scans cover only machine-detectable rules; use a screen reader and keyboard to assess the full experience. Layout tests assert geometry and attach screenshots; they do not use platform-sensitive pixel baselines.

Before a release, check actual playback and looping with a few real videos, native sharing on a phone, and the production host's embedding/referrer behavior. The live smoke checks connectivity and readiness, not ads, media decoding, autoplay policy on every device, or precise loop timing.
