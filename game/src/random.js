// Neon Harbor 3D — seeded RNG (mulberry32) so screenshots and layouts are reproducible.

/** A small fast seeded PRNG. Returns a function that yields [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small helper object around a seeded RNG. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** Pick one element of an array. */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    /** Weighted pick from [{value, weight}] or a list of [value, weight] pairs. */
    weighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = next() * total;
      for (const [v, w] of pairs) {
        roll -= w;
        if (roll <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
  };
}
