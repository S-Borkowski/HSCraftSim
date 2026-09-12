"""HSCraftSim desktop entry point. Run with Python, or build the Windows EXE."""
from pathlib import Path
import argparse
import json
import os
import sys
import threading
import time
import traceback

from desktop_runtime import ProfileLock, SessionStore, start_server

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description='HSCraftSim desktop workshop')
    parser.add_argument('--profile-dir', type=Path, help='Use a separate profile for testing.')
    parser.add_argument('--self-test', type=Path, help='Verify the embedded renderer and write a JSON report without showing a window.')
    args = parser.parse_args()
    profile = args.profile_dir or Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'HSCraftSim'
    store = SessionStore(profile)
    lock = ProfileLock(profile)
    server = None
    try:
        import webview
        server, url = start_server(ROOT / 'dist')
        build_info = json.loads((ROOT / 'dist' / 'build-report.json').read_text(encoding='utf-8'))
        webview.settings['ALLOW_DOWNLOADS'] = True
        webview.settings['ALLOW_FILE_URLS'] = False
        webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False
        webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER'] = True
        window = webview.create_window(f'HSCraftSim {build_info["version"]} · Cube Workshop', url, js_api=store,
            width=1520, height=900, min_size=(900, 600), background_color='#0b1119',
            text_select=True, hidden=bool(args.self_test))

        def flush_session():
            try:
                payload = window.evaluate_js("localStorage.getItem('hscraftsim.workshop.v2')")
                if payload:
                    result = store.save_session(payload)
                    if not result['ok']:
                        raise RuntimeError(result['error'])
            except Exception:
                (profile / 'save-error.log').write_text(traceback.format_exc(), encoding='utf-8')

        closing = {'started': False, 'saved': False}

        def finish_close():
            # WebView2 cannot evaluate JS inside the synchronous GUI closing callback.
            flush_session()
            closing['saved'] = True
            window.destroy()

        def on_closing():
            if closing['saved']:
                return
            if not closing['started']:
                closing['started'] = True
                threading.Thread(target=finish_close, daemon=True).start()
            return False

        window.events.closing += on_closing
        result = {'ok': False, 'version': build_info['version'], 'buildRevision': build_info['revision']}

        def verify_renderer():
            # Startup and non-destructive navigation checks in the actual WebView2 runtime.
            try:
                deadline = time.monotonic() + 45
                while time.monotonic() < deadline:
                    state = window.evaluate_js("""(() => ({
                        ready: document.querySelector('#application')?.getAttribute('aria-busy') === 'false',
                        notice: document.querySelector('#startup-notice')?.textContent || '',
                        recipes: document.querySelectorAll('#recipe-list [data-recipe]').length,
                        catalog: document.querySelector('#catalog-count')?.textContent,
                        cubeItems: Array.from(document.querySelectorAll('.grid-item')).map(e => e.getAttribute('aria-label')),
                        recentCrafts: Array.from(document.querySelectorAll('.recent-craft')).map(e => ({number: Number(e.dataset.journal), label: e.getAttribute('aria-label')})),
                        viewport: [innerWidth, innerHeight],
                        page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
                        bridge: typeof window.pywebview?.api?.save_session === 'function',
                        brokenImages: Array.from(document.images).filter(e => e.offsetWidth && e.complete && !e.naturalWidth).map(e=>e.src)
                    }))()""")
                    if state and state.get('ready'):
                        result.update(state)
                        result['ok'] = state['recipes'] == 301 and state['bridge'] and not state['notice'] and state['page'] == state['viewport'] and not state['brokenImages']
                        break
                    if state and state.get('notice'):
                        raise RuntimeError(state['notice'])
                    time.sleep(.1)
                if not result['ok']:
                    result['error'] = 'The embedded workshop did not reach its ready state.'
                else:
                    credits = window.evaluate_js("""(() => {
                        const trigger = document.querySelector('#about-open');
                        const dialog = document.querySelector('#about');
                        trigger.focus(); trigger.click();
                        const rect = dialog.getBoundingClientRect();
                        const links = [...dialog.querySelectorAll('a')].map(a => ({url:a.href, target:a.target, rel:a.rel}));
                        const checks = {
                            opened: dialog.open,
                            creator: document.querySelector('.creator-credit').textContent.trim(),
                            aboutCreator: document.querySelector('#creator-name').textContent.trim(),
                            hostCount: document.querySelectorAll('#host-name, .host-card').length,
                            edition: document.body.dataset.edition,
                            footerLinks: [...document.querySelectorAll('.community-footer a')].map(a => a.href),
                            fits: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
                            links
                        };
                        dialog.querySelector('[data-close="about"]').click();
                        checks.closed = !dialog.open;
                        checks.focusRestored = document.activeElement === trigger;
                        return checks;
                    })()""")
                    result['credits'] = credits
                    expected_edition = build_info['edition']
                    expected_links = ['https://discord.gg/3wWfYubgb3'] if expected_edition == 'community' else []
                    result['ok'] = (all(credits.get(key) for key in ['opened', 'fits', 'closed', 'focusRestored'])
                        and credits['creator'] == 'Created by Falor' and credits['aboutCreator'] == 'Falor'
                        and credits['hostCount'] == 0 and credits['edition'] == expected_edition
                        and [link['url'] for link in credits['links']] == expected_links
                        and credits['footerLinks'] == expected_links
                        and all(link['target'] == '_blank' and 'noopener' in link['rel'] for link in credits['links']))
                    if not result['ok']:
                        result['error'] = 'About / Credits navigation or community links failed verification.'
                flush_session()
                result['sessionSaved'] = store.path.is_file()
                result['frozen'] = bool(getattr(sys, 'frozen', False))
            except Exception:
                result['error'] = traceback.format_exc()
            finally:
                args.self_test.parent.mkdir(parents=True, exist_ok=True)
                args.self_test.write_text(json.dumps(result, indent=2), encoding='utf-8')
                window.destroy()

        webview.start(verify_renderer if args.self_test else None, gui='edgechromium',
            private_mode=False, storage_path=str(profile / 'WebView2'))
        return 0 if not args.self_test or result['ok'] else 1
    finally:
        if server:
            server.shutdown()
            server.server_close()
        lock.close()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        message = f'{error}\n\nThe desktop app requires Microsoft Edge WebView2 Runtime.\nFor Python source, install requirements-desktop.txt and run Build-Web.bat first.'
        profile = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'HSCraftSim'
        profile.mkdir(parents=True, exist_ok=True)
        (profile / 'launcher-error.log').write_text(traceback.format_exc(), encoding='utf-8')
        if '--self-test' not in sys.argv:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, 'HSCraftSim could not start', 0x10)
        sys.exit(1)
