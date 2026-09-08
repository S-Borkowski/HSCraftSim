# v0.5 live verification — 7 September 2026

Verified with CUA against the actual UI. Functional tests used the isolated local origin `127.0.0.1:17871`. Responsive navigation was also checked in the user's 679-pixel-wide window without changing their items or craft count.

- **English interface:** menu labels, accessibility labels, dialogs, descriptions, warnings, tooltips and errors were translated. Source-level runtime text checks pass. Rendered workshop, inspector and probabilities screens contain no Turkish text.
- **Random Orb:** consecutive actual crafts produced 8 Fatality and 8 Relic Orbs. Both results remained in the Cube; the displayed craft seed advanced between crafts.
- **Fresh sessions:** repeatable mode off produced starting seeds 2,313,694,246 and 2,612,891,592 on two successive new sessions. Explicit repeatable mode preserved the chosen starting seed 37.
- **Result distribution:** 10,000 UI simulation trials displayed all 18 named Orb outcomes, at 5.18–5.81% in the observed run. The simulation left the craft count and ingredients unchanged.
- **Quick search:** searching Random Orb and pressing Enter opened that recipe and returned to Workshop. Exact recipe names rank before ingredient-only matches.
- **Fixed craft bar:** ingredients and Transmute controls remained inside the viewport at 1280 × 720 and in the 679-pixel-wide window.
- **Recipe drawer:** search, ready-only filtering and Escape worked. With the user's original helmet and Crystal, the ready filter returned Satanic Crystal. Closing the drawer restored the panel to its original location.
- **Inspector drawer:** clicking the Cube helmet in the narrow window opened its stats and move controls. Tooltip placement was corrected so a card cannot cover its source and intercept that click.
- **Inventory transfer:** Move to inventory transferred the 8 Relic Orbs. Selecting them in inventory opened the inspector; Move to Cube returned all 8, leaving inventory empty.
- No horizontal page overflow, failed rendered images or browser error logs were observed during these checks.

`npm test` passed the mechanics suite, 18 workshop tests, 24,117 numeric stat comparisons, 880 dynamic replays, 801 socket replays, 8 Cube experience tests, random-session tests and English runtime checks. `npm run check` passed.

Orb semantics are supported by the local extracted `research/decomp/docraft5/DoCraftResult.named.c`, case `0x16`: one id in 112–129 is drawn, then quantity is set to 8. This verification does not establish parity with every mechanic in the current game build.
