/** Mulberry32 — small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Combine base seed with a counter into a 32-bit seed. */
export function seedAt(seed: number, counter: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, counter + 1) >>> 0) ^ (seed >>> 0);
}

export function fisherYates<T>(items: T[], next: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function randomUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! >>> 0) / 4294967296;
}

export type ShufflePolicy =
  | { kind: "seeded"; seed: number }
  | { kind: "random" };

export function shuffleWithPolicy<T>(
  items: T[],
  policy: ShufflePolicy,
  shuffleCount: number,
): T[] {
  if (policy.kind === "seeded") {
    return fisherYates(items, mulberry32(seedAt(policy.seed, shuffleCount)));
  }
  return fisherYates(items, randomUnit);
}
