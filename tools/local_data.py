"""Validate or import an existing, authorized local data set without downloading it."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import re
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'config/local-data-manifest.json'
TEXT_SUFFIXES = {'.json', '.jsonl', '.txt', '.csv'}


def fingerprint(path):
    content = path.read_bytes()
    if path.suffix.lower() in TEXT_SUFFIXES:
        content = content.replace(b'\r\n', b'\n')
    return hashlib.sha256(content).hexdigest()


def safe_path(root, relative):
    part = PurePosixPath(relative)
    if not relative or '\\' in relative or ':' in relative or part.is_absolute() or '..' in part.parts:
        raise ValueError(f'Invalid data path: {relative}')
    root = root.resolve()
    target = (root / relative).resolve()
    if not target.is_relative_to(root) or target == root:
        raise ValueError(f'Data path escapes its directory: {relative}')
    return target


def records(root=ROOT, with_tests=False):
    document = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
    if document.get('schema') != 1:
        raise ValueError('Unsupported local data manifest')
    result, seen = [], set()
    for row in document['files']:
        name = row['path']
        safe_path(root, name)
        if name in seen or not re.fullmatch(r'[0-9a-f]{64}', row['sha256']):
            raise ValueError(f'Invalid or duplicate manifest record: {name}')
        seen.add(name)
        if row['group'] == 'runtime':
            if not name.startswith('data/'):
                raise ValueError('Runtime data must be inside data/')
        elif row['group'] == 'tests':
            if not name.startswith('tests/') or not name.endswith('.json'):
                raise ValueError('Test data must be a JSON fixture inside tests/')
        elif row['group'] == 'research':
            if not name.startswith('research/current/') or not name.endswith(('.json', '.jsonl')):
                raise ValueError('Research test inputs must be JSON/JSONL inside research/current/')
        else:
            raise ValueError('Unknown data group')
        if row['group'] == 'runtime' or with_tests:
            result.append(row)
    return result


def inspect(root=ROOT, with_tests=False, verify=False):
    missing, different = [], []
    rows = records(root, with_tests)
    for row in rows:
        path = safe_path(root, row['path'])
        if not path.is_file():
            missing.append(row['path'])
        elif verify and fingerprint(path) != row['sha256']:
            different.append(row['path'])
    return {'expected': len(rows), 'missing': missing, 'different': different}


def import_data(source, root=ROOT, with_tests=False):
    """Validate all inputs before installing any files; preserve existing content."""
    source, root = source.resolve(), root.resolve()
    if not source.is_dir() or source == root:
        raise ValueError('Choose a separate existing local data directory.')
    rows = records(root, with_tests)
    build = root / 'build'
    build.mkdir(exist_ok=True)
    installed = []
    with tempfile.TemporaryDirectory(prefix='local-data-import-', dir=build) as temporary:
        stage = Path(temporary)
        pending = []
        for row in rows:
            relative = row['path']
            target = safe_path(root, relative)
            if target.exists():
                if not target.is_file() or fingerprint(target) != row['sha256']:
                    raise ValueError(f'Existing data differs; left unchanged: {relative}')
                continue
            original = safe_path(source, relative)
            if not original.is_file() or fingerprint(original) != row['sha256']:
                raise ValueError(f'Missing or incompatible source data: {relative}')
            staged = safe_path(stage, relative)
            staged.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, staged)
            if fingerprint(staged) != row['sha256']:
                raise ValueError(f'Source changed while copying: {relative}')
            pending.append(relative)
        try:
            for relative in pending:
                target = safe_path(root, relative)
                target.parent.mkdir(parents=True, exist_ok=True)
                # Exclusive creation also prevents replacing a concurrent user's file.
                with target.open('xb') as destination:
                    installed.append(target)
                    with safe_path(stage, relative).open('rb') as origin:
                        shutil.copyfileobj(origin, destination)
        except Exception:
            for path in reversed(installed):
                if path.resolve().is_relative_to(root):
                    path.unlink()
            raise
    return len(installed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    status = sub.add_parser('status', help='Check local data availability')
    status.add_argument('--verify', action='store_true', help='Verify file hashes too')
    status.add_argument('--with-tests', action='store_true', help='Include fixtures and their research inputs')
    install = sub.add_parser('import', help='Copy a compatible data set you are authorized to use')
    install.add_argument('--from', dest='source', required=True, type=Path)
    install.add_argument('--with-tests', action='store_true', help='Include fixtures and their research inputs')
    args = parser.parse_args()
    if args.command == 'import':
        count = import_data(args.source, with_tests=args.with_tests)
        print(f'Imported {count} local files. Existing files were preserved.')
    report = inspect(with_tests=args.with_tests, verify=args.command == 'import' or args.verify)
    if report['missing'] or report['different']:
        print(f"Local data required: {len(report['missing'])} missing, {len(report['different'])} different.")
        for relative in [*report['missing'], *report['different']][:8]:
            print('  ' + relative)
        print('See LOCAL-DATA.md. No game data is downloaded by this tool.')
        return 1
    print(f"Ready: {report['expected']} local data files available.")
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(str(error))
