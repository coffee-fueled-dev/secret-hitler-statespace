import {
  StateSpaceRepository,
  type ExecutableStateSpace,
  type Transition,
} from "@very-coffee/statespace";
import { drawTop, ensureDrawSize, type Policy } from "./deck";
import {
  isEligibleChancellor,
  nextAlive,
  rulesetFor,
  type PlayerCount,
  type PresidentialPower,
} from "./ruleset";
import { secretHitlerSchema, type SecretHitlerState } from "./state";
import { checkTrackWins } from "./win";

function fail(error: string) {
  return { success: false as const, error };
}

function ok(state: SecretHitlerState) {
  return { success: true as const, state };
}

function clearVotes(state: SecretHitlerState): Record<string, "ja" | "nein" | null> {
  const votes: Record<string, "ja" | "nein" | null> = {};
  for (const p of state.players) votes[String(p.id)] = null;
  return votes;
}

function pilesOf(state: SecretHitlerState) {
  return {
    deck: state.deck,
    discard: state.discard,
    shuffleCount: state.shuffleCount,
    seed: state.seed,
  };
}

function withPiles(
  state: SecretHitlerState,
  piles: ReturnType<typeof pilesOf>,
): SecretHitlerState {
  return {
    ...state,
    deck: piles.deck,
    discard: piles.discard,
    shuffleCount: piles.shuffleCount,
  };
}

function beginLegislative(state: SecretHitlerState): SecretHitlerState {
  const { piles, drawn } = drawTop(pilesOf(state), 3);
  return withPiles(
    {
      ...state,
      presidentHand: drawn,
      chancellorHand: [],
      phase: "president_discard",
      nominee: null,
      chancellor: state.chancellor,
    },
    piles,
  );
}

function advancePresidency(state: SecretHitlerState): SecretHitlerState {
  if (state.specialElectionReturn !== null) {
    const next = nextAlive(state.players, state.specialElectionReturn);
    return {
      ...state,
      president: next,
      chancellor: null,
      nominee: null,
      specialElectionReturn: null,
      votes: clearVotes(state),
      presidentHand: [],
      chancellorHand: [],
      phase: "nominate",
    };
  }
  return {
    ...state,
    president: nextAlive(state.players, state.president),
    chancellor: null,
    nominee: null,
    votes: clearVotes(state),
    presidentHand: [],
    chancellorHand: [],
    phase: "nominate",
  };
}

function phaseForPower(power: PresidentialPower): SecretHitlerState["phase"] {
  switch (power) {
    case "investigate":
      return "investigate";
    case "special_election":
      return "special_election";
    case "peek":
      return "peek";
    case "execute":
      return "execute";
  }
}

function afterPolicyEnacted(
  state: SecretHitlerState,
  policy: Policy,
  opts: { grantPowers: boolean },
): SecretHitlerState {
  let next: SecretHitlerState = {
    ...state,
    electionTracker: 0,
    presidentHand: [],
    chancellorHand: [],
  };

  if (policy === "liberal") {
    next = { ...next, liberalTrack: state.liberalTrack + 1 };
    next = checkTrackWins(next);
    if (next.winner) return next;
    return advancePresidency(next);
  }

  next = { ...next, fascistTrack: state.fascistTrack + 1 };
  next = checkTrackWins(next);
  if (next.winner) return next;

  if (!opts.grantPowers) {
    return advancePresidency(next);
  }

  const power = rulesetFor(state.playerCount).fascistPowerAt(next.fascistTrack);
  if (!power) {
    return advancePresidency(next);
  }
  return { ...next, phase: phaseForPower(power) };
}

function chaosEnact(state: SecretHitlerState): SecretHitlerState {
  const { piles, drawn } = drawTop(pilesOf(state), 1);
  const policy = drawn[0]!;
  let next = withPiles(
    {
      ...state,
      discard: piles.discard,
      lastElectedPresident: null,
      lastElectedChancellor: null,
      electionTracker: 0,
    },
    piles,
  );
  // Chaos: enact without presidential powers; clear term limits.
  next = afterPolicyEnacted(
    { ...next, discard: [...next.discard] },
    policy,
    { grantPowers: false },
  );
  // afterPolicyEnacted doesn't put the enacted tile anywhere special — track only.
  // Discard the enacted policy conceptually (it's on the board). No discard needed for board tiles.
  return next;
}

function majorityJa(state: SecretHitlerState): boolean {
  const alive = state.players.filter((p) => p.alive);
  let ja = 0;
  for (const p of alive) {
    if (state.votes[String(p.id)] === "ja") ja++;
  }
  return ja > alive.length / 2;
}

