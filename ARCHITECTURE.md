# How Desk is built

Desk is a [Tauri 2](https://v2.tauri.app) app: a small Rust shell in `src-tauri/` around a plain TypeScript frontend in `src/`. It has no UI framework and uses Vite to build. This page is the map. Read it before changing code, whether you are a person or an agent.

## Map

| File | Owns |
| --- | --- |
| `src/main.ts` | Boot: load the board, resolve the app name, mount each part of the UI. |
| `src/model.ts` | The board state and every change to it, as pure functions. Timer phases, durations, the current card, and reading saved files all live here. |
| `src/store.ts` | Holds the state, applies model changes, tells subscribers, and saves 200 ms later. |
| `src/storage.ts` | Atomic writes (temporary file, then rename) and the backup copy. |
| `src/board.ts` | The kanban: capture, columns, drag, edit in place, archive. |
| `src/timer.ts` | The clock face: digits, presets, custom time, progress line, scroll to set. |
| `src/focus.ts` | The picker for the card the clock is for, and Mark done. |
| `src/clock-keys.ts` | Clock keyboard shortcuts. |
| `src/chrome.ts` | Title bar: views, pin, Settings, window drag, corner snap, close protection. |
| `src/clock-solo.ts`, `corner-snap.ts`, `pin.ts`, `close.ts`, `autostart.ts`, `modal.ts`, `persist-status.ts` | Small helpers, mostly pure, each with its own tests. |
| `src/i18n.ts` | Copy used from code. Desk is in English. |
| `src/styles.css`, `index.html` | All styles and the static markup. |
| `src-tauri/` | Rust entry (`src/lib.rs`), app config, capabilities, and installer hooks. |

## How a change flows

1. A person acts in the UI.
2. The UI module calls a `Store` method, such as `store.moveCard(id, "done")`.
3. The store runs the matching pure function from `model.ts` and commits the new state.
4. Subscribers repaint synchronously.
5. The store saves the state 200 ms later.

UI modules never change state themselves. A model function returns the same object when nothing changes, and a store method skips the commit in that case, so a no-op never writes the file.

Saving keeps a backup. If both files fail to load, `store.writesBlocked` freezes the board so nothing overwrites data that could still be recovered.

## State on `<body>`

CSS reads UI state from data attributes on `<body>`, set in one place each:

| Attribute | Values | Set by |
| --- | --- | --- |
| `data-view` | `board`, `clock` | `chrome.ts` |
| `data-size` | `lg`, `md`, `sm`, `xs` (from `model.sizeClass`) | `chrome.ts` |
| `data-pinned` | `true`, `false` | `chrome.ts` |
| `data-clock-digits` | `row`, `stack` (portrait windows) | `chrome.ts` |
| `data-clock-solo` | `true` while a pinned clock hides its chrome | `chrome.ts` |
| `data-timer` | `idle`, `running`, `paused`, `done` (from `model.timerPhase`) | `timer.ts` |
| `data-clock-hours` | `true` when the time shows hours | `timer.ts` |
| `data-current-card` | `true` when the clock is for a card | `focus.ts` |

For a new UI state, add an attribute here rather than toggling classes on many elements.

## Clock layout

```
.clock-view        container "clock-view"
  .clock-face      column: the parts below, centred as a group
    .clock-display size container that holds the digits
    .clock-focus   the card picker
    .clock-controls presets, custom time, Start, Reset, Mark done
  .clock-progress
```

`.clock-display` asks for its ideal height, `min(--digit-width, --digit-max) × --digit-lines`, and gives way when the controls need the room. The digits fill it. Their font size is the smallest of three values:

- the display height divided by `--digit-lines`
- the display width divided by `--digit-span`
- `--digit-max`

No rule knows how tall the controls are. To change how big the time is for a window size or state, set these four variables on `.clock-face` for that state. Do not add pixel budgets.

## Native layer

- Every Tauri API the frontend calls needs a permission in `src-tauri/capabilities/default.json`. The build rejects unknown permissions, so `cargo check` catches a wrong name.
- `src-tauri/tauri.dev.conf.json` makes **Desk Dev**. It has its own product name, identifier, binary name, and data folder. Keep all four different from Desk's. The installer closes running copies by binary name, and the uninstaller removes the autostart value by product name.

## Saved data

Desk saves `board.json` and `board.backup.json` in the app's local data folder, which is `%LOCALAPPDATA%\com.konnacapital.desk` on Windows. The file has `version: 1`.

To add a field:
- Accept it as optional in `isStateEnvelope`.
- Give it a default in `parseState`.

Older builds ignore fields they do not know. Keep `version` at 1 for additions, because older builds refuse to write files with a version they do not know.

## Checks

| Command | What it covers |
| --- | --- |
| `npm test` | Unit tests for the pure logic (Node's test runner, no DOM). |
| `npm run test:ui` | Playwright drives the browser preview on port 1430. It covers the clock at five window sizes and pinned, the shortcuts, the board, Settings, and the card picker. It also checks that the time always fits and stays grouped with its controls. Screenshots land in `shots/`. Run `npx playwright install chromium` once first. |
| `npm run build` | Type check and production build. |
| `cargo check --locked --manifest-path src-tauri/Cargo.toml` | Rust and capability names. |

CI runs every check on every pull request and before each release. It builds and runs `cargo check` on Windows and macOS, and runs the UI tests on Ubuntu. The screenshots are uploaded with each run.

## Trying a change

Every pull request, and every push to main, builds an unsigned **Desk Dev** installer in the *Preview build* workflow. Open the run and use the link in its summary. Desk Dev installs next to Desk with its own data, so it never touches your real board.

## Rules of thumb

- Put rules in `model.ts` as pure functions with tests, and keep DOM code thin.
- Make one idea per pull request, and one commit per idea.
- Put copy in `i18n.ts`, or in `index.html` for static labels, and write it in English.
- When a UI change alters behaviour, run `npm run test:ui`, look at the screenshots, and add a UI test.
- Size and state go through the `<body>` attributes and the clock variables. Avoid pixel budgets and chains of `:not()`.
- Fix the cause of a bug. Do not stack fallbacks on top of it.
- Add a dependency only for a strong reason.
