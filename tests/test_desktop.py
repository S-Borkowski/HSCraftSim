from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json
import unittest
from desktop_runtime import ProfileLock, SessionStore, start_server

ROOT = Path(__file__).resolve().parents[1]


class DesktopTests(unittest.TestCase):
    def test_atomic_persistence_and_out_of_order_saves(self):
        with TemporaryDirectory() as folder:
            store = SessionStore(folder)
            self.assertIsNone(store.load_session())
            def payload(revision, value):
                return json.dumps({'schema': 2, 'desktopRevision': revision, 'state': {'value': value}})
            newest = payload(3, 'close-time flush')
            self.assertTrue(store.save_session(newest)['ok'])
            self.assertTrue(store.save_session(payload(2, 'older queued save'))['ok'])
            self.assertEqual(SessionStore(folder).load_session(), newest)
            self.assertFalse(store.save_session('not json')['ok'])
            self.assertFalse(store.save_session(json.dumps({'schema': 999, 'state': {}}))['ok'])
            self.assertFalse(store.save_session('x' * 10_000_001)['ok'])
            self.assertEqual(store.load_session(), newest)
            self.assertEqual(list(Path(folder).glob('*.tmp')), [])

    def test_single_instance_lock_releases(self):
        with TemporaryDirectory() as folder:
            first = ProfileLock(folder)
            try:
                with self.assertRaises(RuntimeError):
                    ProfileLock(folder)
            finally:
                first.close()
            ProfileLock(folder).close()

    def test_frozen_site_root_and_mime_types(self):
        server, url = start_server(ROOT / 'dist')
        try:
            with urlopen(url) as response:
                body = response.read().decode()
                self.assertIn('name="hscraftsim-desktop"', body)
            report = json.loads((ROOT / 'dist' / 'build-report.json').read_text())
            prefix = f'assets/{report["revision"]}/'
            with urlopen(url + prefix + 'ui/startup.js') as response:
                self.assertEqual(response.headers.get_content_type(), 'text/javascript')
                self.assertIn('immutable', response.headers['Cache-Control'])
            with urlopen(url + prefix + 'data/runtime.bin') as response:
                self.assertEqual(response.read(2), b'\x1f\x8b')
                self.assertIsNone(response.headers['Content-Encoding'])
            for path in ['assets/', '../HSCraftSim.py', 'session.json']:
                with self.assertRaises(HTTPError):
                    urlopen(url + path)
            with self.assertRaises(HTTPError):
                urlopen(Request(url, headers={'Host': 'unexpected.example'}))
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