/** Apply a complete ballot and resolve the election in one step. */
function resolveWithVotes(
  state: SecretHitlerState,
  votes: Record<string, "ja" | "nein" | null>,
): SecretHitlerState {
  const voted: SecretHitlerState = { ...state, votes };

  if (majorityJa(voted)) {
    const chancellor = voted.nominee!;
    if (voted.fascistTrack >= 3 && voted.players[chancellor]?.role === "hitler") {
      return {
        ...voted,
        chancellor,
        nominee: null,
        lastElectedPresident: voted.president,
        lastElectedChancellor: chancellor,
        phase: "terminal",
        winner: "fascist",
      };
    }
    return beginLegislative({
      ...voted,
      chancellor,
      nominee: null,
      lastElectedPresident: voted.president,
      lastElectedChancellor: chancellor,
    });
  }

  const tracker = voted.electionTracker + 1;
  let next: SecretHitlerState = {
    ...voted,
    electionTracker: tracker,
    nominee: null,
    chancellor: null,
    votes: clearVotes(voted),
  };

  if (tracker >= 3) {
    return chaosEnact(next);
  }
  return advancePresidency(next);
}

function ballotPattern(mask: number, playerCount: number): Array<"ja" | "nein"> {
  return Array.from({ length: playerCount }, (_, i) =>
    (mask >> i) & 1 ? ("ja" as const) : ("nein" as const),
  );
}

/** Compact engine name: one J/N per seat index (dead seats padded N). */
export function ballotName(pattern: Array<"ja" | "nein">): string {
  return `ballot:${pattern.map((v) => (v === "ja" ? "J" : "N")).join("")}`;
}

/**
 * UI label: only living players' votes, seat-tagged.
 * Example: `ballot:0J,1N,3N,4J` (seat 2 dead → omitted; their vote is null).
 */
export function displayBallotName(
  rawName: string,
  aliveSeatIds: Iterable<number>,
): string {
  if (!rawName.startsWith("ballot:")) return rawName;
  const pattern = rawName.slice("ballot:".length);
  const alive = new Set(aliveSeatIds);
  const parts: string[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (!alive.has(i)) continue;
    const ch = pattern[i];
    if (ch !== "J" && ch !== "N") continue;
    parts.push(`${i}${ch}`);
  }
  return `ballot:${parts.join(",")}`;
}

/** Ensure eliminated seats are `null` in the votes map (for UI / embeds). */
export function votesWithNullsForDead(
  state: SecretHitlerState,
): Record<string, "ja" | "nein" | null> {
  const votes: Record<string, "ja" | "nein" | null> = {};
  for (const p of state.players) {
    votes[String(p.id)] = p.alive ? (state.votes[String(p.id)] ?? null) : null;
  }
  return votes;
}

export function stateForUi(state: SecretHitlerState): SecretHitlerState {
  return { ...state, votes: votesWithNullsForDead(state) };
}

