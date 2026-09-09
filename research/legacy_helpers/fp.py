import json, struct, bisect
from capstone import Cs, CS_ARCH_X86, CS_MODE_64
# Historical 2034 build only. Inputs are supplied locally; no game data is bundled.
import os as _os
import hashlib as _hashlib
from pathlib import Path as _Path
GEXE=_os.environ.get("HS_LEGACY_EXE", "")
ROUT=_os.environ.get("HS_LEGACY_ROUTINES", str(_Path(__file__).with_name("routines_anker.json")))
if not GEXE or not _os.path.isfile(GEXE):
    raise SystemExit("Set HS_LEGACY_EXE to your authorized matching historical executable.")
with open(GEXE,"rb") as _stream:
    if _hashlib.file_digest(_stream,"sha256").hexdigest() != "2034fad4096be6de1147e4ff61b942a706673a9567b10c3013c6393ed0686486":
        raise SystemExit("Unexpected historical executable build.")
if not _os.path.isfile(ROUT):
    raise SystemExit("Set HS_LEGACY_ROUTINES to your matching locally generated routine map.")
IB=0x140000000
md=Cs(CS_ARCH_X86,CS_MODE_64); md.detail=True
class Exe:
    def __init__(s,p):
        s.f=open(p,'rb'); h=s.f.read(0x1000); e=struct.unpack_from('<I',h,0x3c)[0]
        n=struct.unpack_from('<H',h,e+6)[0]; o2=struct.unpack_from('<H',h,e+20)[0]; opt=e+24
        s.ib=struct.unpack_from('<Q',h,opt+24)[0]; s.secs=[]
        for i in range(n):
            o=opt+o2+i*40; nm=h[o:o+8].rstrip(b'\0').decode('latin1','ignore')
            vsz,va,rsz,praw=struct.unpack_from('<IIII',h,o+8)
            s.secs.append(dict(name=nm,rva=va,vsz=vsz,rsz=rsz,praw=praw))
    def read(s,rva,n):
        for x in s.secs:
            if x['rva']<=rva<x['rva']+max(x['vsz'],x['rsz']):
                d=rva-x['rva']
                if d>=x['rsz']: return b'\0'*n
                s.f.seek(x['praw']+d); b=s.f.read(min(n,x['rsz']-d))
                return b+b'\0'*(n-len(b))
        return None
    def sec_of(s,rva):
        return next((x['name'] for x in s.secs if x['rva']<=rva<x['rva']+max(x['vsz'],x['rsz'])), None)
exe=Exe(GEXE)
_r=json.load(open(ROUT,encoding='utf-8'))
ROUTINES={k:v for k,v in _r['routines'].items()}
BYADDR={v:k for k,v in ROUTINES.items()}
STARTS=sorted(BYADDR)
def owner(rva):
    i=bisect.bisect_right(STARTS,rva)-1
    if i<0: return (None,None)
    return (BYADDR[STARTS[i]], rva-STARTS[i])
def extent(rva,cap=0x40000):
    i=bisect.bisect_right(STARTS,rva)
    nxt=STARTS[i] if i<len(STARTS) else rva+cap
    return min(cap, max(0,nxt-rva))
def dis(rva,size=None,limit=None,strings=True):
    size=size or extent(rva)
    code=exe.read(rva,size); out=[]
    for i in md.disasm(code, IB+rva):
        a=i.address-IB
        note=''
        if i.mnemonic=='call':
            try:
                t=int(i.op_str,16)-IB
                nm=BYADDR.get(t)
                note='  ; '+(nm if nm else f'sub_{t:x}')
            except ValueError: note='  ; [indirect]'
        for op in i.operands:
            if op.type==3 and op.mem.base==41:
                t=i.address+i.size+op.mem.disp-IB
                sec=exe.sec_of(t)
                if sec=='.rdata':
                    b=exe.read(t,64)
                    if b:
                        z=b.find(b'\0')
                        if 0<z<48 and all(32<=c<127 for c in b[:z]):
                            note+=f'  ; "{b[:z].decode()}"'
                        elif len(b)>=8:
                            note+=f'  ; [rdata {struct.unpack("<d",b[:8])[0]:g}]'
        out.append((a,i.mnemonic,i.op_str,note,bytes(i.bytes)))
        if limit and len(out)>=limit: break
    return out
def show(rva,limit=None,size=None):
    nm=BYADDR.get(rva) or f'rva_{rva:x}'
    print(f"===== {nm}  rva=0x{rva:x}  uzunluk={extent(rva)} =====")
    for a,m,o,n,b in dis(rva,size=size,limit=limit):
        print(f"  +{a-rva:<5d} 0x{a:07x}  {m:<10s} {o}{n}")
