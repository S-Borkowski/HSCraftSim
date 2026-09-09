# Updating after the source-history cleanup

The cleanup changes commit IDs on `main` and the source trees referenced by
v1.0.0, v1.0.1 and v1.0.2. The separately uploaded Windows binaries and ZIPs retain
their original bytes. Source tags are not a promise of embedded-content rights.

For contributors with an older clone:

1. Preserve any uncommitted work and your authorized local data outside the clone.
2. Make a fresh clone of HSCraftSim. Avoid pulling/merging the old history into it.
3. Follow `LOCAL-DATA.md` to import compatible local data and test fixtures.
4. Reapply your own source edits selectively, then run the source-distribution
   checker. Do not copy old bulk data, captures or media into tracked paths.
5. If an external project records HSCraftSim as a submodule, update that project's
   pointer to the intended new commit separately. No unrelated repo is rewritten
   by this cleanup.

The maintainer's working files were preserved during the operation. Historical
Git backups are private recovery material, not alternate public source packages.
