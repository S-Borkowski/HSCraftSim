"""Read-only parity check before reusing the native instruction fixtures."""
import argparse
import hashlib
import json
from pathlib import Path
import pefile

ROOT=Path(__file__).resolve().parents[1]

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def verify(installed):
    analysis=ROOT/'research/current/HeroSiegeC6E.exe'
    assert digest(analysis)=='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','Unknown analysis build'
    left=pefile.PE(str(analysis),fast_load=True)
    right=pefile.PE(str(installed),fast_load=True)
    assert left.OPTIONAL_HEADER.ImageBase==right.OPTIONAL_HEADER.ImageBase,'Image base changed'
    sections={s.Name:s for s in right.sections};rows=[]
    for source in left.sections:
        target=sections.get(source.Name)
        assert target is not None,('Missing original section',source.Name)
        a,b=source.get_data(),target.get_data()
        assert (source.VirtualAddress,source.Misc_VirtualSize,a)==(target.VirtualAddress,target.Misc_VirtualSize,b),('Native section changed',source.Name)
        rows.append(dict(name=source.Name.decode().rstrip('\0'),rva=source.VirtualAddress,
            virtualSize=source.Misc_VirtualSize,sha256=hashlib.sha256(a).hexdigest(),equal=True))
    return dict(analysisSha256=digest(analysis),installedSha256=digest(installed),sections=rows,
        additionalSections=[s.Name.decode().rstrip('\0') for s in right.sections if s.Name not in {s.Name for s in left.sections}],
        scope='All original PE sections match exactly. File header/entrypoint, added loader sections and runtime plugin behavior are outside this comparison.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('installed',type=Path)
    args=parser.parse_args()
    report=verify(args.installed)
    (ROOT/'research/current/installed-source-parity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('PASS',len(report['sections']),'original native sections match the installed game; additional sections:',report['additionalSections'])
