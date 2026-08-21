# Changelog

All notable Axiom Editor changes will be documented here.

## [0.1.3] - 2026-08-22

### Fixed

- Provide explicit repository context when publishing a GitHub Release from the artifact-only release job.

## [0.1.2] - 2026-08-22

### Fixed

- Build the generated React UI modules before compiling the Linux x64 remote-server release.

## [0.1.1] - 2026-08-22

### Fixed

- Fixed Linux x64 remote-server release packaging by using the non-mangling compiler for non-minified builds.

## [0.1.0] - 2026-08-22

### Changed

- Renamed the application, internal feature namespace, settings paths, commands, and platform identifiers from Void to Axiom Editor.
- Added a distinct Axiom Editor icon and Windows packaging assets.
- Added reproducible Windows x64 portable and installer builds through GitHub Actions.
- Added a release-owned Linux x64 remote server artifact instead of downloading binaries controlled by the discontinued upstream project.
- Replaced deprecated project documentation with active contribution, security, and community guidance.
