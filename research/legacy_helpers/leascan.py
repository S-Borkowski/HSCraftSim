"""rip-relative LEA taramasi: hedef RVA kumesine isaret eden tum lea komutlarini bulur."""
import re, struct, fp
_text=None; _rva=None
def _load():
    global _text,_rva
    if _text is None:
        sec=next(s for s in fp.exe.secs if s['name']=='.text'); _rva=sec['rva']
        fp.exe.f.seek(sec['praw']); _text=fp.exe.f.read(sec['rsz'])
PAT=re.compile(rb'[\x48\x4c]\x8d[\x05\x0d\x15\x1d\x25\x2d\x35\x3d]')
def lea_refs(targets):
    """targets: RVA kumesi -> {rva: [site_rva,...]}"""
    _load(); want=set(targets); out={}
    for m in PAT.finditer(_text):
        i=m.start(); disp=struct.unpack_from('<i',_text,i+3)[0]; t=_rva+i+7+disp
        if t in want: out.setdefault(t,[]).append(_rva+i)
    return out
if __name__=='__main__':
    import sys
    tg=[int(x,16) for x in sys.argv[1:]]
    r=lea_refs(tg)
    for t,sites in r.items():
        print(hex(t), [hex(s) for s in sites], [fp.owner(s) for s in sites])
