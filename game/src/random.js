// Neon Harbor 3D — random.js
// Seeded RNG (mulberry32) so screenshots and city layout are reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    range(min, max) {
      return min + rand() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + rand() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(rand() * list.length)];
    },
    chance(p) {
      return rand() < p;
    },
    sign() {
      return rand() < 0.5 ? -1 : 1;
    },
  };
}

// A deterministic hash of a string, for per-block seeds.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
