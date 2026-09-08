"""Capture The Dawn Bringer through CreateItemNew's natural socket assignment.

Uses the original case definition, runner storage and controlled CPR services.
Stops before Crystal affixes, special tails and socket contents. Does not run
or edit the user's game. No full-item emulation claim is made.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from unicorn.x86_const import UC_X86_REG_R9, UC_X86_REG_RIP


class DawnSocketOracle(ItemGenerationOracle):
    def service(self, uc, address, size, data):
        if self.script_hooks.get(address) == 'CreateItemInit':
            return  # Execute the original initializer rather than its investigation stub.
        stop = False
        if address == 0x14b4c6340:
            name = self.methods[self.value(self.stack64(40))]
            args = self.args(uc.reg_read(UC_X86_REG_R9), 48)
            stop = name == 'SetItemStat' and args[0] == 20
            if stop:
                self.socket_caller = hex(self.stack64(0))
        super().service(uc, address, size, data)
        if stop:
            self.reached_socket = True
            uc.reg_write(UC_X86_REG_RIP, 0x103000)
            uc.emu_stop()

    def capture_socket(self, row, definition):
        self.reached_socket = False
        result = self.capture_item(row, definition, 3)
        assert self.reached_socket, 'Original socket assignment was not reached'
        return result


def main():
    data = json.loads((ROOT / 'equipment-definitions-native.json').read_text(encoding='utf8'))
    row = next(r for r in data['gml_Script_DefineItemUniqueWeaponsMace']['rows'] if r['b'] == 18)
    stats = {str(args[0]): args[1] if isinstance(args[1], list) else [args[1]]
             for name, args in row['calls'] if name in ('SetBaseItemStat', 'itemBaseStatStruct')}
    # This case has no generated pool, random-skill or damage-type setter.
    assert all(name in ('SetBaseItemStat', 'itemBaseStatStruct', 'SetBaseItemInfo', 'itemBaseInfoStruct') for name, _ in row['calls'])
    base = {k: v for k, v in stats.items() if k != '20'}
    order = sorted((int(k) for k, v in base.items() if len(v) == 2), key=str)
    bounds = [base[str(k)][1] - base[str(k)][0] for k in order] + [2, 4] * 4 + [1]
    assert stats['20'] == [4, 5] and len(order) == 8
    oracle = DawnSocketOracle()
    fixtures = []
    def capture(definition):
        result = oracle.capture_socket(row, definition)
        draws = [t[1:] for t in result['trace'] if t[0] == 'draw']
        assert [t[:2] for t in draws] == [[0, upper] for upper in bounds], definition
        fixtures.append({'definition': definition, 'count': result['stats'][20],
                         'values': result['stats'], 'draws': draws})
        if len(fixtures) % 100 == 0:
            print('Captured', len(fixtures), 'Dawn Bringer cases', flush=True)
    for seed in [*range(1, 31), 123456, 999999937]:
        for stars, corrupted in [*( (p, 0) for p in range(6)), (0, 1)]:
            for crystal in range(3):
                capture({'a': seed, 'b': 18, 'c': 1, 'j': 3, 'p': stars, 'r': corrupted, 'q': crystal})
    # The native Unique definition's own range wins over the legacy s field.
    for seed in (1, 42, 123456):
        for socket_seed in (0, 1, 123456):
            capture({'a': seed, 'b': 18, 'c': 1, 'j': 3, 's': socket_seed})
    build = 'c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4'
    rule = {'range': stats['20'], 'base': {'order': order, 'stats': base}}
    result = {'buildSha256': build, 'socketAssignmentReturn': oracle.socket_caller,
              'boundary': 'Original CreateItemNew through first SetItemStat(20); later stages excluded.',
              'fixtures': fixtures}
    (ROOT.parent.parent / 'tests/current_dawn_sockets_native.json').write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf8', newline='\n')
    (ROOT.parent.parent / 'engine/natural_socket_rules.js').write_text(
        '// Verified static Unique base and natural socket stages. Later effects are separate.\n'
        '// Source: native_dawn_sockets.py, supplied game SHA256 ' + build + '\n'
        'export const NATURAL_SOCKET_RULES = ' + json.dumps({'unique:3:3:18': rule}, separators=(',', ':')) + ';\n', encoding='utf8', newline='\n')
    print('Captured', len(fixtures), 'native Dawn Bringer base/socket cases at', oracle.socket_caller)


if __name__ == '__main__':
    main()
