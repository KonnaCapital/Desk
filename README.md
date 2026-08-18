# Desk

Desk is two things on your desktop: a local kanban and a pin-able timer. It saves on this machine. No account, no phone, no cloud.

Pin it. Slow down when everything else is loud. It does not try to be a second brain.

## Install (Windows)

Download the installer from [Releases](https://github.com/KonnaCapital/desk/releases/latest):

[Desk_0.1.0_x64-setup.exe](https://github.com/KonnaCapital/desk/releases/latest/download/Desk_0.1.0_x64-setup.exe)

The installer is unsigned. Windows may say it protected your PC. Choose **More info**, then **Run anyway**.

The site is the same promise: [konnacapital.github.io/desk](https://konnacapital.github.io/desk). Finnish and English follow the OS / browser language. Kanban columns stay Inbox / Today / To Do / Done.

## What it is

- **Board** — capture into Inbox, then Today, To Do, Done. Archive is a hidden list, not a fifth column.
- **Clock** — 25m / 1h / 2h / custom. The remaining time is stored as an end timestamp, so it stays honest if the app sleeps.
- **Pin** — stay on top. Resize the window down to a screen-edge widget.

Data lives in a local JSON file on this computer (`%LOCALAPPDATA%\com.hoodoptimizer.desk\board.json`).

## Why it is small

The UI is HTML, CSS, and a little TypeScript. The window is [Tauri 2](https://tauri.app/) on a Rust shell: a real OS window (pin, drag, notifications, file write) without an Electron-sized process.

## Not in v1

No phone capture, no MCP, no markdown vault, no calendar, no cloud, no account. If it is not two things on the machine, it is a later pull request.

## Develop

```bash
npm install
npm test
npm run tauri dev
```

Requires Node, Rust, and Windows C++ build tools. `npm test` runs the board and timer model plus language detection.

## License

MIT. See [LICENSE](LICENSE).
