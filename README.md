> **Source distribution update:** Fresh source checkouts require a compatible, authorized local data set. Game-derived assets and captured data are no longer included in the maintained source tree. See [local setup](LOCAL-DATA.md), [distribution scope and existing-release limitations](DISTRIBUTION.md), and [research scripts](docs/RESEARCH-SCRIPTS.md). Existing Windows EXE/ZIP assets are preserved; this change does not establish redistribution rights for their embedded content.

# HSCraftSim — Cube Workshop

A Hero Siege Cube crafting simulator with an English interface. Version 1.0.4 (Community edition). Runs locally or as a static website when its compatible local data has been supplied.

## Start

Prepare [local data](LOCAL-DATA.md), then double-click **Start.bat**. Existing Baslat.bat and run.bat launchers also work. Python 3 is required; no npm packages are needed. The source archive does not contain a ready-to-run game data bundle.

The app opens at `http://127.0.0.1:17870/ui/`. The server listens only on loopback and uses the next available port when needed. Terminal alternative: `python server.py`.

## Windows desktop app

Open the EXE from the versioned Windows release folder, or use **Start-Desktop.bat** / `python HSCraftSim.py` from the source checkout. The native window uses the same web UI and crafting engine. Its session persists in `%LOCALAPPDATA%\HSCraftSim\session.json`, independently of the installation folder and local server port. Python-source dependencies and repeatable EXE build instructions are in [DESKTOP.md](DESKTOP.md). Run **Build-Desktop.bat** to verify and rebuild the Windows release ZIP.

Opening `index.html` directly from disk now displays an English launcher guide instead of waiting indefinitely. The HTML requires HTTP(S); use Start.bat for a browser preview or the desktop launcher for the app.

## Workshop

- **Created by Falor** stays visible under the logo and in About. Community edition includes Falor's Discord in About and the footer. Website edition has creator attribution without Discord links. Neither edition shows a host credit. See [editions](EDITIONS.md).
- The workspace fits the viewport: Cube, **Active Recipe** and **Item preview** share three columns on desktop. Long recipe lists and item details scroll within their panels. Below 650 pixels, **Cube / Active recipe / Item** tabs share the workspace while the item summary and craft controls remain visible.
- **Recipes** opens the searchable recipe browser. Filter by category, favorites, or recipes ready to craft.
- **Suggested next step** puts an applicable Crystal-removal or Wisdom recipe first when Cube items need it, even before its materials are supplied. The suggestion respects your recipe filters and disappears when the effect is removed; Undo and random rolls are unchanged.
- **Item catalog** is always available in the header. Hover for stats and descriptions; click to add an item.
- **Double-click a recipe**, or focus it and press **Shift + Enter**, to supply missing materials without crafting. Required equipment is chosen separately; any selected alternative ingredient is respected. In the recipe browser, a single click selects the recipe; **Use recipe** returns to the workshop.
- **Item preview** follows the selected Cube item after each craft. It shows current values beside known roll ranges, separates final damage/defense totals, and labels corruption effects in red with **Corruption** text. Calculated totals are not assigned misleading raw roll ranges. **Compare last craft** opens the saved before/after comparison. **Recent crafts** keeps the last ten material uses separate, even on the same equipment.
- **Add ingredients** and **Craft** stay together directly below the Cube. Adding materials does not craft. **Craft** consumes them only when pressed separately and places results directly in the Cube. Results that do not fit leave the inputs untouched. **Batch craft** uses existing materials only.
- Hover any Cube, inventory, catalog or recipe item for its game-style tooltip. Click a Cube item to keep it in the live preview; **Inspect / E** opens its editing controls. Use **Move to inventory / Move to Cube**, drag and drop, or right-click to remove an item.
- **Undo / Ctrl Z** restores the previous action, including consumption and results. Undo history resets on page reload; the session itself is saved.
- **Probabilities** runs 1,000–100,000 independent trials in a Web Worker without consuming items or blocking the interface. Random item recipes display named result distributions.
- Equipment opens directly in one panel with live stats, stars, corruption, Crystal effects and sockets. Existing-item edits save immediately and support Undo. The socket browser has searchable **Runes / Gems / Jewels** cards; click to insert or drag onto a socket.
- Recipe **Choose item** buttons apply the actual type, rarity, tier and mechanic conditions. Starting presets (such as corruption for cleansing) are labeled. Editing a new item rechecks compatibility before Add to Cube.
- **History** stores independent before/after stat snapshots for each craft. Select two versions and optionally show only changed stats. The last **10 crafts per equipment item** travel with that item through inventory, reload, undo and JSON export/import; the general journal retains 100 recent crafts. Old entries that did not capture stats are labeled unavailable. Adding a saved copy never alters its history.

