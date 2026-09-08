# v0.6 live verification — 7 September 2026

Production files were served by Python's ordinary static HTTP server on the isolated origin `127.0.0.1:17880`. Tests used actual UI controls through CUA. No public deployment was performed.

- Document dimensions matched the viewport at 1920 × 1080, 1280 × 720, 679 × 792, 390 × 844, 844 × 390 and 320 × 568. Primary craft controls stayed within the viewport. Long lists and details have independent panel scrolling.
- Cube and recipe were visible side by side on desktop and in the 679-pixel window. The wide layout also showed the inspector. The 390- and 320-pixel layouts used working Cube / Selected recipe tabs.
- Both Cube sizes fit their available stage. On 320 × 568 the final 9 × 6 grid measured about 277 × 193 pixels; the craft bar remained at y=487–545. Compact short-screen layouts hide the optional quick-material tray to preserve grid space.
- Recipe drawer search found the three Gypsy recipes. Selecting the 20-fragment recipe, adding ingredients and using the fixed Transmute control created one Gypsy's Prophecy in the Cube and recorded it in history.
- Hovering that result displayed its item description in the game tooltip. Dragging it in the scaled 9 × 6 grid moved it to the next cell.
- The inspector drawer placed move/remove controls outside its scrolling stat content. The item catalog search returned Harlequinn's Crest and Harlequinn's Veil at 320 × 568; its results and controls stayed inside the dialog.
- Quick search opened the Random Orb recipe. The production Web Worker completed 100,000 trials with 18 named results, observed rates 5.43–5.75%. Quick search remained accessible. The simulation preserved the craft count and inputs.
- A subsequent actual craft produced eight Magister Orbs in the Cube. Undo restored both Tarot inputs and the previous craft count.
- No broken rendered images or browser error logs were observed in these flows.
- The user's existing preview at port 17870 was reloaded with the new layout and retained its items. Temporary viewport overrides were reset and the QA tab was closed.

`npm run verify` passed mechanics, 18 transaction tests, 8 Cube experience tests, English/runtime random-session checks, 24,117 independent numeric stat comparisons, 880 dynamic replays, 801 socket replays and syntax checks. Production tests also verified root/subfolder asset resolution, compressed/fallback loading, unchanged stats for all 2,089 catalog rows, 100,000 worker trials and stat-cache invalidation.

The final production model bundle is 520,245 bytes, compared with 6,610,843 source-data bytes: a 92.1% reduction. The entire output, including the uncompressed compatibility fallback and all shipped assets, is about 7.93 MB on disk. These measurements are payload/build sizes and local functional checks, not a remote-network speed guarantee or proof of parity with every current-game mechanic.
