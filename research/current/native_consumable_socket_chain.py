"""Follow captured consumable metadata through original creation and socket gate.

Only CreateItemNew's prefix through the base-info copy runs here. Repository
and runner storage are fixtures; later item stats/effects are outside this
boundary. GetItemInfo and the Add Sockets decision execute native code too.
"""
import json
from native_item_generation import ItemGenerationOracle, ROOT
from native_socket_restriction import SocketRestrictionOracle
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RIP

BOUNDARY = 0x1406ef138  # Loop exit, before reading itemBaseStatStruct.


class ConsumableInfoOracle(ItemGenerationOracle):
    def __init__(self):
        super().__init__(load_talents=False)
        self.uc.hook_add(UC_HOOK_CODE, self.stop, begin=BOUNDARY, end=BOUNDARY)

    def stop(self, uc, *_):
        self.reached = True
        uc.reg_write(UC_X86_REG_RIP, 0x103000)
        uc.emu_stop()

    def capture(self, row, seed):
        self.reached = False
        result = self.capture_item(row, {'a': seed, 'b': row['b'], 'c': 0, 'j': 0}, 11)
        assert self.reached, 'Native base-info copy boundary was not reached'
        return result['info']


if __name__ == '__main__':
    definitions = json.loads((ROOT/'consumable-restrictions-native.json').read_text(encoding='utf8'))
    creator = ConsumableInfoOracle()
    gate = SocketRestrictionOracle()
    fixtures = []
    assert sorted(row['b'] for row in definitions['rows']) == list(range(27))
    for row in sorted(definitions['rows'], key=lambda row: row['b']):
        assert not row['deferred'], row
        base = {int(k): v for name, (k, v) in row['calls'] if name in ('itemBaseInfoStruct', 'SetBaseItemInfo')}
        for seed in (1, 123456, 999999937):
            info = creator.capture(row, seed)
            assert (50 in info) == (50 in base)
            assert info.get(50) == base.get(50)
            resolved = gate.read_info(info, [50, None])
            # Neutral rarity/count isolate this flag, not complete recipe eligibility.
            allowed = gate.capture(11, 1, resolved, None, 0)
            fixtures.append(dict(b=row['b'], seed=seed, basePresent=50 in base,
                                 baseValue=base.get(50), itemPresent=50 in info,
                                 itemValue=info.get(50), resolved=resolved, gateAllowed=allowed))
        print('Verified consumable', row['b'], 'base -> instance -> getter -> socket gate', flush=True)
    output = dict(buildSha256=definitions['buildSha256'], boundary=hex(BOUNDARY),
                  source='Captured normal consumable definitions through original CreateItemNew base-info copy, GetItemInfo and Add Sockets gate; other eligibility inputs neutral.',
                  fixtures=fixtures)
    (ROOT.parent.parent/'tests/current_consumable_socket_native.json').write_text(
        json.dumps(output, separators=(',', ':'))+'\n', encoding='utf8', newline='\n')
    print('Captured', len(fixtures), 'native consumable socket chains.', flush=True)
