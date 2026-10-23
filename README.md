# Secret Hitler study

Study of [Secret Hitler](https://www.secrethitler.com/) as a
[`@very-coffee/statespace`](https://www.npmjs.com/package/@very-coffee/statespace)
executable state graph. Configurable for **5–10 players** with official
role mixes and Fascist power tracks.

## Attribution / license

Secret Hitler was created by Mike Boxleiter, Tommy Maranges, and Mac Schubert.
Rules: [Secret_Hitler_Rules.pdf](https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf).

Secret Hitler is licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
This study adapts the mechanical rules for research; it is non-commercial and
share-alike under the same terms.

## Setup

```bash
bun install
```

Requires Bun ≥ 1.1.

## Shuffle policy

| Mode | Use |
|------|-----|
| **Seeded** (`--seed N`) | Deterministic role deal + deck + reshuffles via `prng(seed, shuffleCount)`. Required for `solve`. |
| **Random** | `crypto.getRandomValues` for each shuffle event; resulting `deck` is still written into state. Used by `sample` when `--seed` is omitted. |

`demo-reset` shows that two `reset(seed, players)` calls produce identical boards.

## Commands

```bash
# Deterministic BFS until a win (or state cap)
bun run solve -- --players 5 --seed 42

# Monte Carlo: uniform random legal moves
bun run sample -- --players 7 --runs 100 --seed 1   # run i uses seed+i
bun run sample -- --players 5 --runs 50             # true-random shuffles

# Prove seeded reset stability
bun run demo-reset -- --players 5 --seed 7

# DOT → SVG graph of explored statespace (default cap 500 states)
bun run vis -- --players 5 --seed 42 --max-states 200
# → .data/vis_p5_seed42_m200/{config.json,graph.dot,graph.svg,graph.html}
open .data/vis_p5_seed42_m200/graph.html

# Same run with depth-first exploration
bun run vis -- --players 5 --seed 42 --max-states 200 --mode dfs
# → .data/vis_p5_seed42_m200_dfs/…

bun test
```

Default `--players` is `5`. Default `--mode` for `vis` is `bfs`.

### Study artifacts (`.data/`)

Each unique study config gets its own directory under **`.data/`** (gitignored),
named from a stable encoding, e.g. `vis_p5_seed42_m500` (BFS) or
`vis_p5_seed42_m500_dfs` (DFS). Same config ⇒ same folder (overwrites on
re-run). A `config.json` records the exact parameters.

### Visualization

`bun run vis` runs a seeded exploration (`--mode bfs` by default, or `dfs`),
converts `Explorer.graph` to Graphviz DOT, and renders SVG via
[`@viz-js/viz`](https://www.npmjs.com/package/@viz-js/viz).
Open **`graph.html`** in the study dir for pan/drag and wheel zoom; the graph
starts fitted in the viewport. Layout is **left→right** so ballot fan-out grows
vertically instead of an ultra-wide strip. HUD: Fit / + / −. **Hover a node** to
inspect the full state JSON; **click** to pin the panel (Esc / ✕ to close).

Nodes are labeled with phase / tracks / president; start is blue, Liberal wins
green, Fascist wins red. `vis` stops only on `--max-states` (it does **not**
stop at the first win, so mid-game nodes keep their children). Keep the cap
modest — Graphviz struggles past a few hundred–thousand nodes.

## Model notes

- Perfect-information board (roles on state). Night briefing modes are encoded
  on the ruleset for documentation only.
- Elections use **atomic ballots** — one simultaneous vote profile that
  resolves immediately. Engine ids look like `ballot:JJNJN` (dead seats padded
  `N`); the vis shows only living voters (`ballot:0J,1N,3J`) and stores `null`
  for eliminated seats in `votes`.
- Chaos (three failed elections) enacts the top policy **without** granting
  presidential powers and clears term limits.
- Veto unlocks after five Fascist policies.
- `solve` explores the legal move graph; branching is large — use `--max-states`
  (default 50000) as a safety cap.
