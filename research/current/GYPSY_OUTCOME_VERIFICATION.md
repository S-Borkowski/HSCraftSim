# Gypsy's Prophecy outcome verification

Date: 2026-09-08

## Reported behavior and evidence

The user reported that Gypsy's Prophecy only increased stars. Read-only inspection of the user's existing Chrome History showed eight uses: craft #23 recorded `level_down`, followed by seven `level_up` results (#24–28 and #30–31). Craft #23's frozen snapshots both showed zero stars. A star-loss roll cannot reduce stars below zero, so it consumed a material without changing the item. No corruption occurred in this eight-use sample.

The existing native mutation fixtures and engine agree on rolls 0–99: 0–7 corrupt and reset stars to zero, 8–29 subtract one with a zero floor, and 30–99 add one. Their probabilities are 8%, 22% and 70%. The absence of corruption in eight independent trials has probability 0.92^8 (about 51%). No RNG or crafting-rule defect was reproduced; these rules were retained.

## Changes

- Last craft now displays the saved outcome separately from the number of stat changes.
- A zero-star loss is explicitly labeled `Star loss roll · Already at 0`, with an explanation that the material was consumed.
- Actual star decreases and increases show their saved before/after levels. Corruption that resets stars is also stated explicitly.
- History comparisons, recent records, journal labels and notifications share the same outcome formatting, including older records with existing snapshots.
- Gypsy's Prophecy and Destiny Shard explain independent rolls, the zero-star floor and corruption's star reset in their recipe details.
- Persistence schema and game rules are unchanged. Existing history is read, not rewritten.

## Verification

- Full transactions with real deterministic RNG seeds cover star increase (3 → 4), decrease (3 → 2), corruption (3 → 0), and the zero-star floor (0 → 0) for both Gypsy's Prophecy and Destiny Shard. Material use, snapshots, RNG advancement and the unchanged Undo state are asserted.
- 3,000 successive transaction seeds on independent eligible targets produced 2,125 increases, 621 decreases and 254 corruptions. Targets were reset between trials to avoid conditioning the sample on corruption or the five-star limit.
- 100,000 probability trials produced 70.143% increases, 21.953% decreases and 7.904% corruptions.
- All 3,119 native crafting mutation fixtures passed, including Dice, Crystal and star thresholds and draw consumption.
- `npm run verify` passed. Log: `tests/_output/gypsy-outcomes-verification.log`.
- All 25 browser checks passed, including four actual Gypsy UI scenarios, History, Undo, both Cube sizes at five viewports and the existing two-step prepare/craft behavior. Log: `tests/_output/gypsy-outcomes-browser.log`; report and screenshots: `tests/_output/craft-workspace/`.
- Python/WebView2 loaded the final web package successfully using a separate test profile. Report: `tests/_output/gypsy-outcomes-desktop-report.json`.
- Final static build revision: `7612b2e0de2aadd4`; 1,695 files, 8,743,062 bytes.

The user's Chrome items were not crafted or edited during diagnosis. The desktop session retained SHA-256 `2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733`. No game saves were changed. No EXE was compiled.
