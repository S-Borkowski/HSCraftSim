"""Observe normal rarity/affix selection and native collection contents."""
import json
from audit_generation_coverage import equipment_rows,ROOT
from native_natural_sockets import NaturalSocketOracle
from unicorn.x86_const import UC_X86_REG_R9

class CommonOracle(NaturalSocketOracle):
    def service(self,uc,address,size,data):
        if address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff];args=self.args(uc.reg_read(UC_X86_REG_R9),48)
            if name in ('ds_list_find_value','ds_list_size'):
                self.trace.append(['pool',hex(self.stack64(0)),name,list(self.arrays.get(args[0],[])),args[1:]])
        if address==0x14b4c6340:
            name=self.methods[self.value(self.stack64(40))];args=self.args(uc.reg_read(UC_X86_REG_R9),48)
            if name=='SetItemInfo':self.trace.append(['writeInfo',hex(self.stack64(0)),*args])
        return super().service(uc,address,size,data)

def main():
    key,cls,sub,row=next(r for r in equipment_rows() if r[0]=='normal:3:1:14')
    oracle=CommonOracle();output=[]
    for n in (None,0,1,2,3,4,5,6,7):
        for seed in (1,42,123456):
            definition={'a':seed,'b':14,'c':0,'j':1,'p':0,'r':0}
            if n is not None:definition['n']=n
            try:
                result=oracle.capture(row,definition,cls)
                result['definition']=definition
                output.append(result)
                print(json.dumps({'seed':seed,'n':n,'rarity':result['info'].get(27),'affixes':[t for t in result['trace'] if t[0] in ('gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats')],'draws':[t for t in result['trace'] if t[0]=='draw']}),flush=True)
            except Exception as error:print('FAILED',n,seed,repr(error),flush=True)
    (ROOT/'common-generation-probes.json').write_text(json.dumps(output,separators=(',',':')),encoding='utf8')

if __name__=='__main__':main()
