# HSCraftSim research scripts

Prepared by Falor. Project: https://github.com/falorfrozen-cmd/HSCraftSim

This package contains the analysis scripts used during Cube/item research. It
does not include decompiled game functions, native instruction captures, game
executables, string-pool dumps, catalogs, translations, sprites, fonts or captured
test results. The manifest hashes the included scripts and documentation only.

It replaces the earlier `HSCraftSim-Research-2026-09-09.zip` sharing bundle, which
also contained captured game data. Do not use that earlier bundle as a
scripts-only distribution.

## Tools

| Script | Purpose |
| --- | --- |
| `research/legacy_helpers/HsDecomp.java` | Ghidra headless decompilation of selected functions at supplied RVAs. |
| `research/legacy_helpers/HsSwitchFix.java` | Recover a known switch table and annotate its branches in the analysis database. |
| `research/DecompileItemState.java` | Decompile bounded function/decoded branch ranges in a Ghidra analysis database. |
| `research/RecoverCompletionSwitches.java` | Later known-jump-table reconstruction helper. |
| `research/legacy_helpers/strpool.py` | Extract a static string pool from a compatible local executable. |
| `research/legacy_helpers/fixnames.py` | Add names and constants using a compatible executable and routine map. |
| `tools/annotate_current.py` | Annotate current-build output from locally generated routine and variable maps. |
| `tools/parse_define_combos.py` | Parse a matching named/raw crafting-definer pair and string pool into recipe JSON. |
| `tools/lift_yyc.py` | Simplify a decompiler export into readable pseudocode. |
| `research/current/native_*.py`, `capture_*.py`, `probe_*.py` | Selected native emulation, capture and diagnostic helpers. |

## Required local inputs

Ghidra 12.1 was used by the later analysis. Python dependencies tested with
Python 3.13 are listed in `requirements.txt`. Install them in a virtual environment
if running the Python probes. Ghidra Java scripts run inside Ghidra, not directly
with the standalone Java command.

Supply your own compatible inputs only where their acquisition and use are
authorized. Each script's source/docstring describes the files it needs. Some
require external Item Editor models, private intermediate maps or previously
decoded instruction fragments. Those inputs are deliberately not bundled; the
collection is not a one-click, self-contained extractor for every game version.

Current native-probe executable fingerprint:
`c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4`

Historical scratchpad fingerprint:
`2034fad4096be6de1147e4ff61b942a706673a9567b10c3013c6393ed0686486`

Their preferred image base is `0x140000000`. Do not mix current and historical
addresses, maps or decompiler passes. The legacy helpers now read the executable
path from `HS_LEGACY_EXE` and the routine map from `HS_LEGACY_ROUTINES`; their
analysis behavior is retained and the executable fingerprint is checked.

## Ghidra arguments

Import a compatible local PE into your own Ghidra project and analyze it. Add the
script directories in Script Manager, or pass them using the headless runner's
`-scriptPath` argument. Script arguments after `-postScript` are:

```text
HsDecomp.java <output-directory> <rvaHex=functionName> [...]
HsSwitchFix.java <jumpRvaHex> <tableRvaHex> <count> [...]
DecompileItemState.java <startVA> <endExclusiveVA> <functionName> <output.c> [...]
RecoverCompletionSwitches.java <entryVA> <jumpVA> <tableVA> <count> <output.c> [...]
```

An RVA is an offset from the image base; a VA already includes the image base.
For the current fingerprint, `GetStatUpgrades` has RVA `395b740`, so its script
arguments can be `HsDecomp.java output 395b740=GetStatUpgrades`.

The switch helpers modify the analysis database. `DecompileItemState.java` may
bound decoded branches with synthetic return instructions and temporarily
bypass a stack probe. Preserve an analysis-project backup and read the helper
before running it. A decompile is reconstructed pseudocode, not the developer's
original project source or proof of complete behavior.

## Parser example

Once you have independently obtained compatible raw/named exports and a string
pool for an authorized purpose, the original parser can be invoked as follows:

```powershell
python -X utf8 tools/parse_define_combos.py named.c raw.c strpool.json recipes.json craftComboResult,craftComboList
python -X utf8 tools/lift_yyc.py named.c raw.c strpool.json -o readable.txt
```

Keep generated output local unless you have a valid basis to redistribute it.
The scripts themselves are not a promise that every extraction or use is
permitted. See `DISTRIBUTION.md` for the scope and unresolved rights questions.
