"""Build the existing website and package a Windows executable with its assets."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def build():
    import PyInstaller.__main__
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    if not npm:
        raise RuntimeError('Node.js is required to build the website assets.')
    subprocess.run([npm, 'run', 'verify'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, '-m', 'unittest', 'tests.test_desktop'], cwd=ROOT, check=True)
    version = json.loads((ROOT / 'package.json').read_text())['version']
    release = ROOT / 'release' / f'HSCraftSim-{version}-Windows-x64'
    release.mkdir(parents=True, exist_ok=True)
    work = ROOT / 'build' / 'desktop'
    work.mkdir(parents=True, exist_ok=True)
    metadata = work / 'version.txt'
    numbers = tuple(map(int, version.split('.'))) + (0,)
    metadata.write_text(f"""VSVersionInfo(ffi=FixedFileInfo(filevers={numbers},prodvers={numbers},mask=0x3f,flags=0x0,OS=0x40004,fileType=0x1,subtype=0x0,date=(0,0)),kids=[StringFileInfo([StringTable('040904B0',[StringStruct('FileDescription','HSCraftSim Cube Workshop'),StringStruct('FileVersion','{version}'),StringStruct('ProductName','HSCraftSim'),StringStruct('ProductVersion','{version}'),StringStruct('OriginalFilename','HSCraftSim.exe')])]),VarFileInfo([VarStruct('Translation',[1033,1200])])])""", encoding='utf-8')
    exclusions = ['PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'qtpy', 'gi', 'gtk', 'tkinter', 'numpy', 'pandas', 'matplotlib', 'IPython']
    PyInstaller.__main__.run([
        str(ROOT / 'HSCraftSim.py'), '--name', 'HSCraftSim', '--onefile', '--windowed', '--noconfirm', '--noupx',
        '--distpath', str(release), '--workpath', str(work / 'pyinstaller'), '--specpath', str(work),
        '--add-data', f'{ROOT / "dist"}:dist', '--version-file', str(metadata),
        '--icon', str(ROOT / 'data' / 'game' / 'Craft_Icon_spr_0.png'),
        *[value for name in exclusions for value in ('--exclude-module', name)]
    ])
    subprocess.run([sys.executable, str(ROOT / 'tests' / 'test_desktop_release.py'), str(release / 'HSCraftSim.exe'), str(work / 'release-verification.json')], cwd=ROOT, check=True)
    shutil.copy2(ROOT / 'DESKTOP.md', release / 'README.txt')
    shutil.copy2(ROOT / 'PLAYER-TESTING.md', release / 'PLAYER-TESTING.txt')
    shutil.copy2(work / 'release-verification.json', release / 'VERIFICATION.json')
    shutil.copy2(ROOT / 'dist' / 'build-report.json', release / 'BUILD-INFO.json')
    notices = ['HSCraftSim uses Python, pywebview, pythonnet, clr_loader, bottle and PyInstaller.\nGame graphics belong to their respective owners.\n']
    for name in ['pywebview', 'pythonnet', 'clr_loader', 'bottle', 'proxy_tools', 'typing_extensions', 'pyinstaller']:
        dist = importlib.metadata.distribution(name)
        notices.append(f'\n\n--- {name} {dist.version} ---\n')
        licenses = [p for p in dist.files or [] if 'license' in str(p).lower() and '.dist-info/' in str(p).replace('\\', '/')]
        for license in licenses:
            notices.append(Path(dist.locate_file(license)).read_text(encoding='utf-8', errors='replace'))
    python_license = Path(sys.base_prefix) / 'LICENSE.txt'
    if python_license.exists():
        notices += ['\n\n--- Python ---\n', python_license.read_text(encoding='utf-8')]
    (release / 'THIRD-PARTY-NOTICES.txt').write_text('\n'.join(notices), encoding='utf-8')
    executable = release / 'HSCraftSim.exe'
    digest = hashlib.sha256(executable.read_bytes()).hexdigest()
    (release / 'SHA256SUMS.txt').write_text(f'{digest}  HSCraftSim.exe\n', encoding='ascii')
    archive = release.parent / f'{release.name}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for item in release.iterdir():
            if item.is_file():
                zipped.write(item, arcname=f'{release.name}/{item.name}')
    print(f'Executable: {executable}\nRelease ZIP: {archive}\nSHA256: {digest}', flush=True)


if __name__ == '__main__':
    build()
