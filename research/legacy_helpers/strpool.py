"""YYC string-pool haritasi: her statik string RValue icin baslatici stub'i tarar.
stub:  48 83 EC 28 | 48 8D 15 d32 (literal) | 48 8D 0D d32 (pool RValue) | E8 rel32 -> YYCreateString
"""
import re, struct, json, sys, fp
CREATE = 0xb4bcca0
def build():
    sec=next(s for s in fp.exe.secs if s['name']=='.text'); base=sec['rva']
    fp.exe.f.seek(sec['praw']); text=fp.exe.f.read(sec['rsz'])
    pat=re.compile(rb'\x48\x83\xec\x28\x48\x8d\x15(....)\x48\x8d\x0d(....)\xe8(....)', re.S)
    out={}
    for m in pat.finditer(text):
        i=m.start()
        d1=struct.unpack('<i',m.group(1))[0]; d2=struct.unpack('<i',m.group(2))[0]; d3=struct.unpack('<i',m.group(3))[0]
        lit=base+i+11+d1; pool=base+i+18+d2; tgt=base+i+23+d3
        if tgt!=CREATE: continue
        s=fp.exe.read(lit,4096) or b''
        z=s.find(b'\0'); s=s[:z] if z>=0 else s
        out[pool]=s.decode('utf-8','replace')
    return out
if __name__=='__main__':
    m=build()
    dst=sys.argv[1] if len(sys.argv)>1 else 'strpool.json'
    json.dump({hex(k):v for k,v in sorted(m.items())}, open(dst,'w',encoding='utf-8'), ensure_ascii=False, indent=0)
    print('strings:',len(m))
    for k in (0x10bc0fb8,0x10bc1058,0x10bc1088): print(hex(k), repr(m.get(k)))
