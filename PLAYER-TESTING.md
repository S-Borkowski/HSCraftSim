# HSCraftSim 1.0.3 — Player test build

Extract the ZIP, then open HSCraftSim.exe. Windows 10/11 x64 and Microsoft Edge WebView2 Runtime are required. Python, Node.js and a Hero Siege installation are not required. The app works offline once WebView2 is installed.

## First craft

1. Choose a recipe, then choose any required equipment from Item catalog.
2. Double-click a recipe or press Add ingredients below the Cube. The materials appear in the Cube and remain there. Shift + Enter on a focused recipe does the same.
3. Press Craft. It consumes the materials and displays the result in the Cube.
4. Watch Item preview for the updated stats and known roll ranges. Compare last craft opens the saved before/after values. Every completed use has its own History record. Ctrl Z undoes the last action.

Click a Cube item to select its live preview. Inspect / E opens editing controls. In the Recipes browser, a single click selects a recipe; Use recipe returns to the workshop. On phones, use the Item tab for the full description.

Gypsy's Prophecy and Destiny Shard roll independently: 70% star increase, 22% star decrease, 8% corruption. A decrease at zero stars leaves the item at zero. Corruption resets stars to zero. Repeated outcomes are possible.

## What to test

- Equipment rerolls, stars, corruption and cleansing; socket recipes and inserted stones.
- Fragment merges, random items, Orbs, Runewords and Codex recipes.
- Hover details, live item values and roll ranges, red Corruption labels, drag and drop, inventory, History comparisons and Undo.
- Close and reopen the app, then confirm that your Cube, inventory and History remain available.

## Report an issue

Please include:

- App version: 1.0.3, and the Hero Siege version used for comparison.
- Recipe and item names, starting stars, sockets and corruption state.
- Steps to reproduce, expected result and actual result.
- A screenshot of the problem and, when comparing with the game, its before/after tooltips.
- If possible, your exported simulator session: open Inspect, then use Export under This session. No game save is needed.

Copy this template:

App / game version:
Recipe and item:
Steps:
Expected:
Actual:
Screenshot / exported session:

## Test scope

This is an unofficial player test build, not a claim of complete game parity. Verified Cube flows use the extracted rules and included data. Player combat context, Angelic augments and some special item/socket transitions still need in-game comparison. A simulated random sequence will not reproduce the game's live random sequence.

Your session is stored at %LOCALAPPDATA%\HSCraftSim\session.json. Replacing the EXE preserves it. This application does not modify the game or its saves. No bug report is sent automatically.

BUILD-INFO.json identifies the bundled web revision. VERIFICATION.json records the standalone launch/persistence checks, and SHA256SUMS.txt contains the EXE checksum.
