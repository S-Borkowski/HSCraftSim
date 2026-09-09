"""Check tracked paths against the source-distribution policy, not legal compliance."""
from pathlib import Path, PurePosixPath
import argparse
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = {'.exe', '.dll', '.win', '.bin', '.ttf', '.otf', '.woff', '.woff2', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.7z', '.rar', '.gbf', '.pyc'}


def exclusion_reason(name):
    path = PurePosixPath(name)
    if path.suffix.lower() in ARTIFACTS:
        return 'binary, media, font, generated archive or capture'
    if name.startswith(('build/', 'dist/', 'release/', 'tests/_output/')):
        return 'generated output or private local artifacts'
    if name.startswith('data/') and path.suffix != '.md':
        return 'local game-derived data'
    if name.startswith('research/') and path.suffix not in {'.py', '.java', '.md'}:
        return 'raw research output'
    if name.startswith('tests/') and path.suffix in {'.json', '.jsonl'}:
        return 'captured game-derived fixture'
    if path.name.lower() in {'strpool.json', 'session.json'} or path.suffix.lower() in {'.c', '.gml'}:
        return 'native source export, string dump or personal session'
    return None


def tracked_paths(root=ROOT, ref=None):
    command = ['git', 'ls-tree', '-r', '--name-only', '-z', ref] if ref else ['git', 'ls-files', '-z']
    return [p for p in subprocess.check_output(command, cwd=root).decode('utf-8').split('\0') if p]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', help='Check a commit/tag instead of the working index')
    args = parser.parse_args()
    paths = tracked_paths(ref=args.ref)
    violations = [(p, exclusion_reason(p)) for p in paths if exclusion_reason(p)]
    if violations:
        for path, reason in violations[:12]:
            print(f'Excluded from public source: {path} ({reason})')
        print(f'FAIL: {len(violations)} excluded paths in {len(paths)} tracked files.')
        return 1
    print(f'PASS: {len(paths)} tracked source files; no excluded artifact paths.')
    print('This checks the declared packaging policy, not copyright or permission status.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
