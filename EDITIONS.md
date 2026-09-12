# Community and Website editions

The maintained GitHub checkout is the **Community** edition. Both editions use
the same crafting engine, game data, History and Undo behavior.

| Edition | Creator credit | About / footer Discord | Host credit |
| --- | --- | --- | --- |
| 01-Community | Created by Falor | Falor's Discord | None |
| 02-Website | Created by Falor | None | None |

After supplying compatible [local data](LOCAL-DATA.md), stage any new application
source files and run from the canonical Git checkout:

    node tools/create-editions.mjs

This creates a sibling **HSCraftSim-Editions** directory containing two runnable
source folders and their separate **dist/** website packages. To keep an older
pair, choose a new destination with `--output NEW_DIRECTORY`. The tool refuses
to overwrite a non-empty destination. Generated folders have no Git metadata,
personal sessions, previous release files or private research captures.

Use **Start-Desktop.bat** for Python desktop or **Start.bat** for browser preview
inside the chosen folder. The browser editions use separate ports. The Website
desktop launcher uses its own profile; Community preserves the existing
HSCraftSim desktop profile.

For the content creator's website, upload the contents of **02-Website/dist/**.
Its HTML physically omits Discord links. No client-side switch can enable them.
Build reports identify the edition and revision.

Only Community is published to the project's GitHub release. Local edition
folders include the compatible runtime data needed to run; they are not the
public source ZIP. Public source archives still follow
[source-distribution boundaries](DISTRIBUTION.md), and need local data setup.
