"""Local-only, dependency-free HSCraftSim launcher. Does not access game/save files."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, json, sys, threading, urllib.request, webbrowser

ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.ttf':'font/ttf'}
    def do_GET(self):
        if self.path=='/_health':
            body=b'{"application":"HSCraftSim","version":2}'
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            return
        if self.path=='/':self.path='/ui/'
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()
    def log_message(self,*args):pass
    def list_directory(self,path):
        self.send_error(403,'Directory listing disabled')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--port',type=int,default=17870)
    args=parser.parse_args()
    from tools.local_data import inspect
    data_status=inspect(ROOT)
    if data_status['missing']:
        raise RuntimeError('Local simulator data is required for this source checkout. '
                           'See LOCAL-DATA.md and run python tools/local_data.py import --from <authorized-local-workspace>.')
    for port in range(args.port,args.port+10):
        url=f'http://127.0.0.1:{port}'
        try:
            with urllib.request.urlopen(url+'/_health',timeout=.4) as r:
                if json.load(r).get('application')=='HSCraftSim':
                    if not args.no_browser:webbrowser.open(url+'/ui/')
                    print(url+'/ui/');return
        except Exception:pass
        try:server=ThreadingHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(ROOT)))
        except OSError:continue
        if not args.no_browser:threading.Timer(.4,lambda:webbrowser.open(url+'/ui/')).start()
        print(url+'/ui/',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
        return
    raise RuntimeError('No available port in the requested range.')

if __name__=='__main__':
    try:main()
    except Exception as e:
        (ROOT/'launcher-error.log').write_text(str(e),encoding='utf8')
        raise
