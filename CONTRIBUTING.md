# Contributing to Desk

Please keep contributions focused and easy to review.

## Pull requests

- One idea per pull request. Split unrelated fixes or cleanup into separate PRs.
- Describe the user-visible result and the files that own it.
- Run `npm ci`, `npm test`, `npm run build`, and
  `cargo check --locked --manifest-path src-tauri/Cargo.toml` before opening a
  PR.
- Run the production npm audit and Rust advisory audit when dependencies or
  build configuration change.
- Include before and after screenshots for UI, layout, or visual styling
  changes. State when a change is not visually applicable.
- Do not include credentials, personal data, local board files, or generated
  installers in a commit.

## Dependencies

Every dependency addition or upgrade needs a short explanation in the PR:

- what user-visible or build capability it provides;
- why an existing dependency or platform API is not sufficient;
- its license and security implications; and
- the exact lockfile change produced by the package manager.

Keep the runtime dependency set small. The official Tauri fs, notification,
autostart, and single-instance plugins are intentional runtime dependencies.

## Reporting security issues

Do not open a public issue for a vulnerability. Use the private process in
[SECURITY.md](SECURITY.md).
