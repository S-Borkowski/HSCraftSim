"""Check native RValue comparison, including optional-argument sentinels."""
import struct
from native_upgrade_oracle import Oracle
from unicorn.x86_const import *

class ComparisonOracle(Oracle):
    def helper(self,uc,address,size,data):
        if address in (0x14b4ea180,0x1401899b0):return
        super().helper(uc,address,size,data)
    def compare(self,a,b,equality=False):
        for address,value in ((0x110000,a),(0x110010,b)):
            self.uc.mem_write(address,struct.pack('<QII',0,0,5) if value is None else struct.pack('<dII',value,0,0))
        rsp=0x3f0008;self.write64(rsp,0x103000)
        for register,value in ((UC_X86_REG_RSP,rsp),(UC_X86_REG_RCX,0x110000),(UC_X86_REG_RDX,0x110010),(UC_X86_REG_R8,0),(UC_X86_REG_R9,0)):
            self.uc.reg_write(register,value)
        self.uc.emu_start(0x1401899b0 if equality else 0x14b4ea180,0x103000,count=100000)
        assert self.uc.reg_read(UC_X86_REG_RIP)==0x103000
        return struct.unpack('<i',struct.pack('<I',self.uc.reg_read(UC_X86_REG_RAX)&0xffffffff))[0]

if __name__=='__main__':
    x=ComparisonOracle()
    for a,b in ((None,None),(None,0),(0,None),(0,0),(1,2),(2,1)):
        print(a,b,x.compare(a,b),x.compare(a,b,True))
