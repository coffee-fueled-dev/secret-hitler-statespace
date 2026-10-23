import { isPlayerCount, type PlayerCount } from "./ruleset";
import { reset } from "./setup";
import { sample } from "./sample";
import { solve } from "./solve";
import { visualize } from "./vis";

function usage(): never {
  console.error(`Usage:
  bun run solve -- --players <5-10> --seed <n> [--max-states <n>]
  bun run sample -- --players <5-10> --runs <n> [--seed <n>]
  bun run demo-reset -- --players <5-10> --seed <n>
  bun run vis -- --players <5-10> --seed <n> [--max-states <n>]`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (!val || val.startsWith("--")) usage();
      out[key] = val;
      i++;
    }
  }
  return out;
}

function playersOrDefault(raw: string | undefined): PlayerCount {
  const n = raw === undefined ? 5 : Number(raw);
  if (!isPlayerCount(n)) {
    console.error(`Invalid --players ${raw}; expected 5..10`);
    process.exit(1);
  }
  return n;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();
  const args = parseArgs(rest);

  if (cmd === "solve") {
    if (args.seed === undefined) {
      console.error("solve requires --seed (deterministic only)");
      process.exit(1);
    }
    const seed = Number(args.seed);
    const playerCount = playersOrDefault(args.players);
    const maxStates =
      args["max-states"] !== undefined ? Number(args["max-states"]) : undefined;
    const result = await solve({ seed, playerCount, maxStates });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "sample") {
    const playerCount = playersOrDefault(args.players);
    const runs = args.runs !== undefined ? Number(args.runs) : 100;
    const seed = args.seed !== undefined ? Number(args.seed) : undefined;
    const result = sample({ playerCount, runs, seed });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "demo-reset") {
    if (args.seed === undefined) {
      console.error("demo-reset requires --seed");
      process.exit(1);
    }
    const seed = Number(args.seed);
    const playerCount = playersOrDefault(args.players);
    const a = reset(seed, playerCount);
    const b = reset(seed, playerCount);
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log(
      JSON.stringify(
        {
          same,
          seed,
          playerCount,
          deck: a.deck,
          roles: a.players.map((p) => p.role),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "vis") {
    if (args.seed === undefined) {
      console.error("vis requires --seed (deterministic only)");
      process.exit(1);
    }
    const seed = Number(args.seed);
    const playerCount = playersOrDefault(args.players);
    const maxStates =
      args["max-states"] !== undefined ? Number(args["max-states"]) : 500;
    const result = await visualize({ seed, playerCount, maxStates });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  usage();
}

await main();
