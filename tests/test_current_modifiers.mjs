import assert from 'node:assert/strict';
import fs from 'node:fs';
import { starUpgrade, modifyDefinitionValue } from '../engine/item_modifiers.js';
import { MODIFIER_RULES } from '../engine/modifier_rules.js';
import { CRYSTAL_RULES } from '../engine/crystal_rules.js';
import { crystalValue } from '../engine/crystal.js';
const read = name => JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const table = read('./current_upgrade_native.json');
assert.equal(table.buildSha256,MODIFIER_RULES.buildSha256);
for (const row of table.rows) assert.deepEqual(starUpgrade(row.key,row.tier),{amount:row.amount,additive:row.additive});
const golden=read('./current_modifier_native.json');
assert.equal(golden.buildSha256,MODIFIER_RULES.buildSha256);
for (const row of golden.rows) {
  const actual=modifyDefinitionValue(row.key,row.value,row);
  assert.ok(Math.abs(actual-row.expected)<1e-9,`${JSON.stringify(row)}; got ${actual}`);
}
console.log(`PASS current game native differential: ${table.rows.length} upgrade table cases; ${golden.rows.length} star/corruption values.`);
const crystals=read('./current_crystal_native.json');
assert.equal(crystals.buildSha256,CRYSTAL_RULES.buildSha256);
for (const row of crystals.rows) {
  const entry=CRYSTAL_RULES.pools[row.group][row.selector];
  const actual=crystalValue(row,entry.maximum-entry.minimum);
  assert.equal(actual.key,row.key);
  assert.equal(actual.value,row.expected,JSON.stringify(row));
}
console.log(`PASS ${crystals.rows.length} native Crystal values, including existing stats and charm multipliers.`);
