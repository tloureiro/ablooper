# AB Looper

Loop sections of a YouTube video. Name your loops, capture start and end points from the playhead, and share a session with a link.

[Open AB Looper](https://tloureiro.github.io/ablooper/)

## Run locally

Use Node.js 24 or newer (`nvm use` selects the project's version).

```sh
npm ci
npm start
```

Open <http://127.0.0.1:3000>. There is no build step and no runtime npm dependency. The development server serves only the app's public files and binds to localhost. Set `PORT` to use a different port.

## Use

1. Paste a YouTube URL or video ID and select **Load video**. Standard watch links, youtu.be, Shorts, live, and embed URLs are supported.
2. Enter A and B as seconds (`90.5`), minutes (`1:30`), or hours (`1:02:30`). Alternatively, use **Set** to capture the current video time.
3. Select **Play loop** to repeat that section. Pause through the loop button or YouTube's player controls. Editing a playing loop's range or removing it stops playback.
4. Add and name more loops, then select **Share** to share the video, session name, and loop ranges. It opens your device's share menu when supported, or copies the session URL to the clipboard. If clipboard access is unavailable, copy the URL from the address bar.

Changes are saved in the URL fragment without adding browser history entries. Keep the link to return to a session; there is no account or server storage. Links from the original app still work. Sessions support up to 100 loops and a 64,000-character encoded link; very long links may exceed the limits of the service you share them through.

The editor works before connecting to YouTube. Video playback needs internet access and a video that permits embedding. Some videos require interacting with YouTube's Play button before starting a loop. Use HTTP or HTTPS rather than opening `index.html` directly, since the app uses JavaScript modules and YouTube requires a valid referrer.

## Check changes

```sh
npx playwright install chromium firefox webkit # once, to install the test browsers
npm run check                                 # lint, coverage gates, all browser projects
npm audit                                     # includes development dependencies
```

`npm test` runs unit and HTTP integration tests with Node's built-in test runner. `npm run test:browser` runs browser integration, end-to-end, accessibility, and responsive layout tests in Chromium, Firefox, WebKit, and mobile WebKit. The default suite simulates YouTube and OS sharing APIs and blocks unexpected external requests. `npm run test:live` separately checks the real YouTube connection.

See [TESTING.md](TESTING.md) for individual commands, coverage scope, debugging, reports, and remaining manual checks. Loop timing uses a 100 ms poll and YouTube's seek API, so it is not sample-accurate.

If Firefox cannot launch on macOS 27, `npm run test:docker` runs the full suite in Linux with Docker Desktop; see the troubleshooting section in the testing guide.

GitHub Actions runs the checks and audit for pushes, pull requests, and weekly. It retains browser reports and failure diagnostics for seven days. Dependabot groups npm tooling and GitHub Actions updates into weekly PRs, with a separate group for security fixes. Dependency alerts remain enabled; new advisories may still require updates.

See [GITHUB_SETUP.md](GITHUB_SETUP.md) for the repository settings needed to require CI and enable Dependabot patch/minor auto-merges. New releases use semantic `vMAJOR.MINOR.PATCH` tags, matching package/lockfile versions, and the [changelog](CHANGELOG.md). The Release workflow runs the full suite before publishing a GitHub release; it can be started from the Actions page.

## Project layout and hosting

- `index.html` and `styles.css`: accessible, responsive interface.
- `src/app.js`: player lifecycle, loop controls, and session editing.
- `src/state.js`: URL parsing, validation, and shared-session encoding.
- `scripts/server.js` and `scripts/serve.js`: dependency-free HTTP server and CLI entry point.
- `tests/`: unit and browser regression coverage.

The old standalone HTML experiments have been removed; their source remains in Git history. The app can still be hosted directly on GitHub Pages or any static host, including a subdirectory. Publish `index.html`, `styles.css`, and `src/`; no bundler or Node server is needed in production. Loading a video contacts YouTube. The interface uses system fonts and does not load external stylesheets.
