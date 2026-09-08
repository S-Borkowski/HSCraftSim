# Desktop 0.7 verification — 7 September 2026

- Python source successfully started the actual Edge WebView2 renderer, loaded 146 recipes and the 1,989-item selectable catalog, rendered the starter items without missing images, saved its profile and exited with code 0.
- The final one-file EXE was copied alone to an isolated temporary directory. It started twice without source files, loaded all required bundled resources, restored a supplied session containing seven Satanic Crystals and seed 371, advanced its save revision, and shut down cleanly both times. The frozen-runtime report is in `build/desktop/release-verification.json` and in the release's `VERIFICATION.json`.
- Three Python desktop tests cover atomic saves, stale queued writes, invalid/oversize payloads, lock release, loopback-only asset serving, correct JavaScript MIME type, compressed binary delivery and inaccessible private paths.
- `npm run verify` passed all existing crafting/stat/random-session tests, the static production tests, and new startup/persistence-selection tests. The direct-file guard is tested in a Node DOM fixture: it presents the launcher guide without importing modules or waiting indefinitely.
- The browser tool rejected opening `file://` under its URL policy. No alternate browser route was used to bypass that restriction; direct-file behavior has unit coverage, not a live browser screenshot check.
- The actual web preview at `http://127.0.0.1:17870/ui/` was reloaded and verified ready with all 146 recipes, the user's existing starter items and no browser error logs.

Only isolated desktop test profiles were used. The release contains a single EXE, README, third-party notices, checksum and verification report. The application uses the installed WebView2 runtime and is not code-signed. These tests do not claim validation of all game mechanics, every Windows configuration or every desktop file-dialog interaction.