| Shortcut | Action |
|---|---|
| Ctrl K | Search recipes and jump to tools |
| R or / | Recipe browser |
| Shift + Enter on a recipe | Add missing materials without crafting |
| I | Item catalog |
| E | Item inspector |
| 1 / 2 / 3 | Workshop / Probabilities / History |
| Ctrl Z | Undo |
| Escape | Close the current dialog or tooltip |

## Random results

New sessions start with fresh random seeds. **Repeatable sessions** in Settings explicitly reuses a chosen starting seed. The seed advances after each successful craft; the same inputs and explicit seed remain reproducible. Undo restores the earlier seed as well.

The Orb recipe selects one of 18 Orb types and produces **8 copies of that type**, matching the extracted `DoCraftResult` case `0x16`. Each craft makes a new selection; repeated types remain possible. The recipe lists all 18 types, shows the last result, and links to its probability distribution. This is a seeded simulation RNG, not a copy of the game's native outcome RNG.

## Data and limitations

This is not a fully verified emulation of the current game build.

- The local data set used during development contains item images, Cube grids, backgrounds, animations, tooltip frames and fonts. These files are excluded from the maintained public source tree; see [distribution scope](DISTRIBUTION.md).
- 2,097 catalog records: 1,932 named selectable items and 65 hidden unnamed records. All concrete references in 301 recipes resolve to catalog items. There are 100 Runeword definitions, including seven Codex words.
- Item Editor supplies 1,444 stat profiles, 392 stat descriptions, 817 skill names, 22 special roll models and 267 measured socket chains. Current native base values and draw order supersede the imported model for 610 static Unique definitions, including 161 with changed values. Socket and special tails remain separate.
- Weapon subtype participates in item identity. Rolled jewels with different definitions are not combined into one stack.
- Five fragment families, rune merges, material consumption, output placement, history, save and undo are covered by tests.
- Current-game results cover all 25 Dungeon Keys, nine Relic uniques, Infernal Codex tiers 1–20, Rune special branches and Destiny/Gypsy star outcomes.
- Original craft mutation blocks supply 3,119 fixtures: Dice, Crystal and star thresholds plus reroll, cleanse and socket edits. Destiny/Gypsy uses 70% star increase, 22% decrease and 8% corruption. Dice corruption preserves the original roll seed; Crystal draws its seed before its outcome. Whole-item regeneration is outside this fixture boundary.
- Random Unique chooses one of six tiers equally, then one eligible item in that tier. Its pools contain 48, 61, 79, 152, 218 and 203 items. Angelic and Unholy crafts use 31 and 17 eligible tier-SS items. Current native exclusions apply; the three recipes no longer use a flat catalog pool.
- All 956 Unique equipment identities have current tier/rarity metadata. Current socketable definitions and 27 enhanced-socket equipment definitions are applied; character level evaluates known per-level stats.
- Add Sockets follows the current native rarity/type/zero-socket gate. Satanic, Angelic, Runeword, Heroic and Unholy items are ineligible. Explicit socket seeds on 273 normal equipment definitions match 1,911 native results; 1,848 native eligibility decisions are covered separately. These checks do not certify natural socket generation or all special restriction-flag producers.
- Normal item rarity/affix generation, Angelic augments, some special item tails and natural socket chains remain incomplete. Codex initial zone/entry rolls, essence vault requirements and earlier equipment socket transformations also need further verification. Unresolved values are labeled; catalog references are kept separate from applied rolls.

The Item Editor source is `_release/_work/HSItemEditor-v2.7.2` (which also contains v2.15.3 notes). Importing does not modify the editor. Source hashes are stored in `data/item_profiles.json`. Some added catalog items retain the editor's conservative inventory dimensions. Shared stat transforms have not been replaced merely from the current identity metadata.

