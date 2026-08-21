# Contributing to Axiom Editor

Thank you for helping make Axiom Editor better. Bug reports, documentation fixes, tests, design improvements, and code contributions are all welcome.

## Before you begin

- Search existing issues and pull requests before opening a duplicate.
- Use the bug or feature issue form and include a minimal reproduction where possible.
- Keep pull requests focused. Discuss large architectural changes in an issue first.
- Never commit API keys, model transcripts containing secrets, build output, or personal editor data.

## Prerequisites

All platforms need Git, Python, and Node.js `20.18.2` (see `.nvmrc`). Use `npm ci` so your installation matches `package-lock.json`.

### Windows

Install Visual Studio 2022 or Visual Studio Build Tools 2022 with:

- Desktop development with C++
- Node.js build tools
- MSVC v143 C++ x64/x86 Spectre-mitigated libraries
- C++ ATL and MFC for the latest build tools with Spectre mitigations

### macOS

Install Xcode and its command-line tools.

### Linux

On Debian/Ubuntu:

```bash
sudo apt-get install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev python-is-python3
```

For other distributions, follow the equivalent Code - OSS prerequisites.

## Set up a development checkout

```bash
git clone https://github.com/Satyam2003-dev/Axiom-Editor.git
cd Axiom-Editor
npm ci
npm run buildreact
npm run compile
```

Launch the development app with `scripts/code.bat` on Windows or `./scripts/code.sh` on macOS/Linux. For continuous compilation, run `npm run watch` in one terminal and launch the app from another.

Most Axiom-specific code is under `src/vs/workbench/contrib/axiom/`. Read [AXIOM_CODEBASE_GUIDE.md](./AXIOM_CODEBASE_GUIDE.md) before changing services that cross the browser and Electron main processes.

## Checks before a pull request

Run the checks relevant to your change:

```bash
npm run buildreact
npm run compile
npm run eslint
npm run test-node
```

Add or update tests for behavior changes. Confirm that no generated `out/`, `.build/`, credentials, or local settings are included in the diff.

## Build Windows locally

From a fully initialized Windows checkout:

```powershell
npm run gulp vscode-win32-x64
npm run gulp vscode-win32-x64-inno-updater
npm run gulp vscode-win32-x64-user-setup
```

The portable application folder is created next to the repository as `VSCode-win32-x64`. The installer is created under `.build/win32-x64/user-setup`.

Maintainers can also run the `Windows Build` workflow manually. Pushing a version tag such as `v0.1.0` builds the installer and portable ZIP and attaches them to a GitHub Release.

## Pull request expectations

- Explain the problem and the chosen solution.
- Link the relevant issue when one exists.
- Include screenshots or recordings for visible UI changes.
- Call out privacy, migration, or compatibility effects.
- Keep formatting-only changes separate from behavioral changes.
- Be respectful and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Common fixes

- Confirm `node --version` reports `v20.18.2`.
- Keep the checkout path free of unusual permission restrictions.
- If React styles are stale, rerun `npm run buildreact`, wait for compilation, and reload the development window.
- If a native dependency fails, verify the Visual Studio C++ workload (Windows) or compiler/system headers (Linux/macOS).
- If Electron reports a Linux sandbox ownership error, follow the error's `chrome-sandbox` ownership instructions only for this repository's downloaded Electron binary.
