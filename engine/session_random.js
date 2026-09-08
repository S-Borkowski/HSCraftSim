/** Fresh session seeds by default; repeatable sessions explicitly opt in. */
export function freshSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] || 1;
}
export function sessionStartSeed(state, draw = freshSeed) {
  if (state.repeatable) return state.seedStart || state.rng || 1;
  return draw();
}
