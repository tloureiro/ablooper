# Changelog

Versions use semantic versioning. The original `1.0` Git tag is retained; new tags use `vMAJOR.MINOR.PATCH`.

## [1.1.0] - Unreleased

### Added

- Native sharing with clipboard fallback and compatible shareable session links.
- Unit, HTTP integration, browser, accessibility, layout, and live smoke tests.
- Chromium, Firefox, WebKit, and mobile WebKit coverage, with a Docker test runner.
- Required CI gate, dependency audit, and retained browser failure diagnostics.
- Dependabot patch/minor auto-merge with verified metadata and branch-protection checks.
- Version/tag validation and a tested GitHub release workflow with a static app archive.

### Changed

- Replaced the obsolete lint configuration and refreshed dependencies.
- Split the static app into HTML, CSS, and JavaScript modules.
- Updated the interface with neutral styling and labeled, responsive controls.
- Grouped weekly dependency updates, with major upgrades left for manual review.

### Fixed

- YouTube URL parsing, shared-state validation, and invalid loop ranges.
- Playback/pause behavior, player cancellation, timeouts, and error recovery.
- Narrow-screen overflow, loop-count contrast, and the home link's accessible label.

### Removed

- Obsolete standalone HTML experiments and their unused linting dependencies.
