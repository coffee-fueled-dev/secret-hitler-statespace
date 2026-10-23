import type { SecretHitlerState } from "./state";

export function checkTrackWins(
  state: SecretHitlerState,
): SecretHitlerState {
  if (state.liberalTrack >= 5) {
    return { ...state, phase: "terminal", winner: "liberal" };
  }
  if (state.fascistTrack >= 6) {
    return { ...state, phase: "terminal", winner: "fascist" };
  }
  return state;
}

export function isTerminal(state: SecretHitlerState): boolean {
  return state.phase === "terminal" || state.winner !== null;
}
