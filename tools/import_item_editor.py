"""Import the user's Item Editor research without changing the editor or game.

Reproducible, hash-recorded input. Existing current-game icon mappings stay intact.
The source modules validate their own data; their build does not attest ours.
"""
from pathlib import Path
import argparse
import hashlib
import importlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('editor', nargs='?', type=Path,
                        default=ROOT.parent / '_release_work/HSItemEditor-v2.7.2')
    args = parser.parse_args()
    source = args.editor.resolve(strict=True)
    sys.path.insert(0, str(source))
    dynamic = importlib.import_module('generated_pool_model')
    tooltip = importlib.import_module('exact_tooltip')
    semantics = importlib.import_module('stat_semantics')
    socket_chain = importlib.import_module('socket_chain')
    read = lambda name: json.loads((source / name).read_text(encoding='utf8'))
    models = read('hs_tooltip_roll_models.json')
    # Check schema, model integrity, source digests and event-to-stat bindings.
    database = tooltip.load_tooltip_model_database(source / 'hs_tooltip_roll_models.json')
    if not database.available:
        raise ValueError(database.status.message)
    stat_data = semantics._validate_document(read('hs_stat_semantics_s10.json'), models['exeSha256'])
    talents = semantics._validate_talent_table(read('hs_talent_table_s10.json'), models['exeSha256'])
    socket_data = read('hs_socket_seeds.json')
    assert socket_data['schemaVersion'] == 1
    for key, entry in socket_data['seeds'].items():
        assert socket_chain.predict_sockets(entry['seed'], entry['statBounds'], entry['maxSockets']) == entry['sockets'] == entry['maxSockets'], key
        previous = entry['previous']
        assert socket_chain.predict_sockets(previous['seed'], entry['statBounds'], entry['maxSockets']) == previous['sockets'], key

    output = json.loads((ROOT / 'data/item_profiles.json').read_text(encoding='utf8'))
    profiles = output['profiles']
    proofs = read('hs_perfect_roll_profiles.json')['profiles']
    for key, definition in models['definitions'].items():
        profile = profiles.setdefault(key, {})
        profile['tooltip'] = definition
        profile['dynamic'] = dynamic.PROFILE_MODELS.get(key)
        profile['socketChain'] = socket_data['seeds'].get(key)
        proof = proofs.get(key, {})
        profile['perfectSeed'] = proof.get('fieldSeeds', {}).get('a')
        profile['maxSockets'] = proof.get('maxSockets')
        # Keep the previous slim definition for callers inspecting raw ranges.
        if not profile.get('stats'):
            profile['stats'] = [{**stat, 'key': stat['statKey']} for stat in definition['stats']]
    output.update({
        'schemaVersion': 2,
        'sourceBuild': models['exeSha256'],
        'currentBuildVerified': False,
        'semantics': stat_data['stats'],
        'talents': talents,
        'classes': semantics.CLASS_NAMES,
        'generatedPools': dynamic.POOL_TABLES,
        'coverage': {
            'definitions': len(models['definitions']),
            'statSemantics': len(stat_data['stats']),
            'talents': len(talents),
            'dynamicProfiles': len(dynamic.PROFILE_MODELS),
            'measuredSocketChains': len(socket_data['seeds']),
        },
        'editorSource': {
            'directory': str(source),
            'statBuild': models['exeSha256'],
            'socketBuild': socket_data['measuredAgainst']['exeSha256'],
            'files': {name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                      for name in ['hs_tooltip_roll_models.json', 'hs_stat_semantics_s10.json',
                                   'hs_talent_table_s10.json', 'hs_socket_seeds.json',
                                   'hs_perfect_roll_profiles.json', 'generated_pool_model.py']},
        },
    })
    (ROOT / 'data/item_profiles.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print(json.dumps(output['coverage']))
    print('Imported Item Editor models. Current executable equivalence remains unverified.')


if __name__ == '__main__':
    main()
