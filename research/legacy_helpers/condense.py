
import sys, re
keep = re.compile(r'ID_|RV\(|STR\(|GLOBAL\(|CallBuiltin\(|GetVar\(|SetVar\(|BufferWrite\(|Compare\(|\bif \(|while|goto|code_r|[A-Za-z_]+\(param_1,param_2|return|else')
noise = re.compile(r'FREE\(|COPY\(|LocalsInit|LocalsFree|RVdtor|uStack_[0-9a-f]+ = 0;|= 0xffffff;|& 0x46U\) != 0\) \{|^\s*\}\s*$')
for f in sys.argv[1:]:
    print("######", f)
    for i, line in enumerate(open(f, encoding="utf-8", errors="ignore")):
        l = line.rstrip()
        if keep.search(l) and not noise.search(l):
            print(f"{i+1:5d} {l.strip()[:200]}")
