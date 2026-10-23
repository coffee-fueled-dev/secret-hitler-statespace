import { bfs, Explorer, jsonCodex } from "@very-coffee/statespace";
import type { PlayerCount } from "./ruleset";
import { reset } from "./setup";
import type { SecretHitlerState } from "./state";
import { createStateSpace } from "./transitions";
import { isTerminal } from "./win";

export type SolveOptions = {
  seed: number;
  playerCount: PlayerCount;
  /** Cap unique states visited (safety). Default 50_000. */
  maxStates?: number;
};

export type SolveResult = {
  exitReason: string;
  winner: "liberal" | "fascist" | null;
  liberalTrack: number;
  fascistTrack: number;
  uniqueStates: number;
  pathLength: number | null;
};

export async function solve(options: SolveOptions): Promise<SolveResult> {
  const { seed, playerCount, maxStates = 50_000 } = options;
  const initial = reset(seed, playerCount);
  const space = createStateSpace(playerCount);
  const explorer = new Explorer(space, jsonCodex<SecretHitlerState>());

  let goalHash: string | null = null;
  let terminalWinner: "liberal" | "fascist" | null = null;

  const result = await explorer.study(bfs, {
    initialState: initial,
    exitConditions: [
      async (exp) => {
        if (exp.uniqueStates >= maxStates) {
          return {
            exitReason: `State cap (${maxStates})`,
            lastTransition: null,
          };
        }
        for (const [hash] of exp.graph) {
          const decoded = await exp.decode(hash);
          if (isTerminal(decoded) && decoded.winner) {
            goalHash = hash;
            terminalWinner = decoded.winner;
            return {
              exitReason: `${decoded.winner} win`,
              lastTransition: null,
            };
          }
        }
        return null;
      },
    ],
  });

  let pathLength: number | null = null;
  let liberalTrack = initial.liberalTrack;
  let fascistTrack = initial.fascistTrack;

  if (goalHash && result.reconstructPath) {
    const path = await result.reconstructPath(goalHash);
    pathLength = path.length;
    const last = path.at(-1);
    if (last) {
      liberalTrack = last.state.liberalTrack;
      fascistTrack = last.state.fascistTrack;
    }
  }

  return {
    exitReason: result.exitReason,
    winner: terminalWinner,
    liberalTrack,
    fascistTrack,
    uniqueStates: explorer.uniqueStates,
    pathLength,
  };
}
