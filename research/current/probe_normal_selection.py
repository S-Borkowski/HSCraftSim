"""Record native normal-generation decisions without touching game state."""
import json
from probe_common_generation import CommonOracle
from audit_generation_coverage import equipment_rows, ROOT
from unicorn.x86_const import UC_X86_REG_R9, UC_X86_REG_RSP


class SelectionOracle(CommonOracle):
    def local_value(self, address):
        try:
            return self.value(address)
        except ValueError:
            return None

    def service(self, uc, address, size, data):
        if address in (0x1407213f0, 0x140721da0):
            self.trace.append(['rngAt', hex(self.stack64(0))])
            if 0x1440b8790 <= self.stack64(0) <= 0x1441b4a6b:
                frame = uc.reg_read(UC_X86_REG_RSP) + 8
                self.trace.append(['locals', {hex(offset): self.local_value(frame+offset) for offset in range(0x17db8, 0x18128, 16)}])
        if address == 0x14b4c6210:
            name = self.ids[self.stack64(40) & 0xffffffff]
            if name in ('ds_list_create', 'ds_list_add', 'ds_list_delete', 'ds_list_destroy'):
                self.trace.append(['listAt', hex(self.stack64(0)), name, self.args(uc.reg_read(UC_X86_REG_R9), 48)])
        return super().service(uc, address, size, data)


def main():
    oracle = SelectionOracle()
    output = []
    for key in ('normal:3:1:14', 'normal:0:0:1', 'normal:7:0:1'):
        _, cls, sub, row = next(r for r in equipment_rows() if r[0] == key)
        for seed in (1, 2, 3, 4, 42, 123456):
            definition = dict(a=seed, b=row['b'], c=0, j=sub, p=0, r=0)
            result = oracle.capture(row, definition, cls)
            result['stats'] = {k: oracle.arrays.get(v, v) for k, v in result['stats'].items()}
            output.append(dict(profile=key, definition=definition, **result))
            print(key, seed, 'rarity', result['info'].get(27), 'stats', result['stats'], flush=True)
    (ROOT / 'normal-selection-diagnostic.json').write_text(json.dumps(output, separators=(',', ':')), encoding='utf8')


if __name__ == '__main__':
    main()
