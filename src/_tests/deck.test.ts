import { describe, expect, test } from "bun:test";
import {
  drawTop,
  ensureDrawSize,
  freshPolicyTiles,
  FASCIST_COUNT,
  LIBERAL_COUNT,
  shuffleDeck,
} from "../deck";
import { fisherYates, mulberry32, seedAt, shuffleWithPolicy } from "../rng";

describe("deck composition", () => {
  test("fresh deck has 6 liberal and 11 fascist", () => {
    const tiles = freshPolicyTiles();
    expect(tiles.length).toBe(LIBERAL_COUNT + FASCIST_COUNT);
    expect(tiles.filter((t) => t === "liberal").length).toBe(LIBERAL_COUNT);
    expect(tiles.filter((t) => t === "fascist").length).toBe(FASCIST_COUNT);
  });
});

describe("seeded shuffle determinism", () => {
  test("same seed+count yields same permutation", () => {
    const tiles = freshPolicyTiles();
    const a = shuffleDeck(tiles, { kind: "seeded", seed: 42 }, 3);
    const b = shuffleDeck(tiles, { kind: "seeded", seed: 42 }, 3);
    expect(a).toEqual(b);
  });

  test("different shuffleCount diverges", () => {
    const tiles = freshPolicyTiles();
    const a = shuffleDeck(tiles, { kind: "seeded", seed: 42 }, 1);
    const b = shuffleDeck(tiles, { kind: "seeded", seed: 42 }, 2);
    expect(a).not.toEqual(b);
  });

  test("fisherYates with mulberry32 is stable", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = fisherYates(items, mulberry32(seedAt(99, 0)));
    const b = fisherYates(items, mulberry32(seedAt(99, 0)));
    expect(a).toEqual(b);
  });
});

describe("ensureDrawSize / drawTop", () => {
  test("reshuffles discard when draw is short", () => {
    const piles = {
      deck: ["liberal" as const],
      discard: ["fascist" as const, "fascist" as const, "liberal" as const],
      shuffleCount: 1,
      seed: 7 as number | null,
    };
    const ready = ensureDrawSize(piles, 3);
    expect(ready.deck.length).toBe(4);
    expect(ready.discard.length).toBe(0);
    expect(ready.shuffleCount).toBe(2);

    const again = shuffleWithPolicy(
      ["liberal", "fascist", "fascist", "liberal"] as ("liberal" | "fascist")[],
      { kind: "seeded", seed: 7 },
      2,
    );
    // Same multiset
    expect([...ready.deck].sort()).toEqual([...again].sort());
  });

  test("drawTop removes from front", () => {
    const piles = {
      deck: ["liberal" as const, "fascist" as const, "liberal" as const],
      discard: [] as ("liberal" | "fascist")[],
      shuffleCount: 0,
      seed: 1 as number | null,
    };
    const { piles: next, drawn } = drawTop(piles, 2);
    expect(drawn).toEqual(["liberal", "fascist"]);
    expect(next.deck).toEqual(["liberal"]);
  });
});
