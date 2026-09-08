import { SOCKETABLE_RULES } from './socketable_rules.js';

export const socketableRequiredLevel = id => SOCKETABLE_RULES.requiredLevels[id];

/** CreateItemNew keeps the highest level of the base and active socket items. */
export function socketRequiredLevel(item, count, baseLevel = item.info.requiredLevel ?? item.row?.lvl ?? 0) {
  let level = baseLevel;
  for (let i = 1; i <= Math.min(count ?? 0, 6); i++) {
    try {
      const def = JSON.parse(atob(item.def[`s${i}`]));
      if (def && !def.c) level = Math.max(level, socketableRequiredLevel(def.b) ?? 0);
    } catch { /* Unknown contents are reported by socketContents/applySocketStats. */ }
  }
  return level;
}
