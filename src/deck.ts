import { type ShufflePolicy, shuffleWithPolicy } from "./rng";

export type Policy = "liberal" | "fascist";

export const LIBERAL_COUNT = 6;
export const FASCIST_COUNT = 11;

export function freshPolicyTiles(): Policy[] {
  return [
    ...Array.from({ length: LIBERAL_COUNT }, () => "liberal" as const),
    ...Array.from({ length: FASCIST_COUNT }, () => "fascist" as const),
  ];
}

export function shuffleDeck(
  deck: Policy[],
  policy: ShufflePolicy,
  shuffleCount: number,
): Policy[] {
  return shuffleWithPolicy(deck, policy, shuffleCount);
}

/** Draw pile is index 0 = top. */
export type DeckPiles = {
  deck: Policy[];
  discard: Policy[];
  shuffleCount: number;
  seed: number | null;
};

function policyFromSeed(seed: number | null): ShufflePolicy {
  return seed === null ? { kind: "random" } : { kind: "seeded", seed };
}

/** Ensure draw pile has at least `n` tiles, reshuffling discard if needed. */
export function ensureDrawSize(piles: DeckPiles, n: number): DeckPiles {
  if (piles.deck.length >= n) return piles;

  const combined = [...piles.deck, ...piles.discard];
  if (combined.length < n) {
    throw new Error(`Not enough policies to draw ${n} (have ${combined.length})`);
  }

  const shuffleCount = piles.shuffleCount + 1;
  const deck = shuffleDeck(combined, policyFromSeed(piles.seed), shuffleCount);
  return {
    ...piles,
    deck,
    discard: [],
    shuffleCount,
  };
}

/** Draw top `n` policies (requires ensureDrawSize first or calls it). */
export function drawTop(
  piles: DeckPiles,
  n: number,
): { piles: DeckPiles; drawn: Policy[] } {
  const ready = ensureDrawSize(piles, n);
  const drawn = ready.deck.slice(0, n);
  return {
    piles: { ...ready, deck: ready.deck.slice(n) },
    drawn,
  };
}
