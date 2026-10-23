import { describe, expect, test } from "bun:test";
import {
  isEligibleChancellor,
  rulesetFor,
  type PlayerCount,
} from "../ruleset";

describe("rulesetFor", () => {
  const counts: PlayerCount[] = [5, 6, 7, 8, 9, 10];

  test("role totals sum to player count", () => {
    for (const n of counts) {
      const r = rulesetFor(n);
      expect(r.liberals + r.fascists + r.hitler).toBe(n);
      expect(r.playerCount).toBe(n);
    }
  });

  test("night info mode by table size", () => {
    expect(rulesetFor(5).nightInfoMode).toBe("hitler_knows_fascists");
    expect(rulesetFor(6).nightInfoMode).toBe("hitler_knows_fascists");
    expect(rulesetFor(7).nightInfoMode).toBe("fascists_know_hitler_only");
    expect(rulesetFor(10).nightInfoMode).toBe("fascists_know_hitler_only");
  });

  test("5–6 board powers", () => {
    const r = rulesetFor(5);
    expect(r.fascistPowerAt(1)).toBeNull();
    expect(r.fascistPowerAt(2)).toBeNull();
    expect(r.fascistPowerAt(3)).toBe("peek");
    expect(r.fascistPowerAt(4)).toBe("execute");
    expect(r.fascistPowerAt(5)).toBe("execute");
    expect(r.fascistPowerAt(6)).toBeNull();
  });

  test("7–8 board powers", () => {
    const r = rulesetFor(7);
    expect(r.fascistPowerAt(1)).toBeNull();
    expect(r.fascistPowerAt(2)).toBe("investigate");
    expect(r.fascistPowerAt(3)).toBe("special_election");
    expect(r.fascistPowerAt(4)).toBe("execute");
    expect(r.fascistPowerAt(5)).toBe("execute");
    expect(r.fascistPowerAt(6)).toBeNull();
  });

  test("9–10 board powers", () => {
    const r = rulesetFor(9);
    expect(r.fascistPowerAt(1)).toBe("investigate");
    expect(r.fascistPowerAt(2)).toBe("investigate");
    expect(r.fascistPowerAt(3)).toBe("special_election");
    expect(r.fascistPowerAt(4)).toBe("execute");
    expect(r.fascistPowerAt(5)).toBe("execute");
    expect(r.fascistPowerAt(6)).toBeNull();
  });
});

describe("isEligibleChancellor", () => {
  const seven = [0, 1, 2, 3, 4, 5, 6].map((id) => ({ id, alive: true }));
  const five = [0, 1, 2, 3, 4].map((id) => ({ id, alive: true }));

  test("with >5 alive, last president and chancellor are ineligible", () => {
    expect(
      isEligibleChancellor({
        players: seven,
        president: 0,
        candidate: 0,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(false);
    expect(
      isEligibleChancellor({
        players: seven,
        president: 0,
        candidate: 1,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(false);
    expect(
      isEligibleChancellor({
        players: seven,
        president: 0,
        candidate: 2,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(false);
    expect(
      isEligibleChancellor({
        players: seven,
        president: 0,
        candidate: 3,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(true);
  });

  test("with five alive, only last chancellor is ineligible", () => {
    expect(
      isEligibleChancellor({
        players: five,
        president: 0,
        candidate: 1,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(true);
    expect(
      isEligibleChancellor({
        players: five,
        president: 0,
        candidate: 2,
        lastElectedPresident: 1,
        lastElectedChancellor: 2,
      }),
    ).toBe(false);
  });
});
