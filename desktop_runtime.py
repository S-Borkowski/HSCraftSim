"""Desktop hosting and session storage. Uses only the Python standard library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import os
import tempfile
import threading

MAX_SESSION_BYTES = 10_000_000


class SessionStore:
    def __init__(self, profile):
        self.profile = Path(profile)
        self.profile.mkdir(parents=True, exist_ok=True)
        self.path = self.profile / 'session.json'
        self._lock = threading.Lock()
        self._revision = -1

    def load_session(self):
        if not self.path.exists():
            return None
        if self.path.stat().st_size > MAX_SESSION_BYTES:
            raise ValueError('The saved session is too large. Restore an exported session.')
        return self.path.read_text(encoding='utf-8')

    def save_session(self, payload):
        """Only the fixed session file is writable through the webview bridge."""
        temporary = None
        try:
            if not isinstance(payload, str) or len(payload.encode('utf-8')) > MAX_SESSION_BYTES:
                raise ValueError('The session is too large.')
            data = json.loads(payload)
            if data.get('schema') != 2 or not isinstance(data.get('state'), dict):
                raise ValueError('Unsupported session format.')
            revision = data.get('desktopRevision', 0)
            if not isinstance(revision, int) or revision < 0:
                raise ValueError('Invalid session revision.')
            with self._lock:
                # A close-time flush must not be overwritten by an older queued save.
                if revision < self._revision:
                    return {'ok': True}
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.profile, prefix='session-', suffix='.tmp', delete=False) as stream:
                    temporary = Path(stream.name)
                    stream.write(payload)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, self.path)
                self._revision = revision
            return {'ok': True}
        except Exception as error:
            if temporary:
                temporary.unlink(missing_ok=True)
            return {'ok': False, 'error': str(error)}


class DesktopHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.bin': 'application/octet-stream'}

    def do_GET(self):
        if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
            self.send_error(403)
            return
        requested = urlsplit(self.path).path
        if requested in ('/', '/index.html'):
            content = (Path(self.directory) / 'index.html').read_text(encoding='utf-8')
            content = content.replace('<head>', '<head>\n<meta name="hscraftsim-desktop" content="1">', 1)
            body = content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        root = Path(self.directory).resolve()
        target = Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(root):
            self.send_error(403)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if urlsplit(self.path).path.startswith('/assets/') else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')

    def log_message(self, *args):
        pass


def start_server(root):
    root = Path(root).resolve()
    if not (root / 'index.html').is_file():
        raise FileNotFoundError('The website build is missing. Run Build-Web.bat first, or extract the complete desktop release.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(DesktopHandler, directory=str(root)))
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True, name='HSCraftSim assets')
    thread.start()
    return server, f'http://127.0.0.1:{server.server_port}/'


class ProfileLock:
    def __init__(self, profile):
        import msvcrt
        self.stream = open(Path(profile) / 'desktop.lock', 'a+b')
        if self.stream.tell() == 0:
            self.stream.write(b'0')
            self.stream.flush()
        self.stream.seek(0)
        try:
            msvcrt.locking(self.stream.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            self.stream.close()
            raise RuntimeError('HSCraftSim is already running. Switch to its existing window.') from None

    def close(self):
        self.stream.close()
