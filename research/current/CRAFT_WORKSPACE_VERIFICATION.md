# Craft workspace verification

Date: 2026-09-08

Follow-up: the saved-outcome explanation and additional Gypsy's Prophecy verification are documented in [GYPSY_OUTCOME_VERIFICATION.md](GYPSY_OUTCOME_VERIFICATION.md), which includes the newer build and test results.

## Implemented behavior

- Desktop workspace has a compact Cube, selected recipe and persistent Last craft panel, with the recipe book below. Tablet and mobile layouts keep the craft action and result summary visible; long content scrolls within its panel.
- Following the user's review, Add ingredients and Craft are now separate, stationary buttons. Add ingredients visibly places missing materials in the Cube, respecting the selected alternative and never creating target equipment. It has its own Undo step and does not change equipment stats, RNG or History.
- Craft is disabled until the required items are in the Cube. The transaction layer also rejects missing materials and never replenishes them, even for a single craft. A successful craft creates one History entry and one Undo step; Undo restores the pre-craft materials. Failed crafts preserve equipment, materials, RNG and History. Pending crafts lock state-changing controls against repeated clicks.
- Batch craft retains native recipe permissions, uses existing materials only and records each completed craft separately. Partial completion reports its count and stopping reason.
- Last craft reads frozen History snapshots, prioritizes state/socket/star/damage changes, shows the first five differences and links to the exact comparison. The recent ten operations are in this panel. Recipe selection does not clear the result.
- Existing save schema, game rules, assets, rarity colors and English interface are retained.

## Verification results

- `npm run verify`: passed the general regression suites, syntax checks, all 2,097 item stat builds, nine craft-action tests and static web checks.
- `npm run test:web`: passed again after the final layout and focus changes. Includes root/subfolder hosting, compressed data and fallback loading, and the worker simulation check.
- `node tests/test_craft_browser.mjs http://127.0.0.1:17870/ui/`: 21 checks passed with no browser runtime or console errors. Covers visible preparation without crafting, ten preparation/craft pairs, rapid double clicks on each separate action, independent preparation/craft Undo steps, reload, exact History comparisons, invalid targets, selected gems, socket restrictions, partial batch completion, atomic output-space failure, recipe changes, reset and keyboard focus.
- Layout checks passed at 1920×1080, 1366×768, 1280×720, 1024×768 and 390×844, for both 4×4 and 9×6 Cubes. Page dimensions matched the viewport, controls stayed visible, and images loaded. Tooltip placement and dismissal were checked.
- `python -m unittest tests.test_desktop tests.test_cpr`: five tests passed.
- The final Python/WebView2 self-test passed against the final web package using an isolated test profile. It loaded 301 recipes and 1,932 catalog items, confirmed the native bridge and session saving, and reported no broken images or page overflow at 1506×863.

## Artifacts

- Browser report and screenshots: `tests/_output/craft-workspace/`
- General verification log: `tests/_output/craft-two-step-verification.log`
- Final web verification log: `tests/_output/craft-two-step-web.log`
- Browser verification log: `tests/_output/craft-two-step-browser.log`
- Python/WebView2 report: `tests/_output/craft-two-step-desktop-report.json`
- Static package: `dist/`, revision `2b277b1c822a0025`, version `0.7.0`, 1,694 files, 8,740,339 bytes.

## Data preservation and scope

The existing desktop session retained its original SHA-256 hash:
`2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`.

Browser and desktop tests used separate test storage. No game saves were edited and no EXE was compiled. This verifies the requested UI and transaction behavior; it does not assert new native-game parity beyond the existing simulator rules.
