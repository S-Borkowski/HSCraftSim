"""Execute special element and gem-triggered equipment bonuses independently."""
import json
from native_item_generation import ItemGenerationOracle,ROOT
from audit_generation_coverage import equipment_rows
from unicorn import UC_HOOK_CODE

class SpecialOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__()
        self.uc.hook_add(UC_HOOK_CODE,self.initialize,begin=0x140705cc0,end=0x140705cc0)
    def initialize(self,uc,*_):
        self.current.update(self.starting_stats)
    def service(self,uc,address,size,data):
        mutation=None
        if address==0x14b4c6210:
            from unicorn.x86_const import UC_X86_REG_R9
            name=self.ids[self.stack64(40)&0xffffffff]
            if name in ('array_sort','array_push','ds_list_add','ds_list_delete'):
                mutation=self.args(uc.reg_read(UC_X86_REG_R9),48)[0]
        result=super().service(uc,address,size,data)
        if mutation is not None:self.sync_array(mutation)
        return result
    def capture(self,row,definition,cls,existing):
        self.starting_stats=existing
        return self.capture_item(row,definition,cls,entry=0x140705cc0,params=(100,101,definition['b'],cls,definition.get('c',0)))

if __name__=='__main__':
    x=SpecialOracle();fixtures=[];rules={};errors=[]
    for key,cls,sub,row in equipment_rows():
        if not key.startswith('unique:'):continue
        calls=[(n,a) for n,a in row['calls'] if n in ('SetBaseItemDamageTypeStat','SetBaseItemSocketStat')]
        if not calls:continue
        rules[key]={'damage':{},'socket':{}}
        for name,(group,stat,value) in calls:
            rules[key]['damage' if name=='SetBaseItemDamageTypeStat' else 'socket'].setdefault(group,{})[stat]=value if isinstance(value,list) else [value]
        groups=rules[key]['socket']
        cases=[('empty',{})]+[(str(gem),{'s1':{'a':1,'b':gem,'c':0,'j':0}}) for gem in groups]
        if groups:cases.append(('two-identical',{'s1':{'a':1,'b':next(iter(groups))},'s2':{'a':2,'b':next(iter(groups))}}))
        if groups:
            cases.extend([('unmatched-first',{'s1':{'b':9999},'s2':{'b':next(iter(groups))}}),
                          ('mixed',{'s1':{'b':next(iter(groups))},'s2':{'b':list(groups)[-1]}}),
                          ('last-slot',{'s6':{'b':next(iter(groups))}})])
        for seed in (1,42,123456,999999937):
            for label,payload in cases:
                definition={'a':seed,'b':row['b'],'c':1,'j':sub,**payload}
                try:
                    result=x.capture(row,definition,cls,{20:6,25:100})
                    fixtures.append({'profile':key,'case':label,'definition':definition,'initial':{20:6,25:100},'values':result['stats'],'draws':[t[1:] for t in result['trace'] if t[0]=='draw']})
                except Exception as error:errors.append({'profile':key,'case':label,'error':repr(error)});break
        print('Captured',key,flush=True)
    (ROOT/'special-generation-native.json').write_text(json.dumps({'buildSha256':'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4','rules':rules,'fixtures':fixtures,'errors':errors},separators=(',',':'))+'\n',encoding='utf8')
    print(len(fixtures),'special cases;',len(errors),'errors',flush=True)
