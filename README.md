# Desk

Desk is a small, local-first kanban and timer for the desktop. It stores the
board on this machine: there is no account, cloud sync, updater, or telemetry.

## Downloads

- [Windows x64 NSIS installer](https://github.com/KonnaCapital/desk/releases/latest/download/Desk-Windows-x64-Setup.exe)
- [macOS universal DMG (preview)](https://github.com/KonnaCapital/desk/releases/latest/download/Desk-macOS-Universal.dmg)
- [SHA256 checksums](https://github.com/KonnaCapital/desk/releases/latest/download/SHA256SUMS)

Release automation creates a draft first. A maintainer must inspect and publish
that draft; the links above are for the latest published release.

## Status and platform notes

Desk v0.1 is a preview release. The Windows x64 NSIS package is configured for
a current-user install and English or Finnish installer text. Unless the
repository has been configured with the documented Windows certificate secrets,
the installer is unsigned and Windows SmartScreen may show a warning.

The macOS universal (Apple Silicon + Intel) DMG is configured in CI, but stable
macOS support is not claimed yet. A stable Mac release still requires a real
macOS build and runtime check, Developer ID signing, and notarization. Treat a
Mac DMG without those checks as a preview.

## Maintainer release secrets

Tag releases create one draft from the Windows job. The macOS job waits for
that draft and uploads a stable `Desk-macOS-Universal.dmg` only when all of the
following GitHub Actions secrets are configured: `APPLE_CERTIFICATE` (base64
PKCS#12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_PASSWORD`, `APPLE_TEAM_ID`, and `KEYCHAIN_PASSWORD`. The signing
identity must begin with `Developer ID Application:`; Apple Distribution is
rejected for a direct-download DMG. The workflow validates notarization before
uploading the stable asset.

If those macOS secrets are absent, CI uses ad-hoc identity `-` and uploads only
the Actions artifact `Desk-macOS-Universal-PREVIEW.dmg`; it does not attach
that preview to the release. Windows signing is optional and uses
`WINDOWS_CERTIFICATE` (base64 PKCS#12), `WINDOWS_CERTIFICATE_PASSWORD`,
`WINDOWS_CERTIFICATE_THUMBPRINT`, and `WINDOWS_TIMESTAMP_URL`. Never put
secret values in this repository or in an issue.

## Local data

Desk writes `board.json` and, when available, `board.backup.json` under Tauri's
`AppLocalData` directory for the `com.konnacapital.desk` identifier:

- Windows: `%LOCALAPPDATA%\com.konnacapital.desk`
- macOS: `~/Library/Application Support/com.konnacapital.desk`

Normal uninstall keeps this data. On Windows, the NSIS hook removes only Desk's
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\Desk` autostart value.
The installer's **Delete App Data** option is explicit and opt-in.

To remove everything on Windows, quit Desk, uninstall it from **Settings → Apps
→ Installed apps**, then delete `%LOCALAPPDATA%\com.konnacapital.desk` if it
still exists. To remove everything on macOS, quit Desk, move `Desk.app` to the
Trash, then delete `~/Library/Application Support/com.konnacapital.desk`.

## Development

Requirements: Node.js 22 or newer, npm, and the Rust toolchain used by Tauri.

```text
npm ci
npm test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

To build a Windows NSIS package locally:

```text
npm run tauri build -- --bundles nsis
```

The macOS universal build is CI-configured with:

```text
npm run tauri build -- --target universal-apple-darwin --bundles dmg
```

## Contributions and security

Keep pull requests to one idea, run the required checks, and include before
and after screenshots for UI changes. Explain why every new dependency is
needed and update the lockfile. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md).

## License

Desk is released under the MIT License. See [LICENSE](LICENSE).
