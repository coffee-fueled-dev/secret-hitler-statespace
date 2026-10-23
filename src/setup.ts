import { freshPolicyTiles, shuffleDeck } from "./deck";
import type { ShufflePolicy } from "./rng";
import { roleList, rulesetFor, type PlayerCount } from "./ruleset";
import { shuffleWithPolicy } from "./rng";
import type { Role, SecretHitlerState } from "./state";

export type SetupOptions = {
  policy: ShufflePolicy;
  playerCount: PlayerCount;
  /** Override dealt roles (must match length). Otherwise roles are shuffled. */
  roles?: Role[];
  /** First president seat (default 0). */
  firstPresident?: number;
};

export function initialState(options: SetupOptions): SecretHitlerState {
  const { policy, playerCount, firstPresident = 0 } = options;
  const ruleset = rulesetFor(playerCount);
  const seed = policy.kind === "seeded" ? policy.seed : null;

  const roles =
    options.roles ??
    shuffleWithPolicy(roleList(ruleset), policy, 0 /* role deal stream */);

  if (roles.length !== playerCount) {
    throw new Error(`Expected ${playerCount} roles, got ${roles.length}`);
  }

  // Deck uses shuffleCount 1 so role deal (0) and deck (1) diverge under one seed.
  const deck = shuffleDeck(freshPolicyTiles(), policy, 1);

  const players = roles.map((role, id) => ({
    id,
    role,
    alive: true,
    investigated: false,
  }));

  const votes: Record<string, "ja" | "nein" | null> = {};
  for (let i = 0; i < playerCount; i++) votes[String(i)] = null;

  return {
    playerCount,
    seed,
    shuffleCount: 1,
    deck,
    discard: [],
    liberalTrack: 0,
    fascistTrack: 0,
    electionTracker: 0,
    players,
    president: firstPresident,
    chancellor: null,
    nominee: null,
    lastElectedPresident: null,
    lastElectedChancellor: null,
    specialElectionReturn: null,
    votes,
    presidentHand: [],
    chancellorHand: [],
    phase: "nominate",
    winner: null,
  };
}

export function reset(seed: number, playerCount: PlayerCount): SecretHitlerState {
  return initialState({
    policy: { kind: "seeded", seed },
    playerCount,
  });
}
