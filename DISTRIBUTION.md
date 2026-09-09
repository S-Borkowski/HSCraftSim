# Source distribution and third-party material

This document records packaging boundaries and outstanding permission questions.
It is not a copyright clearance, a new license for third-party material, or a
claim that reverse engineering is lawful in every situation or jurisdiction.

## Source boundary

The maintained source tree includes the simulator's application code, research
scripts, explanatory notes and source-distribution helpers. The following are
kept out of new public source snapshots and research-script packages:

- Original game executables, extracted native instruction blocks and Ghidra databases.
- Raw decompiler exports, reconstructed C/GML output and static string-pool dumps.
- Game-derived sprites, UI artwork, bundled font files and bulk translation tables.
- Generated game data sets and captured native comparison fixtures.
- User profiles, sessions, logs, screenshots and locally built distributions.

The generated-rule modules in `engine/` remain part of the simulator. They encode
recovered behavior and numerical tables; they are not represented as independently
verified clean-room work. Their origin is described in the research notes and
they remain subject to any applicable rights review. Excluding captured files
does not certify every remaining source file as legally cleared.

No blanket open-source license for game material is introduced by this change.
Public visibility, attribution and a disclaimer do not themselves grant rights.

## Font inventory

| Locally used files | Upstream information | Distribution status |
| --- | --- | --- |
| Fontin-Regular.ttf, Fontin-Bold.ttf, Fontin-SmallCaps.ttf | [exljbris free-font terms](https://www.exljbris.com/eula.html), [extended licensing](https://www.exljbris.com/extended_license.html) | Removed from the maintained public source tree. The origin/license of the game-supplied copies and the intended app/web redistribution need confirmation; older free-font and app-embedding terms differ. |
| Ubuntu-C.ttf | [Canonical Ubuntu font licence](https://canonical.com/legal/font-licence) | Removed with the local data set. Upstream permits redistribution subject to its conditions, including copyright and license notices; the supplied file still needs its provenance/version matched. |

The fact that a font is used by the game is not evidence that the game's license
covers a separate project's redistribution. No license text or permission is
invented for the bundled copies.

## Existing Windows releases

The previously published v1.0.0, v1.0.1 and v1.0.2 EXE/Windows ZIP assets are being
preserved byte for byte at the owner's request. They contain the previous bundled
runtime data, including game-derived graphics and fonts. Source cleanup does not
remove that content from already built programs or establish permission to
continue distributing it. Asset IDs and hashes are recorded in the local audit.

Keeping those binaries available with the same contents requires an applicable
license/permission or another valid legal basis. A draft permission inquiry is
available in [docs/PERMISSION-REQUEST.md](docs/PERMISSION-REQUEST.md); it has not
been sent. No claim of complete rights clearance is made for existing releases.

## Historical Git objects and third-party copies

This cleanup filters the affected paths from the history of `main` and the three
existing release tags, retaining a private Git-bundle backup and preserving each
historical version's remaining application code. The historical source archives
include `SOURCE-CHECKOUT-NOTE.md` explaining the missing local inputs.
Commit and tag object IDs change, so existing contributors should preserve their
work/data and use a fresh clone; do not merge the old history back into the hub.
Forks, downloads, cached or otherwise referenced GitHub objects can still retain
old copies after the refs change. GitHub Support may be needed for further
removal; the source-tree check is not proof that every copy has disappeared.

Review source archives separately from uploaded Windows release assets. A change
to a tag's source tree does not remove embedded content from an uploaded EXE.

## Checks and prevention

`tools/check_source_distribution.py` rejects excluded tracked paths; CI runs it
without game data. `.gitignore` prevents routine additions of local outputs, and
`.gitattributes` excludes generated/private folders from future source archives.
These are technical packaging controls, not a legal assessment of every file.

Scripts operate on files supplied locally by their user. Sharing a script does
not automatically authorize a recipient's extraction, use or redistribution of
the resulting content. Check the relevant license, purpose and local law.
