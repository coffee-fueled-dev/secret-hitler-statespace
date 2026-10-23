import type { PlayerCount } from "./ruleset";
import { initialState } from "./setup";
import type { SecretHitlerState } from "./state";
import { createStateSpace } from "./transitions";
import { isTerminal } from "./win";

export type SampleOptions = {
  playerCount: PlayerCount;
  runs: number;
  /** Base seed: run i uses seed+i. Omit for true-random shuffle each run. */
  seed?: number;
  maxSteps?: number;
};

export type SampleResult = {
  runs: number;
  liberalWins: number;
  fascistWins: number;
  unfinished: number;
  avgSteps: number;
};

function pickUniform<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function sampleOnce(options: {
  playerCount: PlayerCount;
  seed?: number;
  maxSteps?: number;
}): { winner: "liberal" | "fascist" | null; steps: number } {
  const { playerCount, maxSteps = 500 } = options;
  const policy =
    options.seed === undefined
      ? ({ kind: "random" } as const)
      : ({ kind: "seeded", seed: options.seed } as const);

  let state = initialState({ policy, playerCount });
  const space = createStateSpace(playerCount);
  let steps = 0;

  while (!isTerminal(state) && steps < maxSteps) {
    const enabled = space.enabled(state);
    if (enabled.length === 0) break;
    state = pickUniform(enabled).state;
    steps++;
  }

  return { winner: state.winner, steps };
}

export function sample(options: SampleOptions): SampleResult {
  const { playerCount, runs, seed, maxSteps } = options;
  let liberalWins = 0;
  let fascistWins = 0;
  let unfinished = 0;
  let stepSum = 0;

  for (let i = 0; i < runs; i++) {
    const runSeed = seed === undefined ? undefined : seed + i;
    const { winner, steps } = sampleOnce({ playerCount, seed: runSeed, maxSteps });
    stepSum += steps;
    if (winner === "liberal") liberalWins++;
    else if (winner === "fascist") fascistWins++;
    else unfinished++;
  }

  return {
    runs,
    liberalWins,
    fascistWins,
    unfinished,
    avgSteps: stepSum / runs,
  };
}

/** Re-export for typing convenience. */
export type { SecretHitlerState };
