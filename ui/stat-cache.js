// Item objects can be edited in place; invalidate on definition and tier changes.
export function cacheItemStats(sim) {
  const cache = new WeakMap();
  const generate = sim.stats.bind(sim);
  sim.stats = item => {
    const signature = JSON.stringify([item.def, item.info]);
    const previous = cache.get(item);
    if (previous?.signature === signature) return previous.result;
    const result = generate(item);
    cache.set(item, { signature, result });
    return result;
  };
}
