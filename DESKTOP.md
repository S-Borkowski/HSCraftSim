# HSCraftSim for Windows

Source checkouts now require [local data setup](LOCAL-DATA.md) before rebuilding.
Previously published EXE/ZIP files are unchanged by the source-distribution work;
their embedded-content permission questions are documented in [DISTRIBUTION.md](DISTRIBUTION.md).

Release 1.0.3 is a player test build. See PLAYER-TESTING.txt in the release ZIP for the quick start, test scope and bug-report template.

Extract the release ZIP and open **HSCraftSim.exe**. Python, Node.js and the game are not required on the player's computer. The EXE includes the website, assets and Python desktop host; it opens its own application window and works offline after prerequisites are installed.

Windows 10/11 x64 with Microsoft Edge WebView2 Runtime is required. If the desktop window cannot start, install the Evergreen Runtime from https://developer.microsoft.com/en-us/microsoft-edge/webview2/ and open the application again. The build is not code-signed.

Your session is saved in `%LOCALAPPDATA%\HSCraftSim\session.json`. Browser data and startup error logs also live in that profile directory. Replacing the EXE does not replace your session. Only one desktop window can use a profile at a time. Settings / Import and the inspector's Export control transfer sessions between desktop and website versions.

Do not open index.html directly from disk. To run the browser version locally, use Start.bat from the source package. To publish the website, upload the contents of dist/ to a static web host. Website and desktop releases share the same English interface and JavaScript simulation engine; Python supplies the native window, local asset server and persistent storage.

## Run from Python source

    python -m pip install -r requirements-desktop.txt
    npm run build
    python HSCraftSim.py

Start-Desktop.bat opens the same Python application without a console window. The source files and dist/ must remain together.

## Build a Windows release

    python -m pip install -r requirements-build.txt
    python tools/build-desktop.py

Build-Desktop.bat runs the same process. It verifies the website and desktop storage/server tests before building. The versioned Windows folder and distributable ZIP appear under release/. A SHA256 checksum and third-party notices are included. Build on Windows x64 with Python 3.13; do not publish build/ or private profile files.

Before packaging the ZIP, the build also copies the EXE into an isolated folder and verifies two real WebView2 launches, clean shutdown and session restoration. The test removes Python and Node.js from the EXE's PATH and checks the embedded version and web revision. Its report is saved in build/desktop/release-verification.json.

## Verification

The application supports a hidden startup check in the actual embedded WebView2 engine:

    HSCraftSim.exe --profile-dir PATH_TO_SEPARATE_TEST_PROFILE --self-test PATH_TO_REPORT.json

The report checks readiness, 301 recipes, the native persistence bridge, viewport layout and rendered images. Use a separate profile for testing. The desktop wrapper does not change the simulator's documented game-data limitations; see the project README for those details.

Implementation references: https://pywebview.flowrl.com/api/ and https://pyinstaller.org/en/stable/spec-files.html
