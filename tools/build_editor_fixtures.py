"""Produce independent golden values using the original Item Editor Python code."""
from pathlib import Path
import hashlib
import json
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / '_release_work/HSItemEditor-v2.7.2'
sys.path.insert(0, str(SOURCE))
import generated_pool_model as dynamic
from roll_profile_db import evaluate_seed
from socket_chain import predict_sockets

read = lambda name: json.loads((SOURCE / name).read_text(encoding='utf8'))
models = read('hs_tooltip_roll_models.json')
fixture = {'sourceBuild': models['exeSha256'], 'regular': [], 'dynamic': [], 'sockets': []}
for key, definition in models['definitions'].items():
    if key in dynamic.PROFILE_MODELS:
        continue
    signature = [event['delta'] for event in definition['events']]
    for seed in [1, 123456, 1000000000]:
        evaluation = evaluate_seed(seed, signature)
        values = {}
        for stat in definition['stats']:
            if stat['representation'] == 'range' and stat.get('eventIndex') is not None:
                roll = evaluation.event_rolls[stat['eventIndex']]
                if roll is not None:
                    values[str(stat['statKey'])] = stat['minimum'] + roll
            elif stat['representation'] == 'scalar' and len(stat['values']) == 1:
                values[str(stat['statKey'])] = stat['values'][0]
        fixture['regular'].append({'profile': key, 'seed': seed, 'values': values})
rng = random.Random(438)
for key in dynamic.PROFILE_MODELS:
    for seed in [1, 123456, 1000000000] + [rng.randint(1, 1000000000) for _ in range(37)]:
        result = dynamic.replay(key, seed)
        fixture['dynamic'].append({'profile': key, 'seed': seed, 'state': result['finalState'],
            'values': {str(v['statKey']): [v['value'], v['minimum'], v['maximum'], v['source']] for v in result['visibleAssignments']},
            'identities': [[v['statKey'], v['selectedIdentity'], v.get('fixedValue'), v.get('attempts')] for v in result['identityResults']],
            'calls': len(result['eventPath'])})
for key, entry in read('hs_socket_seeds.json')['seeds'].items():
    for seed in [entry['seed'], entry['previous']['seed'], 123456]:
        fixture['sockets'].append({'profile': key, 'seed': seed,
            'count': predict_sockets(seed, entry['statBounds'], entry['maxSockets'])})
fixture['referenceHashes'] = {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in ['generated_pool_model.py','roll_profile_db.py','socket_chain.py']}
(ROOT / 'tests/editor_golden.json').write_text(json.dumps(fixture, separators=(',', ':')), encoding='utf8')
print({k:len(fixture[k]) for k in ['regular','dynamic','sockets']})
