import { NORMAL_NAME_RULES as rules } from './normal_name_rules.js';
import { normalAffixes } from './normal_affixes.js';

// LoadCommonItems keeps one name from each side. Class/all-skill names
// become sticky once selected; Superior adds a separate leading adjective.
export function normalNameParts(item,state) {
  const generated=normalAffixes(item,state);
  if(!generated)return null;
  const superior=state.superiorPrefix==null?'':rules.prefixes[state.superiorPrefix]+' ';
  let prefixId=0,suffixId=0;
  for(const affix of generated.affixes.slice(state.superiorPrefix==null?0:1)) {
    if(affix.side==='prefix') {
      if(![676,181,182,183,184,185].includes(prefixId))prefixId=affix.id;
    } else if(suffixId!==544)suffixId=affix.id;
  }
  return {
    prefix:superior+(prefixId?rules.prefixes[prefixId]+' ':''),
    suffix:suffixId?' '+rules.of+' '+rules.suffixes[suffixId]:'',
  };
}
