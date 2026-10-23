import { describe, expect, test } from "bun:test";
import { initialState } from "../setup";
import type { SecretHitlerState } from "../state";
import { createStateSpace, displayBallotName } from "../transitions";

function apply(
  space: ReturnType<typeof createStateSpace>,
  state: SecretHitlerState,
  name: string,
): SecretHitlerState {
  const result = space.apply(state, name);
  if (!result.success) throw new Error(`${name}: ${result.error}`);
  return result.state;
}

function enabledNames(
  space: ReturnType<typeof createStateSpace>,
  state: SecretHitlerState,
): string[] {
  return space.enabled(state).map((t) => t.name);
}

describe("nominate eligibility", () => {
  test("with >5 alive, last president and chancellor cannot be nominated", () => {
    const space = createStateSpace(7);
    let state = initialState({
      policy: { kind: "seeded", seed: 1 },
      playerCount: 7,
      roles: [
        "liberal",
        "fascist",
        "liberal",
        "hitler",
        "liberal",
        "fascist",
        "liberal",
      ],
    });
    state = {
      ...state,
      president: 0,
      lastElectedPresident: 1,
      lastElectedChancellor: 2,
      phase: "nominate",
    };
    expect(enabledNames(space, state)).not.toContain("nominate:1");
    expect(enabledNames(space, state)).not.toContain("nominate:2");
    expect(enabledNames(space, state)).toContain("nominate:3");
  });

  test("with five alive, last president may be nominated", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 1 },
      playerCount: 5,
      roles: ["liberal", "fascist", "liberal", "hitler", "liberal"],
    });
    state = {
      ...state,
      president: 0,
      lastElectedPresident: 1,
      lastElectedChancellor: 2,
      phase: "nominate",
    };
    expect(enabledNames(space, state)).toContain("nominate:1");
    expect(enabledNames(space, state)).not.toContain("nominate:2");
  });
});

describe("Hitler chancellor after 3F", () => {
  test("electing Hitler as chancellor wins for fascists", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 2 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    state = {
      ...state,
      fascistTrack: 3,
      president: 0,
      phase: "nominate",
      lastElectedPresident: null,
      lastElectedChancellor: null,
    };
    state = apply(space, state, "nominate:4");
    state = apply(space, state, "ballot:JJJJJ");
    expect(state.winner).toBe("fascist");
    expect(state.phase).toBe("terminal");
  });
});

describe("atomic ballots", () => {
  test("vote phase enables 2^alive complete ballots and no castVote", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 2 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    state = apply(space, state, "nominate:1");
    const names = enabledNames(space, state);
    expect(names.every((n) => n.startsWith("ballot:"))).toBe(true);
    expect(names).toHaveLength(32);
    expect(names.some((n) => n.startsWith("castVote:"))).toBe(false);
    expect(names).not.toContain("resolveElection");
  });

  test("dead seats get null votes; UI ballot omits them", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 2 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 2 ? { ...p, alive: false } : p,
      ),
      phase: "nominate",
      president: 0,
      lastElectedPresident: null,
      lastElectedChancellor: null,
    };
    state = apply(space, state, "nominate:1");
    const names = enabledNames(space, state);
    expect(names).toHaveLength(16);
    // Seat 2 dead → padded N in engine id; must stay null in votes.
    // JJNJJ = living seats all ja (majority) so votes are retained after resolve.
    state = apply(space, state, "ballot:JJNJJ");
    expect(state.votes["2"]).toBeNull();
    expect(state.votes["0"]).toBe("ja");
    expect(state.votes["1"]).toBe("ja");
    expect(state.votes["3"]).toBe("ja");
    expect(displayBallotName("ballot:JJNJJ", [0, 1, 3, 4])).toBe(
      "ballot:0J,1J,3J,4J",
    );
  });
});

describe("powers by player count", () => {
  test("5p F3 grants peek phase", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 3 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    // Force legislative with a fascist enact via chancellorPlay
    state = {
      ...state,
      fascistTrack: 2,
      president: 0,
      chancellor: 1,
      phase: "chancellor_play",
      chancellorHand: ["fascist", "liberal"],
      presidentHand: [],
    };
    state = apply(space, state, "chancellorPlay:0");
    expect(state.fascistTrack).toBe(3);
    expect(state.phase).toBe("peek");
  });

  test("9p F1 grants investigate", () => {
    const space = createStateSpace(9);
    let state = initialState({
      policy: { kind: "seeded", seed: 4 },
      playerCount: 9,
      roles: [
        "liberal",
        "liberal",
        "liberal",
        "liberal",
        "liberal",
        "fascist",
        "fascist",
        "fascist",
        "hitler",
      ],
    });
    state = {
      ...state,
      fascistTrack: 0,
      president: 0,
      chancellor: 1,
      phase: "chancellor_play",
      chancellorHand: ["fascist", "liberal"],
    };
    state = apply(space, state, "chancellorPlay:0");
    expect(state.fascistTrack).toBe(1);
    expect(state.phase).toBe("investigate");
  });
});

describe("veto and chaos", () => {
  test("veto gated until fascistTrack >= 5", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 5 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    state = {
      ...state,
      fascistTrack: 4,
      phase: "chancellor_play",
      chancellorHand: ["liberal", "fascist"],
    };
    expect(enabledNames(space, state)).not.toContain("chancellorVeto");

    state = { ...state, fascistTrack: 5 };
    expect(enabledNames(space, state)).toContain("chancellorVeto");
  });

  test("chaos enact skips presidential powers", () => {
    const space = createStateSpace(5);
    let state = initialState({
      policy: { kind: "seeded", seed: 6 },
      playerCount: 5,
      roles: ["liberal", "liberal", "liberal", "fascist", "hitler"],
    });
    // Put a fascist on top and fail three elections
    state = {
      ...state,
      deck: ["fascist", ...state.deck.slice(1)],
      fascistTrack: 2, // next F would be peek if powered
      electionTracker: 2,
      president: 0,
      phase: "nominate",
      lastElectedPresident: null,
      lastElectedChancellor: null,
    };
    state = apply(space, state, "nominate:1");
    state = apply(space, state, "ballot:NNNNN");
    expect(state.fascistTrack).toBe(3);
    // Chaos ignores powers → should be back at nominate, not peek
    expect(state.phase).toBe("nominate");
    expect(state.electionTracker).toBe(0);
    expect(state.lastElectedPresident).toBeNull();
    expect(state.lastElectedChancellor).toBeNull();
  });
});
