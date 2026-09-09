"""Package allowlisted analysis scripts without captured inputs or outputs."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def selected(name):
    path = Path(name)
    if name == 'engine/cpr.py':
        return True
    if name.startswith(('research/current/', 'research/legacy_helpers/')):
        return path.suffix in {'.py', '.java'}
    if name in {'research/DecompileItemState.java', 'research/RecoverCompletionSwitches.java'}:
        return True
    if name.startswith('tools/'):
        return path.suffix == '.py' and path.name not in {'build-desktop.py', 'build-research-scripts.py', 'local_data.py', 'check_source_distribution.py'}
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'release/HSCraftSim-Research-Scripts-2026-09-09.zip')
    args = parser.parse_args()
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0')
    payload = {}
    for name in sorted(filter(selected, filter(None, names))):
        content = (ROOT / name).read_bytes()
        if name.endswith('.py'):
            ast.parse(content.decode('utf-8-sig'), filename=name)
        payload[name] = content
    required = {'research/legacy_helpers/HsDecomp.java', 'research/legacy_helpers/HsSwitchFix.java', 'tools/parse_define_combos.py'}
    if not required.issubset(payload):
        raise SystemExit('Expected original helpers are missing from the tracked source set.')
    payload['README.md'] = (ROOT / 'docs/RESEARCH-SCRIPTS.md').read_bytes()
    payload['DISTRIBUTION.md'] = (ROOT / 'DISTRIBUTION.md').read_bytes()
    payload['requirements.txt'] = b'pefile==2024.8.26\nunicorn==2.1.4\ncapstone==5.0.7\nPillow==12.2.0\n'
    manifest = {'schema': 1, 'preparedBy': 'Falor', 'content': 'Analysis scripts; game inputs and captured outputs are not included.',
                'files': [{'path': n, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()} for n, b in sorted(payload.items())]}
    payload['MANIFEST.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in payload.items():
            archive.writestr('HSCraftSim-Research-Scripts/' + name, content)
    with zipfile.ZipFile(args.output) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(payload)
        for name, content in payload.items():
            assert archive.read('HSCraftSim-Research-Scripts/' + name) == content
    digest = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.output.with_name(args.output.name + '.sha256').write_text(f'{digest}  {args.output.name}\n', encoding='ascii')
    print(f'{len(payload)} files, {args.output.stat().st_size} bytes: {args.output}\nSHA256: {digest}')


if __name__ == '__main__':
    main()
