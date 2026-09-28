# Contributing

Desk is two things on this machine: a local kanban and a pin-able timer. Pin it to the corner when everything else is loud. A tool to help slow down. No account. No cloud.

The door is open. Propose anything. It will be looked at one pull request at a time.

One idea per pull request. That is enough.

[ARCHITECTURE.md](ARCHITECTURE.md) is the map: what each file owns, how a change flows, and the checks.

## Run locally

Install Node.js 22.18 or newer and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), then run:

```sh
npm ci
npm run dev:app
```

This opens **Desk Dev** with separate data from the installed app. On Windows its data lives in `%LOCALAPPDATA%\com.konnacapital.desk.dev`. Use this command for native development; plain `npm run tauri dev` uses the release app identity.

`npm run dev` opens the frontend server for browser previews. Preview data is temporary and resets on reload; native window controls require `dev:app`.

Before submitting a change:

```sh
npm test
npm run test:ui
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

`npm run test:ui` needs Chromium for Playwright once: `npx playwright install chromium`. It saves screenshots of the clock and board in `shots/`.

Every pull request builds a Desk Dev test installer. Find it in the pull request's checks, under *Preview build*.
