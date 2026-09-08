# Codex UI verification

Final web revision: `478fa2d171bfa919`.

- Packaged web application, independent QA origin, 1280 × 720: no document overflow or broken visible images.
- Header **Codex crafting** opens the Codex category and Experience recipe. Seven Orb words appear before the base recipes; unsupported tier upgrade is last.
- Add starting Codex → Inspect/configure → Act 3, Mos'Arathim Desert → Apply: the named target zone is stored and labeled as a starting scenario.
- Experience combined shortcut: materials added; Transmute enabled; all three Orbs consumed; named Codex appears in the same Cube stack. Repeating on filled sockets is blocked.
- Individual Brute → Magister → Swiftness: three material uses create three separate journal records. Final item becomes Codex of Experience. The latest comparison shows two sockets before and three after, Movement Speed and the word bonus added, and unchanged zone/entries.
- Undo final insertion: history goes back to two records, Infernal Codex returns, and the consumed Swiftness Orb is restored to the Cube.
- Python WebView2 renderer, 1506 × 863, copied real profile: 171 recipes; six existing craft records preserved; bridge and session saving operational; no broken images, no startup notice and no document overflow. See `_output/codex-desktop/renderer-report.json`.
- Automated engine, syntax and source-versus-packaged runtime checks pass, including 100,000 worker trials and all 2,089 catalog rows. Python runtime/CPR checks pass.

User's existing desktop profile was backed up before reopening the Python app. The build remains static-host compatible. No EXE was compiled.