Craft research comes from executable `2034fad4…`; stat profiles refer to `438bf484…`. The current clean backup is `c6ecc069…`; its native modifier rules and 144 socketable definitions are now extracted separately. The original asset-import manifest records an earlier patched executable fingerprint. These builds differ, so current-game parity is not claimed. Asset-import hashes are recorded in `data/game/manifest.json`; the current rule source and verification are in `research/current/VERIFIED_RULES.md`. Older research and the legacy interface remain under `RESEARCH.md` and `research/legacy-ui.html`.

## Verification

```powershell
npm test
npm run check
npm run test:web
python -m unittest tests.test_desktop tests.test_cpr
```

The suite covers crafting transactions, fragment/rune chains, output placement, hover content, English runtime text, fresh/repeatable session seeds and all 18 Orb outcomes. Independent Item Editor fixtures compare 24,117 numeric stats, 880 dynamic replays and 801 socket replays, including 57 overwrite cases. These establish parity with that editor model. Separately, current native routines supply 1,274 upgrade-table, 5,091 star/corruption and 3,000 Crystal comparisons. Current base generation adds 5,490 fixtures / 37,791 visible values across 610 Unique items, including five stars and corruption. Full game parity remains unverified.

Latest native mutation, browser interaction and isolated Python checks are in
[CRAFT_VERIFICATION_2026-09-07.md](tests/CRAFT_VERIFICATION_2026-09-07.md).

`npm run verify` runs the JavaScript suites, syntax checks, static build and production package tests. The web tests verify domain-root and subfolder asset URLs, compressed and fallback data loading, all 2,097 catalog records' stat output, worker results and cache invalidation. Browser checks are documented in `tests/UI_VERIFICATION_0.6.md` and `tests/UI_VERIFICATION_0.5.md`. Live verification uses the actual UI controls.

## Publish as a website

Run **Build-Web.bat**, or `npm run verify`, with Node.js installed. Upload the **contents of `dist/`** to a static web host. No game installation, Python service, database, API server, external fonts or npm runtime dependencies are required on the host. The same build works at a domain root or a subfolder such as `/craft/`. Serve it over HTTPS with normal JavaScript MIME types; do not open `index.html` directly as a local file.

For a local production preview, run `npm run preview` and open `http://127.0.0.1:17880/`. This uses the built files and is separate from the development preview at port 17870. Rebuild after changing code, data or assets. Only the generated `dist` folder is replaced by the build.

The initial model payload is **520,743 bytes compressed**, down from **6,533,348 bytes** across the source data files (92% smaller). The bundle preserves stat profiles and English labels. A plain JSON fallback is included for browsers without streaming decompression, but is not downloaded by browsers using the compressed path. These figures describe data payload bytes, not total page transfer or loading time on a remote host. The generated `dist/build-report.json` records current sizes.

All asset URLs include a content hash. The host can cache `assets/` with `Cache-Control: public, max-age=31536000, immutable`, while `index.html` should revalidate. Upload assets before replacing the index and retain the previous asset revision for already-open pages. Serve `runtime.bin` as an ordinary binary file: the app handles its gzip payload. Images load as needed, unchanged recipe rows are reused, and item stat presentations are cached until their definitions or tiers change.

Sessions are stored in each visitor's browser and do not sync between devices or website origins. Export/import transfers a session between the local app and the published site. The release includes simulation code, data and referenced graphics only; local game paths, editor diagnostics, research files, tools and test fixtures are excluded.

## Refresh data

```powershell
python tools/extract_cube_assets.py "GAME_BIN_DIRECTORY"
python tools/complete_recipe_catalog.py "GAME_BIN_DIRECTORY"
python tools/build_item_profiles.py
python tools/import_item_editor.py
python tools/import_editor_items.py
```

Asset extraction requires Pillow. Run `import_item_editor.py` after the older profile builder. Imports default to the sibling Item Editor folder and can accept another source path. Regenerate independent fixtures with `python tools/build_editor_fixtures.py`.

The simulator never modifies game processes or save files. Game assets belong to their respective owners. This is an independent, unofficial tool.
