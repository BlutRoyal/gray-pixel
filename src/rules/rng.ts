// Seeded randomness. Every game can be replayed from its seed (mulberry32).
let rndFn: () => number = Math.random;

export function seedRng(seed: number): void {
  let a = seed >>> 0 || 1;
  rndFn = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = (): number => rndFn();
export const ri = (n: number): number => Math.floor(rndFn() * n);
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
