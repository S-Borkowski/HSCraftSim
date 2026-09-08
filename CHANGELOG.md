# Changelog

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
