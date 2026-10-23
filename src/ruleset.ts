export type PlayerCount = 5 | 6 | 7 | 8 | 9 | 10;

export type PresidentialPower =
  | "investigate"
  | "special_election"
  | "peek"
  | "execute";

export type NightInfoMode =
  | "hitler_knows_fascists"
  | "fascists_know_hitler_only";

export type Ruleset = {
  playerCount: PlayerCount;
  liberals: number;
  fascists: number;
  hitler: 1;
  nightInfoMode: NightInfoMode;
  fascistPowerAt: (fascistTrack: number) => PresidentialPower | null;
};

const ROLE_TABLE: Record<
  PlayerCount,
  { liberals: number; fascists: number }
> = {
  5: { liberals: 3, fascists: 1 },
  6: { liberals: 4, fascists: 1 },
  7: { liberals: 4, fascists: 2 },
  8: { liberals: 5, fascists: 2 },
  9: { liberals: 5, fascists: 3 },
  10: { liberals: 6, fascists: 3 },
};

/** Fascist track slot → power for each board. Slot 6 is a win, not a power. */
function powersFor(playerCount: PlayerCount): (PresidentialPower | null)[] {
  // index 0 unused; slots 1..5
  if (playerCount <= 6) {
    return [null, null, null, "peek", "execute", "execute"];
  }
  if (playerCount <= 8) {
    return [null, null, "investigate", "special_election", "execute", "execute"];
  }
  return [
    null,
    "investigate",
    "investigate",
    "special_election",
    "execute",
    "execute",
  ];
}

export function isPlayerCount(n: number): n is PlayerCount {
  return Number.isInteger(n) && n >= 5 && n <= 10;
}

export function rulesetFor(playerCount: PlayerCount): Ruleset {
  const roles = ROLE_TABLE[playerCount];
  const table = powersFor(playerCount);
  return {
    playerCount,
    liberals: roles.liberals,
    fascists: roles.fascists,
    hitler: 1,
    nightInfoMode:
      playerCount <= 6 ? "hitler_knows_fascists" : "fascists_know_hitler_only",
    fascistPowerAt: (fascistTrack: number) => {
      if (fascistTrack < 1 || fascistTrack > 5) return null;
      return table[fascistTrack] ?? null;
    },
  };
}

export type PlayerSeat = {
  id: number;
  alive: boolean;
};

/** Alive players remaining. */
export function aliveCount(players: PlayerSeat[]): number {
  return players.filter((p) => p.alive).length;
}

/** Next alive seat clockwise from `from` (exclusive). */
export function nextAlive(players: PlayerSeat[], from: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const id = (from + step) % n;
    if (players[id]?.alive) return id;
  }
  throw new Error("No alive players");
}

/**
 * Chancellor eligibility under term limits.
 * If only five alive, only last elected Chancellor is ineligible.
 */
export function isEligibleChancellor(args: {
  players: PlayerSeat[];
  president: number;
  candidate: number;
  lastElectedPresident: number | null;
  lastElectedChancellor: number | null;
}): boolean {
  const { players, president, candidate, lastElectedPresident, lastElectedChancellor } =
    args;
  if (candidate === president) return false;
  if (!players[candidate]?.alive) return false;
  if (!players[president]?.alive) return false;

  if (aliveCount(players) === 5) {
    return candidate !== lastElectedChancellor;
  }

  if (candidate === lastElectedChancellor) return false;
  if (candidate === lastElectedPresident) return false;
  return true;
}

export function roleList(ruleset: Ruleset): Array<"liberal" | "fascist" | "hitler"> {
  return [
    ...Array.from({ length: ruleset.liberals }, () => "liberal" as const),
    ...Array.from({ length: ruleset.fascists }, () => "fascist" as const),
    "hitler",
  ];
}
