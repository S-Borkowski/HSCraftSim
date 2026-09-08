# About / Credits verification — 1.0.2

- Creator credit: **Falor**, visible below the logo on desktop and mobile.
- Host credit: **Graxy_TV**, shown separately in About / Credits.
- Falor Discord: https://discord.gg/3wWfYubgb3 — bug reports and feedback.
- Graxy_TV Discord: https://discord.gg/fDtXAQu5c3 — community.
- Both footer and About links use `target="_blank"` and `rel="noopener noreferrer"`. The Python host explicitly opens external links in the system browser.

Browser checks passed at 1920×1080, 1366×768, 1280×720, 1024×768 and 390×844: visible creator credit and footer, no page overflow, bounded dialog, correct link targets, Escape, focus restoration, Back to crafting, and access to game-data help. Opening and closing About preserves the stored simulator session. Invite membership or server contents are not inspected by these checks.

The 25 existing craft-workspace browser checks also passed, including both Cube sizes, History, Undo, material placement and Gypsy outcomes. The static build verifies root/subfolder URLs and excludes external community links from local-asset fetch checks.

The desktop startup check now opens and closes About inside the actual WebView2 renderer and verifies the names, Discord targets, layout and restored focus. Each packaged EXE runs this check twice in an isolated profile, together with the existing session-restoration checks. Results are included in the release ZIP as `VERIFICATION.json`.
