"""Add current native function/variable/string names to research decompilations."""
from pathlib import Path
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]/'research/current'
routines=json.loads((ROOT/'routines.json').read_text())['routines']
names={0x140000000+rva:name.removeprefix('gml_Script_').removeprefix('gml_GlobalScript_') for name,rva in routines.items()}
strings={0x140000000+int(rva,16):value for rva,value in re.findall(r'^0x([A-Fa-f0-9]+) (.*)$',(ROOT/'variable-initializers.txt').read_text(),re.M)}
slots={int(address,16):name for name,address,_ in (line.split('\t') for line in (ROOT/'variable-slots.txt').read_text().splitlines() if line.count('\t')==2)}
for file in sys.argv[1:]:
    path=ROOT/file
    text=path.read_text(encoding='utf8')
    text=re.sub(r'/\*slot:[^*]*\*/','',text)
    text=re.sub(r'FUN_([0-9a-f]+)',lambda m:names.get(int(m[1],16),m[0]),text)
    def note(match):
        address=int(match[1],16)
        value=slots.get(address)
        if value:return match[0]+'/*slot:'+value+'*/'
        value=strings.get(address)
        return match[0]+('/*string:'+value.replace('*/','')+'*/' if value is not None else '')
    text=re.sub(r'(?:_?DAT_|uRam00000000|0x)([a-f0-9]{9,16})',note,text)
    output=path.with_suffix('.named.c');output.write_text(text,encoding='utf8')
    print(output.name)
