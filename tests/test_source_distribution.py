"""Packaging/import checks using synthetic files only; no game data required."""
from pathlib import Path
import json
import tempfile
import unittest
from unittest.mock import patch
from tools.local_data import fingerprint, import_data, inspect, records, safe_path
from tools.check_source_distribution import exclusion_reason


class SourceDistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'destination'
        self.source = Path(self.temp.name) / 'authorized-source'
        (self.root / 'config').mkdir(parents=True)
        self.rows = []
        for name, content, group in [
            ('data/example.json', b'{"synthetic":true}\r\n', 'runtime'),
            ('data/icons/example.png', b'not-a-game-image', 'runtime'),
            ('tests/example.json', b'{"example":1}\n', 'tests'),
            ('research/current/example.json', b'{"syntheticInput":true}\n', 'research'),
        ]:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            self.rows.append({'path': name, 'sha256': fingerprint(path), 'group': group})
        self.save_manifest()

    def save_manifest(self):
        (self.root / 'config/local-data-manifest.json').write_text(
            json.dumps({'schema': 1, 'files': self.rows}), encoding='utf-8')

    def test_runtime_import_preserves_source_and_skips_optional_fixtures(self):
        before = {r['path']: (self.source / r['path']).read_bytes() for r in self.rows}
        self.assertEqual(import_data(self.source, self.root), 2)
        self.assertFalse((self.root / 'tests/example.json').exists())
        self.assertEqual(inspect(self.root, verify=True)['missing'], [])
        self.assertEqual(import_data(self.source, self.root), 0)
        self.assertEqual(import_data(self.source, self.root, with_tests=True), 2)
        self.assertTrue((self.root / 'research/current/example.json').is_file())
        self.assertEqual(before, {r['path']: (self.source / r['path']).read_bytes() for r in self.rows})

    def test_mismatched_source_commits_nothing(self):
        (self.source / 'data/icons/example.png').write_bytes(b'incompatible')
        with self.assertRaisesRegex(ValueError, 'incompatible source'):
            import_data(self.source, self.root)
        self.assertFalse((self.root / 'data/example.json').exists())

    def test_existing_custom_data_is_never_replaced(self):
        destination = self.root / 'data/example.json'
        destination.parent.mkdir()
        destination.write_bytes(b'user-changes')
        with self.assertRaisesRegex(ValueError, 'left unchanged'):
            import_data(self.source, self.root)
        self.assertEqual(destination.read_bytes(), b'user-changes')
        self.assertFalse((self.root / 'data/icons/example.png').exists())

    def test_failed_install_rolls_back_new_files(self):
        import shutil
        copy = shutil.copyfileobj
        calls = 0
        def fail_second(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('simulated disk failure')
            return copy(*args, **kwargs)
        with patch('tools.local_data.shutil.copyfileobj', side_effect=fail_second):
            with self.assertRaisesRegex(OSError, 'disk failure'):
                import_data(self.source, self.root)
        self.assertFalse((self.root / 'data/example.json').exists())
        self.assertFalse((self.root / 'data/icons/example.png').exists())

    def test_windows_and_posix_escape_paths_are_rejected(self):
        for name in ['../outside', '/absolute', 'C:/outside', 'data/../../outside', 'data\\..\\outside']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                safe_path(self.root, name)

    def test_manifest_cannot_target_application_code(self):
        self.rows[0]['path'] = 'server.py'
        self.save_manifest()
        with self.assertRaisesRegex(ValueError, 'inside data'):
            records(self.root)

    def test_line_endings_do_not_invalidate_identical_json(self):
        (self.source / 'data/example.json').write_bytes(b'{"synthetic":true}\n')
        self.assertEqual(import_data(self.source, self.root), 2)
        self.assertEqual(inspect(self.root, verify=True)['different'], [])

    def test_distribution_policy_rejects_outputs_but_allows_scripts(self):
        for name in ['data/icons/1.png', 'data/items_catalog.json', 'data/translations/main.json',
                     'research/current/routines.json', 'research/decomp/function.c',
                     'tests/current_upgrade_native.json', 'release/package.zip', 'private/strpool.json',
                     'data/game/font.ttf', 'capture.bin', 'game.exe']:
            with self.subTest(name=name):
                self.assertIsNotNone(exclusion_reason(name))
        for name in ['tools/local_data.py', 'research/current/native_upgrade_oracle.py',
                     'research/legacy_helpers/HsDecomp.java', 'engine/mechanics.js',
                     'config/local-data-manifest.json', 'data/README.md']:
            with self.subTest(name=name):
                self.assertIsNone(exclusion_reason(name))


if __name__ == '__main__':
    unittest.main()
