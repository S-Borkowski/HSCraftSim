import { loadData } from './index.js';
import { unpackItem } from './session.js';

let pendingSim;
self.onmessage = async ({ data }) => {
  const { id, recipeIndex, stacks, count, seed, config, bundle } = data;
  try {
    pendingSim ||= loadData(new URL('../data/', import.meta.url).href, bundle);
    const sim = await pendingSim;
    sim.config = { ...sim.config, ...config };
    const inputs = stacks.map(stack => ({ ...stack, item: unpackItem(sim, stack.item) }));
    const recipe = sim.recipes.find(recipe => recipe.index === recipeIndex);
    const values = sim.monteCarlo(recipe, inputs, count, seed);
    self.postMessage({ id, values });
  } catch (error) {
    pendingSim = null;
    self.postMessage({ id, error: error.message });
  }
};
