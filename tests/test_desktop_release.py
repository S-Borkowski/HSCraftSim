"""Verify the actual standalone EXE, its shutdown and cross-launch persistence."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import os
import shutil
import subprocess
import sys


def verify(executable, report_path):
    executable, report_path = Path(executable).resolve(), Path(report_path).resolve()
    expected_build = json.loads((Path(__file__).resolve().parents[1] / 'dist' / 'build-report.json').read_text())
    runtime_env = os.environ.copy()
    # The copied EXE must not depend on the installed Python or Node executables.
    windows = Path(os.environ['SystemRoot'])
    runtime_env['PATH'] = os.pathsep.join(map(str, [windows / 'System32', windows]))
    runtime_env.pop('PYTHONHOME', None)
    runtime_env.pop('PYTHONPATH', None)
    with TemporaryDirectory(prefix='HSCraftSim-release-test-') as folder:
        isolated = Path(folder)
        copied = isolated / 'HSCraftSim.exe'
        shutil.copy2(executable, copied)
        profile = isolated / 'profile'
        reports = []
        for attempt in range(2):
            report = isolated / f'launch-{attempt}.json'
            process = subprocess.run([str(copied), '--profile-dir', str(profile), '--self-test', str(report)],
                cwd=isolated, env=runtime_env, timeout=55, creationflags=subprocess.CREATE_NO_WINDOW)
            if process.returncode or not report.is_file():
                raise RuntimeError(f'Frozen application startup/shutdown failed: exit {process.returncode}')
            data = json.loads(report.read_text())
            if not data.get('ok') or not data.get('frozen') or not data.get('sessionSaved'):
                raise RuntimeError(f'Frozen application checks failed: {data}')
            assert data['version'] == expected_build['version'], data
            assert data['buildRevision'] == expected_build['revision'], data
            reports.append(data)
            session = json.loads((profile / 'session.json').read_text())
            if attempt == 0:
                # A supplied session fixture must survive a new process and a new local port.
                crystal = next(stack for stack in session['state']['stacks'] if stack['item']['rowId'] == 609)
                crystal['amount'] = 7
                session['state']['rng'] = 371
                session['desktopRevision'] = 50
                (profile / 'session.json').write_text(json.dumps(session), encoding='utf-8')
            else:
                assert 'Satanic Crystal, 7 items' in data['cubeItems'], data
                assert session['state']['rng'] == 371, session
                assert session['desktopRevision'] > 50, session
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps({'ok': True, 'standaloneExe': True, 'pythonAndNodeRemovedFromPath': True, 'restartPersistence': True, 'launches': reports}, indent=2), encoding='utf-8')
        print('PASS Standalone EXE: two clean launches/exits, original assets, native storage and restored 7-Crystal session.', flush=True)


if __name__ == '__main__':
    verify(sys.argv[1], sys.argv[2])
