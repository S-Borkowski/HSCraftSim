// Hero Siege "CPR" random number generator (gml_Script_cpr_init / cpr_irandom), verified against
// the game's decompile and the Item Editor's replay model (generated_pool_model.py).
//
//   state = int(fmod(1789570533 * state + 465707, 2^31)) & 0x3FFFFFFF
//   irandom(n) = floor((n + 0.99999) * state / 1073741823)     (inclusive upper bound n)
//
// Arithmetic uses IEEE binary64 like GameMaker. Products can exceed 2^53;
// that rounding is part of the stream and must NOT be replaced with BigInt.

export const CPR_MULTIPLIER = 1789570533;
export const CPR_INCREMENT = 465707;
export const CPR_MODULUS = 2147483648;
export const CPR_MASK = 0x3fffffff;
export const CPR_MAX = 1073741823;

export function cprNext(state) {
  const x = CPR_MULTIPLIER * state + CPR_INCREMENT;
  const m = x - Math.floor(x / CPR_MODULUS) * CPR_MODULUS; // fmod for non-negative x
  return Math.trunc(m) & CPR_MASK;
}

export class Cpr {
  constructor(seed) {
    this.state = Math.trunc(seed);
    this.calls = 0;
  }
  /** Advance and return an integer in [0, upper] (GML cpr_irandom(upper)). */
  irandom(upper) {
    this.state = cprNext(this.state);
    this.calls += 1;
    return Math.floor((upper + 0.99999) * (this.state / CPR_MAX));
  }
  /** GML cpr_irandom_range(lo, hi) = lo + cpr_irandom(hi - lo). */
  irandomRange(lo, hi) {
    return lo + this.irandom(hi - lo);
  }
  clone() {
    const c = new Cpr(this.state);
    c.calls = this.calls;
    return c;
  }
}

/** Uniform random seed the way the game seeds new items (1..1e9). */
export function randomItemSeed(rng = Math.random) {
  return 1 + Math.floor(rng() * 1e9);
}
