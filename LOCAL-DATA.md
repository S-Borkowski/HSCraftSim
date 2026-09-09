# Local data setup

The source repository contains the application and extraction tools. Game-derived
images, fonts, catalogs, translation tables, raw research outputs and captured test
fixtures are maintained separately in the developer's local workspace.

Existing installations and Windows executables are not changed by this source
layout. **Before updating an older source checkout, back up its local `data/` and
fixture files outside the checkout.** Git can remove formerly tracked files when
applying the cleanup. Restore authorized compatible files with the import command
below afterward. The maintainer's existing workspace was explicitly preserved
during this migration; a normal pull is not itself a backup procedure.

## Check an existing workspace

```powershell
python -X utf8 tools/local_data.py status --verify --with-tests
```

`config/local-data-manifest.json` contains paths and content fingerprints, not the
data itself. Line endings are normalized for text fingerprints. The manifest
identifies the data compatible with this source snapshot; it does not grant a
license to obtain, copy, use or distribute that data.

## Prepare a fresh source checkout

Use an existing compatible local data set that you are authorized to copy. The
source directory must contain the same relative `data/` structure. With
`--with-tests`, it also needs the captured `tests/` fixtures and their supporting
`research/current/` JSON/JSONL inputs:

```powershell
python -X utf8 tools/local_data.py import --from 'C:\YourAuthorizedWorkspace' --with-tests
python server.py
```

The helper does not download data, open a game process, modify saves or extract
assets from an EXE. It checks every selected file before installing new ones and
refuses to replace different existing files. A missing or incompatible data set
requires resolving the source/provenance first, not bypassing the fingerprint.

The historical extraction tools under `tools/` and `research/` remain available
for appropriately authorized research. They are tied to specific executable
builds and sometimes external Item Editor models; there is not a complete,
one-command regeneration path from an arbitrary current game installation.
See [the research guide](RESEARCH.md) and [distribution scope](DISTRIBUTION.md).

## Build and test locally

```powershell
npm test
npm run check
npm run test:web
```

These full simulator checks require the compatible runtime data and recorded
fixtures. The source-distribution checks run independently without game data:

```powershell
python tools/check_source_distribution.py
python -m unittest discover -s tests -p test_source_distribution.py -v
```

Building a local web package or executable does not provide redistribution rights
for the data it embeds. Review the intended distribution separately.