export function createTransitions(playerCount: PlayerCount): Transition<SecretHitlerState>[] {
  const transitions: Transition<SecretHitlerState>[] = [];

  for (let c = 0; c < playerCount; c++) {
    const chancellor = c;
    transitions.push({
      name: `nominate:${chancellor}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "nominate" || state.winner) return fail("Not nominating");
          if (state.playerCount !== playerCount) return fail("Wrong table size");
          if (
            !isEligibleChancellor({
              players: state.players,
              president: state.president,
              candidate: chancellor,
              lastElectedPresident: state.lastElectedPresident,
              lastElectedChancellor: state.lastElectedChancellor,
            })
          ) {
            return fail("Ineligible chancellor");
          }
          return ok({
            ...state,
            nominee: chancellor,
            chancellor: null,
            votes: clearVotes(state),
            phase: "vote",
          });
        },
      },
    });
  }

  // Atomic simultaneous ballots (2^N). Dead seats must be N so enabled() stays tight.
  for (let mask = 0; mask < 1 << playerCount; mask++) {
    const pattern = ballotPattern(mask, playerCount);
    const name = ballotName(pattern);
    transitions.push({
      name,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "vote" || state.winner) return fail("Not voting");
          if (state.nominee === null) return fail("No nominee");
          if (state.playerCount !== playerCount) return fail("Wrong table size");

          for (let i = 0; i < playerCount; i++) {
            if (!state.players[i]?.alive && pattern[i] !== "nein") {
              return fail("Dead seat must be N");
            }
          }

          // Alive seats get J/N; dead / invalid seats stay null.
          const votes = clearVotes(state);
          for (let i = 0; i < playerCount; i++) {
            votes[String(i)] = state.players[i]?.alive ? pattern[i]! : null;
          }

          return ok(resolveWithVotes(state, votes));
        },
      },
    });
  }

  for (let idx = 0; idx < 3; idx++) {
    const discardIndex = idx;
    transitions.push({
      name: `presidentDiscard:${discardIndex}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "president_discard" || state.winner) {
            return fail("Not president discard");
          }
          if (state.presidentHand.length !== 3) return fail("Bad hand size");
          if (discardIndex < 0 || discardIndex > 2) return fail("Bad index");
          const discarded = state.presidentHand[discardIndex]!;
          const remaining = state.presidentHand.filter((_, i) => i !== discardIndex);
          return ok({
            ...state,
            discard: [...state.discard, discarded],
            presidentHand: [],
            chancellorHand: remaining,
            phase: "chancellor_play",
          });
        },
      },
    });
  }

  for (let idx = 0; idx < 2; idx++) {
    const playIndex = idx;
    transitions.push({
      name: `chancellorPlay:${playIndex}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "chancellor_play" || state.winner) {
            return fail("Not chancellor play");
          }
          if (state.chancellorHand.length !== 2) return fail("Bad hand size");
          const enacted = state.chancellorHand[playIndex]!;
          const discarded = state.chancellorHand[1 - playIndex]!;
          const next = afterPolicyEnacted(
            {
              ...state,
              discard: [...state.discard, discarded],
              chancellorHand: [],
            },
            enacted,
            { grantPowers: true },
          );
          return ok(next);
        },
      },
    });
  }

  transitions.push({
    name: "chancellorVeto",
    constraints: [],
    effect: {
      operation: "transform",
      transform: (state) => {
        if (state.phase !== "chancellor_play" || state.winner) return fail("Not play");
        if (state.fascistTrack < 5) return fail("Veto not unlocked");
        if (state.chancellorHand.length !== 2) return fail("Bad hand");
        return ok({ ...state, phase: "veto_confirm" });
      },
    },
  });

  transitions.push({
    name: "presidentAcceptVeto",
    constraints: [],
    effect: {
      operation: "transform",
      transform: (state) => {
        if (state.phase !== "veto_confirm" || state.winner) return fail("Not veto");
        const tracker = state.electionTracker + 1;
        let next: SecretHitlerState = {
          ...state,
          discard: [...state.discard, ...state.chancellorHand],
          chancellorHand: [],
          presidentHand: [],
          electionTracker: tracker,
        };
        if (tracker >= 3) {
          return ok(chaosEnact(next));
        }
        return ok(advancePresidency(next));
      },
    },
  });

  transitions.push({
    name: "presidentRejectVeto",
    constraints: [],
    effect: {
      operation: "transform",
      transform: (state) => {
        if (state.phase !== "veto_confirm" || state.winner) return fail("Not veto");
        return ok({ ...state, phase: "chancellor_play" });
      },
    },
  });

  for (let t = 0; t < playerCount; t++) {
    const target = t;
    transitions.push({
      name: `investigate:${target}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "investigate" || state.winner) return fail("Not investigate");
          if (target === state.president) return fail("Cannot investigate self");
          if (!state.players[target]?.alive) return fail("Dead target");
          if (state.players[target]?.investigated) return fail("Already investigated");
          const players = state.players.map((p) =>
            p.id === target ? { ...p, investigated: true } : p,
          );
          return ok(advancePresidency({ ...state, players }));
        },
      },
    });
  }

  for (let p = 0; p < playerCount; p++) {
    const nextPres = p;
    transitions.push({
      name: `specialElection:${nextPres}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "special_election" || state.winner) {
            return fail("Not special election");
          }
          if (nextPres === state.president) return fail("Must choose other");
          if (!state.players[nextPres]?.alive) return fail("Dead");
          return ok({
            ...state,
            specialElectionReturn: state.president,
            president: nextPres,
            chancellor: null,
            nominee: null,
            votes: clearVotes(state),
            phase: "nominate",
          });
        },
      },
    });
  }

  transitions.push({
    name: "peek",
    constraints: [],
    effect: {
      operation: "transform",
      transform: (state) => {
        if (state.phase !== "peek" || state.winner) return fail("Not peek");
        // Perfect-info: deck already known; ensure top-3 available then advance.
        const total = state.deck.length + state.discard.length;
        if (total >= 3) {
          return ok(advancePresidency(withPiles(state, ensureDrawSize(pilesOf(state), 3))));
        }
        return ok(advancePresidency(state));
      },
    },
  });

  for (let t = 0; t < playerCount; t++) {
    const target = t;
    transitions.push({
      name: `execute:${target}`,
      constraints: [],
      effect: {
        operation: "transform",
        transform: (state) => {
          if (state.phase !== "execute" || state.winner) return fail("Not execute");
          if (target === state.president) return fail("Cannot execute self");
          if (!state.players[target]?.alive) return fail("Already dead");
          const players = state.players.map((p) =>
            p.id === target ? { ...p, alive: false } : p,
          );
          if (state.players[target]?.role === "hitler") {
            return ok({
              ...state,
              players,
              phase: "terminal",
              winner: "liberal",
            });
          }
          return ok(advancePresidency({ ...state, players }));
        },
      },
    });
  }

  return transitions;
}

export function createStateSpace(
  playerCount: PlayerCount,
): ExecutableStateSpace<SecretHitlerState> {
  return StateSpaceRepository.makeExecutable({
    shape: secretHitlerSchema,
    transitions: createTransitions(playerCount),
  });
}
