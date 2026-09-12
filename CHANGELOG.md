# Changelog

## 1.0.3

- Moved Add ingredients and Craft together directly below the Cube, with a visible eligibility reason and a secondary Batch craft menu.
- Added an Active Recipe heading and double-click / Shift + Enter recipe preparation. Materials appear in the Cube without crafting or creating target equipment; selected alternative ingredients are respected.
- Replaced the main Last craft difference list with a persistent live Item preview. Cube selection updates the preview; Inspect / E opens editing controls separately.
- Updated item sheets with centered game-style affix lines, current values alongside known roll ranges, separate damage/defense totals, and text-labeled red corruption effects.
- Kept frozen History comparisons and the ten most recent craft records accessible from the preview. Viewing live items never rewrites saved results.
- Added a mobile Item tab and keyboard navigation, and corrected recipe-list space on shorter screens.
- Verified 30 craft browser scenarios across six viewport sizes and both Cube sizes, five recipe-browser layouts, general regressions, static packaging and Python/WebView2 startup. Craft rules and saved-session schema are unchanged.

## 1.0.2

- Added persistent Created by Falor credit and direct Falor / Graxy_TV Discord links.
- Added About / Credits with separate creator, host, community and game credits.
- Discord links open externally so the Cube session stays in the simulator.

## 1.0.1

- Fixed Recipes on desktop: the button and R / slash shortcuts now open the recipe browser instead of only focusing the search field in the bottom panel.
- Added browser regression coverage for opening, searching, selecting and closing recipes at five viewport sizes without changing items, RNG or History.

## 1.0.0

First GitHub player test release of HSCraftSim.

- English Cube workshop with original game graphics, item tooltips and rarity colors.
- 301 recipes, equipment setup, sockets, stars, corruption, fragments and Codex crafting.
- Separate Add ingredients and Craft actions: materials appear in the Cube before they are consumed.
- A separate History entry for every craft, saved before/after comparisons, Last craft and Undo.
- Explicit Gypsy's Prophecy and Destiny Shard outcomes, including a star-loss roll at zero stars.
- Windows x64 desktop EXE with persistent sessions, plus the shared static website build.

The Windows release is tested with two standalone WebView2 launches and session restoration. The build runs the JavaScript regression suites, syntax checks, static package checks and Python desktop tests before packaging.

This is a player test release. Full parity with Hero Siege is not claimed; see [player testing](PLAYER-TESTING.md) and the [current evidence and limitations](research/current/VERIFIED_RULES.md).
