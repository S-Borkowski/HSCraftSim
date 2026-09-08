# Native normal-jewelry affix generation

Source binary: HeroSiegeC6E.exe, SHA-256
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`.

## Implemented boundary

Default-quality normal rings and amulets (30 ring and 25 amulet definitions)
now generate affix properties from the current native LoadCommonItems rules.
Their existing base-state model supplies the exact starting RNG state, affix
count and tier. The runtime then consumes the optional-group draws, constructs
ordered prefix/suffix lists, selects and removes entries, and rolls their values.
The corresponding empty generated-stat slots and later final-damage/player
pipeline are not claimed as fully implemented here.

The pool rules come from bounded decompilation of the ring branch at
0x144170f09 and amulet branch at 0x1441817c3. Controlled original-code captures
verify all five element choices, four threshold groups and five tiers: 200
pool paths. Native switch-table order matters: ring elemental skill choices
for the first two elements are 196 and 191, rather than decompiler case order.
Fixed suffix 201 consumes no candidate draw. Fractional affix values consume a
floating RNG advance even when their minimum equals their maximum.

All 566 reachable prefix/suffix definitions were captured separately. Star and
corruption transformations run before the value draw, on the existing rolled
value and on each new bound separately, with native integer flooring. Even an
absent property's zero contribution can receive an additive star increment.
Do not replace this arithmetic with the base-definition modifier pipeline.
Class-specific All Skills includes its separate class-identity draw.

The generated properties feed hover cards, the starting-item preview, Toolkit
crafts, comparison snapshots and save/reload. Existing historical snapshots
remain immutable. The app continues to display base item names: generated
localized prefix/suffix names are not certified. Other normal item types retain
the explicit missing-affix notice. Special quality n != 1 and mirrored zz
construction remain outside this model.

## Evidence and reproduction

Run Python research commands without `-X utf8`; the original variable initializer
file uses cp1254. These commands use fixture-owned emulator memory only:

```
python research/current/capture_jewelry_pools.py
python research/current/native_normal_affixes.py --seeds 20 --modifiers
python research/current/capture_jewelry_affixes.py
python research/current/export_jewelry_rules.py
node tests/test_normal_affixes.mjs
```

The independent goldens contain:

- 1,980 complete jewelry generations, covering all 55 definitions, with 4,070
  numeric property comparisons and exact affix identities/RNG sequences.
- 3,962 isolated affix cases across stars, native tiers, corruption, and
  pre-existing integer/fractional values. Values, ranges and RNG all match.
- 200 controlled pool paths, verified while extracting their compact rules.

`npm run verify` passed, including existing mechanics, every recipe/catalog
combination, 100,000 worker trials, static root/subfolder loading and caches.
`python -m unittest tests.test_desktop tests.test_cpr` passed all five tests.
The new integration test performs 12 Toolkit crafts on one ring, preserves ten
per-item versions and verifies frozen snapshots, changed properties and reload.

## Browser and Python verification

Static build `43c2c78c3fca2dc2`: 1,685 files, 8,640,120 bytes. Main runtime data
remains 520,743 compressed bytes (92% reduction); research fixtures are excluded
from the website package. The new runtime costs about 19 KB total.

At the actual browser UI, Bronze Ring seed 123456 initially displayed Fire
Resistance 19% / Magic Find 18%. Choosing five stars changed these to 22% / 20%.
Toolkit produced a Rare ring with Life 53, Mana 80 and Additive Arcane Damage
216. A second use retained the first operation's before/after values in History.
Hover closed after moving away. No page errors or broken visible images were
observed. Document size matched the desktop 1258x622 and mobile 430x844 viewports.

Screenshots are in tests/_output/jewelry-five-stars.png,
jewelry-after-toolkit.png, jewelry-history.png and jewelry-mobile.png.

The real HSCraftSim.py/WebView2 startup passed using an isolated copy of the
user's profile: tests/_output/native-craft-mliaacdy/desktop.json. All 22 historical
records were preserved exactly; the original profile remained byte-identical
with SHA-256 2fc338af6028a31abb86ae5fb2c8240e42c58d84a7dcde3a7068ad0fa04f1733.
No simulator EXE or release ZIP was built; no game or save files were modified.

## Still unresolved

Full normal weapon/armor/glove/shield/belt affix pipelines and localized affix
names; final damage/defense tooltip calculations; player-dependent effects and
Angelic augments; remaining socket-content transitions; native initial Codex
zone/entry/RNG construction and quest-dependent Essence Vault outputs.

Full prefix-function and artificial value-block decompilation exceeded the
bounded timeout. These attempts left no background decompiler or altered game
binary. The successful bounded pool decompilations and independent native
value captures above are the evidence for this implementation.
