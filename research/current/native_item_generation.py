"""Inspect current CreateItemNew with fixture-owned repository and runner storage."""
import json,math,struct
from native_runeword_generation import RunewordGenerationOracle,ROOT,Cpr
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

class ItemGenerationOracle(RunewordGenerationOracle):
    def __init__(self,load_talents=True):
        super().__init__()
        self.uc.mem_map(0x1000000,0x1000000)
        self.uc.mem_map(0x3000000,0x2000000)
        routines=json.loads((ROOT/'routines.json').read_text())['routines']
        talent_path=ROOT/'talent-map-native.json'
        self.talent_records={}
        if load_talents and talent_path.exists():
            talent_data=json.loads(talent_path.read_text(encoding='utf8'))
            assert not talent_data['errors'],'Incomplete native talent map'
            assert talent_data['buildSha256']=='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4'
            self.talent_records=talent_data['talents']
        self.script_hooks={0x140000000+routines['gml_Script_'+n]:n for n in ['GetNormalRepoStruct','GetUniqueRepoStruct','CreateItemInit','GenerateItemPrice','GetLocalized','cpr_random','cpr_random_range','cpr_rand32','cpr_choose','GetRuneword']}
        for address in [*self.script_hooks,0x14b4c9cf0,0x14b5380e0,0x14018d2f0,0x14b4c3420,0x14018be80]:self.uc.hook_add(UC_HOOK_CODE,self.service,begin=address,end=address)
        self.observe={0x140000000+a:n for n,a in routines.items() if n in ('gml_Script_ReturnPrefixStats','gml_Script_ReturnSuffixStats','gml_Script_LoadCommonItems','gml_Script_GenerateItemRandomStats','gml_Script_GenerateItemSubSkills','gml_Script_GenerateItemHighRoller','gml_Script_GenerateItemSpecialStats','gml_Script_GetTalentInfo','gml_Script_ReturnSubTalentLevel')}
        for address in self.observe:self.uc.hook_add(UC_HOOK_CODE,self.observe_call,begin=address,end=address)
    def array(self,values):
        if not self.arrays:self.array_elements={};self.array_payloads={};self.next_array_payload=0x3000000
        address=0x1000000+len(self.arrays)*0x100
        assert address+0x100<=0x2000000,'Native item array arena exhausted'
        self.arrays[address]=values;self.uc.mem_write(address,bytes(0x100))
        self.uc.mem_write(address+0x24,struct.pack('<I',len(values)))
        self.sync_array(address)
        return address
    def sync_array(self,owner):
        values=self.arrays[owner];pointer,capacity=self.array_payloads.get(owner,(0,0))
        if len(values)>capacity or not pointer:
            capacity=1<<max(4,(len(values)-1).bit_length())
            pointer=self.next_array_payload;self.next_array_payload+=capacity*16
            assert self.next_array_payload<=0x5000000,'Native array payload arena exhausted'
            self.array_payloads[owner]=(pointer,capacity)
        self.write64(owner+8,pointer);self.uc.mem_write(owner+0x24,struct.pack('<I',len(values)))
        for index,value in enumerate(values):super().put(pointer+16*index,value)
    def observe_call(self,uc,address,size,data):
        self.trace.append([self.observe[address],self.args(uc.reg_read(UC_X86_REG_R9),40)])
    def service(self,uc,address,size,data):
        for (owner,index),pointer in getattr(self,'lvalues',{}).items():self.arrays[owner][index]=self.value(pointer)
        rcx,rdx,r8,r9=[uc.reg_read(r) for r in (UC_X86_REG_RCX,UC_X86_REG_RDX,UC_X86_REG_R8,UC_X86_REG_R9)]
        result=r8
        if getattr(self,'diagnostics',False):
            if address==0x14b4ea180:self.trace.append(['compare',hex(self.stack64(0)),self.value(rcx),self.value(rdx)])
            if address in (0x1407213f0,0x140721da0):self.trace.append(['random-call',hex(self.stack64(0))])
            if address==0x14b4c6210:
                name=self.ids[self.stack64(40)&0xffffffff]
                if name.startswith(('ds_list','array_','@@NewGMLArray')):
                    self.trace.append(['collection',name,self.args(r9,48)])
        if address==0x14018be80:
            # RValue reference payload copy. Its caller already copies type/
            # flags; fixture-owned arrays need no runner GC registration.
            uc.mem_write(rcx,bytes(uc.mem_read(rdx,8)));result=rcx
        elif address==0x14b4c3420:pass # array reference bookkeeping
        elif address in (0x14018d280,0x14018d2f0):
            kind=int.from_bytes(uc.mem_read(rcx+12,4),'little')&0xffffff
            owner=self.value(rcx) if kind!=0xffffff else None
            if address==0x14018d280:
                assert owner in self.arrays and 0<=rdx<len(self.arrays[owner]), 'Read outside native fixture array'
            if owner is None:owner=self.array([]);self.put(rcx,owner)
            index=int(rdx);array=self.arrays[owner]
            if index>=len(array):
                array.extend([None]*(index+1-len(array)));uc.mem_write(owner+0x24,struct.pack('<I',len(array)))
            pair=(owner,index)
            if pair not in self.lvalues:
                self.lvalues[pair]=0x180000+16*len(self.lvalues);self.put(self.lvalues[pair],array[index])
            result=self.lvalues[pair]
        elif address in self.script_hooks:
            name=self.script_hooks[address]
            if name=='CreateItemInit':
                seed=self.args(r9,40)[0];self.rng=Cpr(seed);self.trace.append(['init',seed]);self.put(r8,None)
            elif name=='GetRuneword':
                assert not any(self.definition.get('s'+str(i)) for i in range(1,7)), 'Socketed native fixtures require the Runeword repository'
                self.put(r8,0)
            elif name=='cpr_choose':
                args=self.args(r9,40);index=self.rng.irandom(len(args)-1);self.trace.append(['choose',args,index]);self.put(r8,args[index])
            elif name=='cpr_rand32':
                self.rng.irandom(0);self.trace.append(['advance']);self.put(r8,None)
            elif name.startswith('cpr_random'):
                args=self.args(r9,40);lo,hi=(0,args[0]) if len(args)==1 else args
                self.rng.irandom(0);value=lo+(hi-lo)*self.rng.state/1073741823
                self.trace.append(['float',lo,hi,value]);self.put(r8,value)
            elif name in ('GenerateItemPrice','GetLocalized'):self.put(r8,0)
            else:self.put(r8,101)
        elif address==0x130200:
            # Native functions retain pointers to global RValues. Each global
            # must have its own address: aliasing language=0 and zrm=99 here
            # silently changed later random bounds to zero.
            member=rdx&0xffffffff;name=self.ids[member];result=0x300000+16*(member-1000)
            if name=='subTalentMap' and self.player_subtalents is None:self.player_subtalents=self.array([102]*101)
            constants={'zrm':99,'zpm1':0.01,'cpr_rand_max':1073741823,'mplr':100,'talentStructMap':100,'subTalentMap':self.player_subtalents,'language':0,'___struct___36':100}
            if name not in constants:raise ValueError(('Missing global',name,hex(self.stack64(0))))
            self.put(result,constants[name])
        elif address==0x14b4c9cf0:
            name=self.ids[rdx&0xffffffff];value=self.value(r9);self.handles[name]=value
            if name=='itemInfoStruct':self.info=self.objects[value]
            if name=='itemStatStruct':self.current=self.objects[value]
        elif address==0x14b5380e0:
            owner=self.value(r8);key=self.value(r9);value=self.value(self.stack64(40));self.objects[owner][int(key)]=value
        elif address==0x14b4c9800 and r8==0x80000000 and self.value(rcx) in getattr(self,'talent_objects',set()):
            owner=self.value(rcx);name=self.ids[rdx&0xffffffff];result=r9
            assert name in self.objects[owner],('Missing native talent field',owner,name)
            self.put(result,self.objects[owner][name])
            self.trace.append(['talentInfo',owner-70000000,name,self.objects[owner][name]])
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff]=='gDataProtected' and r8==0x137:
            result=r9;self.put(result,self.rng.state)
        elif address==0x14b4c9800 and self.ids[rdx&0xffffffff] not in self.handles:
            raise ValueError(('missing member',self.ids[rdx&0xffffffff],hex(self.stack64(0))))
        elif address==0x14b4c6210:
            name=self.ids[self.stack64(40)&0xffffffff];args=self.args(r9,48)
            if name=='struct_get_from_hash':
                field=self.ids[int(args[1])];value=self.objects[args[0]].get(field)
                self.trace.append(['hashed',args[0],field,value])
            elif name=='@@NewGMLObject@@':value=300+len(self.objects);self.objects[value]={}
            elif name=='struct_set_from_hash':self.definition[self.ids[int(args[1])]]=args[2];value=None
            elif name=='variable_struct_set':self.objects[args[0]][int(args[1])]=args[2];value=None
            elif name=='floor':value=math.floor(args[0])
            elif name=='ds_map_find_value':
                assert self.talent_records,'A verified talent map is required for native skill selection'
                assert args[0] in (100,102),('Unsupported map',args)
                # Player context for item fixtures has no allocated subtalents.
                # Keep this separate from the extracted global talent definitions.
                record=self.talent_records.get(str(int(args[1]))) if args[0]==100 else None
                value=None
                if record is not None:
                    value=70000000+int(args[1])
                    if value not in self.talent_objects:
                        self.talent_objects.add(value);self.objects[value]={}
                        for field,contents in record.items():
                            if isinstance(contents,list):contents=self.array(list(contents))
                            elif isinstance(contents,str):
                                handle=50000000+len(self.strings);self.strings[handle]=contents;contents=handle
                            self.objects[value][field]=contents
            elif name=='real':value=float(self.strings[args[0]]) if args[0] in self.strings else args[0]
            elif name=='lerp':value=args[0]+(args[1]-args[0])*args[2]
            elif name=='ds_list_create':value=self.array([])
            elif name=='ds_list_add':self.arrays[args[0]].extend(args[1:]);value=None
            elif name=='ds_list_size':value=len(self.arrays[args[0]])
            elif name=='ds_list_find_value':
                values=self.arrays[args[0]];index=int(args[1])
                # A DS list does not support Python's negative indexing. Keep
                # undefined distinct from zero so native guards run normally.
                value=values[index] if 0<=index<len(values) else getattr(self,'empty_list_value',None)
                if not 0<=index<len(values):self.trace.append(['empty_list',index,value])
            elif name=='ds_list_destroy':value=None
            elif name=='ds_list_delete':
                values=self.arrays[args[0]];index=int(args[1])
                if 0<=index<len(values):del values[index]
                value=None
            elif name=='array_contains':value=args[1] in self.arrays[args[0]]
            elif name=='string':
                text='undefined' if args[0] is None else str(int(args[0])) if isinstance(args[0],(float,int)) and args[0]==int(args[0]) else str(args[0])
                value=next((k for k,v in self.strings.items()if v==text),None)
                if value is None:value=50000000+len(self.strings);self.strings[value]=text
            else:return super().service(uc,address,size,data)
            self.put(r8,value)
        elif address==0x14b4c6340:
            name=self.methods[self.value(self.stack64(40))];args=self.args(r9,48)
            if name in ('GetItemDef','GetBaseItemDef'):self.trace.append(['read',name,self.strings[args[0]],self.definition.get(self.strings[args[0]])])
            if name=='GetItemInfo':value=self.info.get(int(args[0]),args[1] if len(args)>1 else None)
            elif name=='SetItemDef':self.definition[self.strings[args[0]]]=args[1];value=None
            elif name=='GetBaseItemDef':value=self.baseDefinition.get(self.strings[args[0]])
            elif name=='GetBaseItemInfo':value=self.baseinfo.get(int(args[0]),args[1] if len(args)>1 else -1)
            elif name=='GenerateItemHash':value=None
            else:return super().service(uc,address,size,data)
            if name in ('GetItemInfo','GetBaseItemInfo'):self.trace.append(['info',name,args,value])
            self.put(r8,value)
        else:return super().service(uc,address,size,data)
        uc.reg_write(UC_X86_REG_RAX,result);uc.reg_write(UC_X86_REG_RIP,self.stack64(0));uc.reg_write(UC_X86_REG_RSP,uc.reg_read(UC_X86_REG_RSP)+8)
    def capture_item(self,row,definition,itemType=1,*,entry=0x1406ee020,params=None,instruction_limit=3000000):
        self.arrays={};self.lvalues={};self.talent_objects=set();self.player_subtalents=None;self.definition=dict(definition);self.info={};self.current={};self.trace=[];self.rng=Cpr(definition['a'])
        self.base={};self.baseDefinition={key:definition.get(key,0) for key in ('b','c','j')};self.baseinfo={27:6 if definition.get('c') else 1,7:0,21:1,32:2,1:1,2:1,3:1,31:10000,34:8}
        special_tables={16:{},18:{}}
        for name,args in row['calls']:
            if name in ('SetBaseItemStat','itemBaseStatStruct'):
                key,value=args;self.base[int(key)]=self.array(value) if isinstance(value,list) else value
            elif name in ('SetBaseItemInfo','itemBaseInfoStruct'):
                key,value=args
                if int(key) not in (11,28,29,36,47,48,51,52):self.baseinfo[int(key)]=value
            elif name in ('SetBaseItemDamageTypeStat','SetBaseItemSocketStat'):
                group,key,value=args;table=special_tables[16 if name=='SetBaseItemDamageTypeStat' else 18]
                table.setdefault(int(group),{})[int(key)]=self.array(value) if isinstance(value,list) else value
        self.objects={10:self.definition,11:self.base,12:self.baseinfo,13:self.info,14:self.current,15:self.baseDefinition,102:{}}
        for table,groups in special_tables.items():
            self.objects[table]={}
            for group,stats in groups.items():
                owner=800+len(self.objects);self.objects[owner]=stats;self.objects[table][group]=owner
        for key,value in self.definition.items():
            if isinstance(value,dict):
                owner=800+len(self.objects);self.objects[owner]=dict(value);self.definition[key]=owner
        self.handles={'itemType':itemType,'itemDefinitionStruct':10,'itemBaseDefinitionStruct':15,'itemBaseStatStruct':11,'itemBaseInfoStruct':12,'itemInfoStruct':13,'itemStatStruct':14,
                      'itemBaseDamageTypeStatStruct':16 if special_tables[16] else None,'itemBaseRandomStatStruct':None,'itemBaseSocketStatStruct':18 if special_tables[18] else None,
                      **{n:i+20 for i,n in enumerate(['GetItemDef','GetItemInfo','GetItemStat','SetItemStat','SetItemInfo','AddStat','GetBaseItemStat','GetBaseItemInfo','SetItemDef','GenerateItemHash','GetBaseItemDef'])}}
        self.methods={v:k for k,v in self.handles.items() if isinstance(v,int) and 20<=v<100}
        params=(100,0) if params is None else params
        for i,value in enumerate(params):
            self.put(0x110000+16*i,value);self.write64(0x111000+8*i,0x110000+16*i)
        rsp=0x3f0008;self.write64(rsp,0x103000);self.write64(rsp+40,0x111000)
        self.put(0x112000,None)
        for reg,value in [(UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0),(UC_X86_REG_RDX,0),(UC_X86_REG_R8,0x112000),(UC_X86_REG_R9,len(params))]:self.uc.reg_write(reg,value)
        try:self.uc.emu_start(entry,0x103000,count=instruction_limit)
        except Exception:
            print('Stopped',hex(self.uc.reg_read(UC_X86_REG_RIP)),self.trace[-12:],self.current,flush=True);raise
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return {'stats':self.current,'info':self.info,'trace':self.trace}

if __name__=='__main__':
    data=json.loads((ROOT/'equipment-definitions-native.json').read_text());row=next(r for r in data['gml_Script_DefineItemUniqueChests']['rows']if r['b']==2)
    x=ItemGenerationOracle();print(json.dumps(x.capture_item(row,{'a':123456,'b':2,'c':1,'j':0}),indent=2))
