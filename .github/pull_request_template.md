## Summary

Describe the one idea this pull request implements and the user-visible result.

## Checks

- [ ] This pull request contains one idea; unrelated work is split out.
- [ ] `npm ci` completed.
- [ ] `npm test` passed.
- [ ] `npm run build` passed.
- [ ] `cargo check --locked --manifest-path src-tauri/Cargo.toml` passed.
- [ ] Production npm and Rust advisory audits were run when dependencies or
      build configuration changed.
- [ ] No secrets, personal data, board files, or generated installers are
      included.
- [ ] UI changes include before and after screenshots, or this is not a visual
      change.

## Dependency note

If dependencies changed, explain why the change is needed, why existing APIs
are insufficient, and how the lockfile was updated. Otherwise write “No
dependency change.”
