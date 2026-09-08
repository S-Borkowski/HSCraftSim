// node tests/test_mechanics.mjs — sanity checks of the transcribed cube mechanics
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Sim, UniformRng } from "../engine/index.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, "data", p), "utf8"));
const sim = new Sim({ recipes: read("recipes.json"), catalog: read("items_catalog.json"), statNames: read("stat_names.json"), pools: read("stat_pools.json"), attributes: read("translations/attributes.json") });

const byType = (rt) => sim.recipes.find((r) => r.resultType === rt);

// 1. every recipe has a known mechanic
for (const r of sim.recipes) assert.notEqual(r.mechanic, "unknown", `recipe ${r.index} rt=${r.resultType}`);

// 2. Satanic crystal on a common helmet: ~50% affix / ~50% corrupted, never socket
{
  const helmet = sim.makeItem(0, 1, { a: 12345 });
  const crystal = sim.makeItem(14, 58, { a: 1 });
  const stacks = [{ item: helmet, amount: 1 }, { item: crystal, amount: 1 }];
  const recipe = byType(42);
  assert.ok(recipe && sim.available(stacks).some((x) => x.recipe === recipe), "satanic crystal recipe should match");
  const p = sim.monteCarlo(recipe, stacks, 20000, 7);
  assert.ok(Math.abs(p.affix - 0.5) < 0.02 && Math.abs(p.corrupted - 0.5) < 0.02 && !p.socket, JSON.stringify(p));
}

// 3. Satanic dice: 38% corruption
{
  const item = sim.makeItem(3, 5, { a: 999, c: 1 }, { isUnique: true });
  const dice = sim.makeItem(14, 43, { a: 1 });
  const stacks = [{ item, amount: 1 }, { item: dice, amount: 1 }];
  const recipe = byType(18);
  const p = sim.monteCarlo(recipe, stacks, 20000, 3);
  assert.ok(Math.abs((p.corrupted || 0) - 0.38) < 0.02, JSON.stringify(p));
}

// 4. Rune merge (rt 0): 3x Ol -> 1x Old
{
  const ol = sim.makeItem(15, 1, { a: 1 });
  const stacks = [{ item: ol, amount: 3 }];
  const recipes = sim.available(stacks).map((x) => x.recipe);
  const merge = recipes.find((r) => r.result.itemId === 2 && r.result.itemType === 15);
  assert.ok(merge, "Old rune recipe");
  const out = sim.craft(merge, stacks, new UniformRng(1));
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].name, "Old");
}

// 5. Reroll affixes changes the seed and regenerates stats deterministically
{
  const sword = sim.makeItem(3, 10, { a: 4242 });
  const kit = sim.makeItem(14, 52, { a: 1 });
  const stacks = [{ item: sword, amount: 1 }, { item: kit, amount: 1 }];
  const recipe = byType(1);
  const out = sim.craft(recipe, stacks, new UniformRng(5));
  assert.notEqual(out.target.def.a, 4242);
  const s1 = sim.stats(out.target), s2 = sim.stats(out.target);
  assert.deepEqual(s1.stats, s2.stats);
}
console.log("mechanics tests OK");
