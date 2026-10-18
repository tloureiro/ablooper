# Working in AB Looper

Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md) for the latest session state, verified results, repository settings, and outstanding verification. Then consult [README.md](README.md), [TESTING.md](TESTING.md), and [GITHUB_SETUP.md](GITHUB_SETUP.md) as needed.

## User preferences

- Keep the product generic: a YouTube section looper for any use. Use plain functional copy and neutral styling. The user explicitly rejected music/practice themes, motivational slogans, oversized marketing headings, and invented use-case branding.
- Carry out local edits yourself when requested; do not make the user edit files for you.
- When guiding manual GitHub configuration, give **one action at a time**, wait for the user's result, and respond to what they actually see.
- GitHub CLI was not authenticated in this session. The user chose to perform GitHub UI operations personally. Do not assume authorization to change remote settings, push, merge, or publish based on the previous guided setup; establish the current task's scope.

## Project conventions

- Static HTML/CSS/native JavaScript modules, with no runtime npm dependencies and no build step. Keep GitHub Pages subdirectory hosting and original encoded session links compatible.
- Node.js 24+; use the committed lockfile and `npm ci`.
- `npm start` serves the app at `http://127.0.0.1:3000`.
- `npm run check` runs lint, unit/HTTP coverage gates, and four browser projects. On this macOS 27 machine Firefox has an upstream launch/privacy issue: use `npm run test:docker` with Docker Desktop running for the full suite.
- Normal browser tests simulate the YouTube boundary and fail on unexpected external requests. `npm run test:live` separately contacts YouTube.
- Default branch is **master**, protected by required check **CI**; use PRs and squash merges. Do not push directly or bypass protection.
- Releases use `vMAJOR.MINOR.PATCH`, matching package and lockfile versions and a changelog section. Use the Release workflow after the release-preparation PR merges. Do not move published tags.
- Dependabot patch/minor updates may auto-merge after branch requirements; majors and unclassified updates stay manual. Privileged automation must run trusted base code, never PR head code.
- Keep docs current when changing commands or workflows. No subagents unless the user or another applicable instruction explicitly requests delegation.
