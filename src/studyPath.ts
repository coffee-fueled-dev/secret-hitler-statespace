import { join } from "node:path";
import type { PlayerCount } from "./ruleset";

/** Root for all study artifacts (gitignored). */
export const DATA_ROOT = ".data";

/**
 * Canonical study identity. Same encoding ⇒ same directory under `.data/`.
 */
export type StudyConfig =
  | {
      kind: "vis";
      players: PlayerCount;
      seed: number;
      maxStates: number;
    }
  | {
      kind: "solve";
      players: PlayerCount;
      seed: number;
      maxStates: number;
    }
  | {
      kind: "sample";
      players: PlayerCount;
      runs: number;
      seed: number | null;
    };

/** Filesystem-safe directory name unique for this config. */
export function encodeStudyConfig(config: StudyConfig): string {
  switch (config.kind) {
    case "vis":
      return `vis_p${config.players}_seed${config.seed}_m${config.maxStates}`;
    case "solve":
      return `solve_p${config.players}_seed${config.seed}_m${config.maxStates}`;
    case "sample":
      return config.seed === null
        ? `sample_p${config.players}_runs${config.runs}_random`
        : `sample_p${config.players}_runs${config.runs}_seed${config.seed}`;
  }
}

/** Absolute-from-cwd path: `.data/<encoding>/`. */
export function studyDataDir(config: StudyConfig): string {
  return join(DATA_ROOT, encodeStudyConfig(config));
}
