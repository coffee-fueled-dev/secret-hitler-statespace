import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { instance } from "@viz-js/viz";
import { bfs, Explorer, jsonCodex, type MarkovGraph } from "@very-coffee/statespace";
import type { PlayerCount } from "./ruleset";
import { reset } from "./setup";
import type { SecretHitlerState } from "./state";
import { studyDataDir, type StudyConfig } from "./studyPath";
import {
  createStateSpace,
  displayBallotName,
  stateForUi,
} from "./transitions";

/** Short human label for a board state (not the full hash). */
export function labelForState(state: SecretHitlerState): string {
  const alive = state.players.filter((p) => p.alive).length;
  const parts = [
    state.phase,
    `L${state.liberalTrack}`,
    `F${state.fascistTrack}`,
    `E${state.electionTracker}`,
    `P${state.president}`,
    `a${alive}`,
  ];
  if (state.nominee !== null) parts.push(`nom${state.nominee}`);
  if (state.chancellor !== null) parts.push(`C${state.chancellor}`);
  if (state.winner) parts.push(`win:${state.winner}`);
  return parts.join("\\n");
}

export function escapeDotLabel(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Safe embed of JSON inside HTML (avoid `</script>` breakouts). */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export type DotNodeStyle = {
  fillcolor?: string;
  fontcolor?: string;
  shape?: string;
  penwidth?: number;
};

export type MarkovToDotOptions = {
  /** Map hash → display label. Missing hashes get a truncated id. */
  labels?: Map<string, string>;
  /** Map hash → node style overrides. */
  styles?: Map<string, DotNodeStyle>;
  /** Source hash → state, used to pretty-print ballot edge labels. */
  statesByHash?: Map<string, SecretHitlerState>;
  /**
   * Graphviz rankdir. Default `LR`: BFS layers go left→right so high ballot
   * fan-out grows vertically (TB makes an unusably wide flat strip).
   */
  rankdir?: "TB" | "LR" | "BT" | "RL";
  graphName?: string;
};

export type DotBuildResult = {
  dot: string;
  /** Explorer hash → Graphviz node id (`n0`, `n1`, …). */
  idByHash: Map<string, string>;
};

/** Convert an Explorer MarkovGraph to Graphviz DOT. */
export function markovGraphToDot(
  graph: MarkovGraph,
  options: MarkovToDotOptions = {},
): DotBuildResult {
  const {
    labels,
    styles,
    statesByHash,
    rankdir = "LR",
    graphName = "statespace",
  } = options;

  const hashes = new Set<string>();
  for (const [from, targets] of graph) {
    hashes.add(from);
    for (const to of targets.keys()) hashes.add(to);
  }

  const idByHash = new Map<string, string>();
  let i = 0;
  for (const hash of hashes) {
    idByHash.set(hash, `n${i++}`);
  }

  const lines: string[] = [];
  lines.push(`digraph ${graphName} {`);
  lines.push(`  rankdir=${rankdir};`);
  // Tighter packing helps huge sibling ranks (atomic ballots).
  lines.push(`  nodesep=0.25;`);
  lines.push(`  ranksep=0.6;`);
  lines.push(`  node [shape=box, fontsize=8, fontname="Helvetica", width=0, height=0, margin="0.05,0.04"];`);
  lines.push(`  edge [fontsize=7, fontname="Helvetica"];`);

  for (const hash of hashes) {
    const id = idByHash.get(hash)!;
    const raw = labels?.get(hash) ?? `${hash.slice(0, 8)}…`;
    const label = escapeDotLabel(raw);
    const style = styles?.get(hash);
    const attrs = [`label="${label}"`];
    if (style?.fillcolor) attrs.push(`fillcolor="${style.fillcolor}"`, `style=filled`);
    if (style?.fontcolor) attrs.push(`fontcolor="${style.fontcolor}"`);
    if (style?.shape) attrs.push(`shape=${style.shape}`);
    if (style?.penwidth !== undefined) attrs.push(`penwidth=${style.penwidth}`);
    lines.push(`  ${id} [${attrs.join(", ")}];`);
  }

  for (const [from, targets] of graph) {
    const fromId = idByHash.get(from)!;
    const fromState = statesByHash?.get(from);
    for (const [to, edge] of targets) {
      const toId = idByHash.get(to)!;
      const [meta] = edge;
      let rawLabel = meta.name;
      if (fromState && rawLabel.startsWith("ballot:")) {
        const aliveIds = fromState.players.filter((p) => p.alive).map((p) => p.id);
        rawLabel = displayBallotName(rawLabel, aliveIds);
      }
      const edgeLabel = escapeDotLabel(rawLabel);
      lines.push(`  ${fromId} -> ${toId} [label="${edgeLabel}"];`);
    }
  }

  lines.push("}");
  return { dot: lines.join("\n"), idByHash };
}

export async function renderDotToSvg(dot: string): Promise<string> {
  const viz = await instance();
  return viz.renderString(dot, { format: "svg", engine: "dot" });
}

/** Strip XML prologue; keep the root `<svg>…</svg>`. */
export function extractSvgElement(svgMarkup: string): string {
  const match = svgMarkup.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) throw new Error("No <svg> element in Graphviz output");
  return match[0]!;
}

/**
 * Make Graphviz SVG fill its container: drop fixed pt width/height, keep viewBox.
 */
export function normalizeSvgForViewport(svgElement: string): string {
  return svgElement
    .replace(/\swidth="[^"]*"/i, "")
    .replace(/\sheight="[^"]*"/i, "")
    .replace(/<svg\b/i, '<svg width="100%" height="100%"');
}

export type WrapSvgViewerOptions = {
  title?: string;
  /** Graphviz node id (`n0`) → full state object for hover inspect. */
  statesByNodeId?: Record<string, unknown>;
};

/**
 * Self-contained HTML viewer: pan/zoom (starts fitted) + hover state inspector.
 */
export function wrapSvgViewer(
  svgMarkup: string,
  options: WrapSvgViewerOptions | string = {},
): string {
  const opts: WrapSvgViewerOptions =
    typeof options === "string" ? { title: options } : options;
  const title = opts.title ?? "statespace";
  const statesByNodeId = opts.statesByNodeId ?? {};
  const svg = normalizeSvgForViewport(extractSvgElement(svgMarkup));
  const statesJson = embedJson(statesByNodeId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeDotLabel(title)}</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #f8fafc; }
    #viewport {
      width: 100%; height: 100%;
      cursor: grab;
      touch-action: none;
    }
    #viewport.dragging { cursor: grabbing; }
    #viewport svg { display: block; width: 100%; height: 100%; user-select: none; }
    #viewport svg .node { cursor: pointer; }
    #viewport svg .node.is-hover > polygon,
    #viewport svg .node.is-hover > ellipse,
    #viewport svg .node.is-hover > path {
      stroke: #2563eb !important;
      stroke-width: 2.5px !important;
    }
    #hud {
      position: fixed; top: 8px; right: 8px; z-index: 2;
      display: flex; gap: 6px; font: 12px system-ui, sans-serif;
    }
    #hud button {
      border: 1px solid #cbd5e1; background: #fff; border-radius: 6px;
      padding: 6px 10px; cursor: pointer;
    }
    #hud button:hover { background: #f1f5f9; }
    #inspector {
      position: fixed; top: 8px; left: 8px; bottom: 8px; z-index: 2;
      width: min(420px, 42vw);
      display: none;
      flex-direction: column;
      background: #0f172a; color: #e2e8f0;
      border-radius: 8px; box-shadow: 0 8px 24px rgb(15 23 42 / 35%);
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      overflow: hidden;
    }
    #inspector.visible { display: flex; }
    #inspector header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 8px 10px; border-bottom: 1px solid #334155;
      font: 12px system-ui, sans-serif; color: #94a3b8;
    }
    #inspector header strong { color: #f8fafc; font-weight: 600; }
    #inspector header button {
      border: 1px solid #475569; background: transparent; color: #cbd5e1;
      border-radius: 4px; padding: 2px 8px; cursor: pointer;
    }
    #inspector pre {
      margin: 0; padding: 10px; overflow: auto; flex: 1;
      white-space: pre-wrap; word-break: break-word;
    }
    #inspector .hint { padding: 0 10px 8px; color: #64748b; font: 11px system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="hud">
    <button type="button" id="fit" title="Fit to view">Fit</button>
    <button type="button" id="zoomIn" title="Zoom in">+</button>
    <button type="button" id="zoomOut" title="Zoom out">−</button>
  </div>
  <aside id="inspector" aria-live="polite">
    <header>
      <span>State <strong id="inspector-id"></strong></span>
      <button type="button" id="inspector-close" title="Close">✕</button>
    </header>
    <pre id="inspector-body"></pre>
    <div class="hint">Hover a node · click to pin · Esc to close</div>
  </aside>
  <div id="viewport">${svg}</div>
  <script type="application/json" id="node-states">${statesJson}</script>
  <script>
(function () {
  const viewport = document.getElementById("viewport");
  const svg = viewport.querySelector("svg");
  if (!svg || !svg.viewBox.baseVal) return;

  const states = JSON.parse(document.getElementById("node-states").textContent || "{}");
  const inspector = document.getElementById("inspector");
  const inspectorId = document.getElementById("inspector-id");
  const inspectorBody = document.getElementById("inspector-body");
  let pinned = false;
  let pinnedId = null;

  function showState(nodeId, pin) {
    const state = states[nodeId];
    inspectorId.textContent = nodeId;
    inspectorBody.textContent = state
      ? JSON.stringify(state, null, 2)
      : "(no state payload for this node)";
    inspector.classList.add("visible");
    if (pin) {
      pinned = true;
      pinnedId = nodeId;
    }
  }

  function hideInspector() {
    pinned = false;
    pinnedId = null;
    inspector.classList.remove("visible");
    svg.querySelectorAll(".node.is-hover").forEach((n) => n.classList.remove("is-hover"));
  }

  function nodeIdFromGroup(g) {
    const t = g.querySelector("title");
    return t ? t.textContent.trim() : null;
  }

  svg.querySelectorAll("g.node").forEach((g) => {
    g.addEventListener("pointerenter", () => {
      const id = nodeIdFromGroup(g);
      if (!id) return;
      svg.querySelectorAll(".node.is-hover").forEach((n) => n.classList.remove("is-hover"));
      g.classList.add("is-hover");
      if (!pinned) showState(id, false);
    });
    g.addEventListener("pointerleave", () => {
      g.classList.remove("is-hover");
      if (!pinned) inspector.classList.remove("visible");
    });
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = nodeIdFromGroup(g);
      if (!id) return;
      if (pinned && pinnedId === id) {
        hideInspector();
        return;
      }
      showState(id, true);
    });
  });

  document.getElementById("inspector-close").addEventListener("click", hideInspector);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideInspector();
  });

  const vb = svg.viewBox.baseVal;
  const base = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  let view = { x: base.x, y: base.y, w: base.w, h: base.h };

  function apply() {
    svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.w + " " + view.h);
  }

  function fit() {
    const cw = viewport.clientWidth || 1;
    const ch = viewport.clientHeight || 1;
    const scale = Math.min(cw / base.w, ch / base.h);
    const w = cw / scale;
    const h = ch / scale;
    view = {
      x: base.x - (w - base.w) / 2,
      y: base.y - (h - base.h) / 2,
      w: w,
      h: h,
    };
    apply();
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = viewport.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const sx = view.x + px * view.w;
    const sy = view.y + py * view.h;
    const w = view.w / factor;
    const h = view.h / factor;
    view = {
      x: sx - px * w,
      y: sy - py * h,
      w: w,
      h: h,
    };
    apply();
  }

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest("g.node")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = viewport.getBoundingClientRect();
    const dx = (e.clientX - lastX) / rect.width * view.w;
    const dy = (e.clientY - lastY) / rect.height * view.h;
    lastX = e.clientX;
    lastY = e.clientY;
    view.x -= dx;
    view.y -= dy;
    apply();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("dragging");
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  document.getElementById("fit").addEventListener("click", fit);
  document.getElementById("zoomIn").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2);
  });
  document.getElementById("zoomOut").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
  });

  window.addEventListener("resize", fit);
  fit();
})();
  </script>
</body>
</html>
`;
}

function styleForState(
  state: SecretHitlerState,
  initialHash: string,
  hash: string,
): DotNodeStyle {
  if (hash === initialHash) {
    return { fillcolor: "#dbeafe", penwidth: 2 };
  }
  if (state.winner === "liberal") {
    return { fillcolor: "#bbf7d0", shape: "doubleoctagon" };
  }
  if (state.winner === "fascist") {
    return { fillcolor: "#fecaca", shape: "doubleoctagon" };
  }
  if (state.phase === "terminal") {
    return { fillcolor: "#e5e7eb" };
  }
  return {};
}

export type VisualizeOptions = {
  seed: number;
  playerCount: PlayerCount;
  maxStates?: number;
  /** Basename without extension. Default `graph`. */
  basename?: string;
};

export type VisualizeResult = {
  exitReason: string;
  uniqueStates: number;
  nodeCount: number;
  edgeCount: number;
  studyDir: string;
  config: StudyConfig;
  dotPath: string;
  svgPath: string;
  /** Open this in a browser for pan/zoom (starts fitted). */
  htmlPath: string;
};

export async function visualize(options: VisualizeOptions): Promise<VisualizeResult> {
  const {
    seed,
    playerCount,
    maxStates = 500,
    basename = "graph",
  } = options;

  const config: StudyConfig = {
    kind: "vis",
    players: playerCount,
    seed,
    maxStates,
  };
  const outDir = studyDataDir(config);

  const initial = reset(seed, playerCount);
  const space = createStateSpace(playerCount);
  const explorer = new Explorer(space, jsonCodex<SecretHitlerState>());
  const initialHash = await explorer.encode(initial);

  // Vis explores for structure, not a shortest win-path. Stopping on the first
  // terminal win leaves most of the BFS frontier as fake "leaves" (discovered
  // as edge targets but never expanded). Only the state cap should stop us.
  const result = await explorer.study(bfs, {
    initialState: initial,
    exitConditions: [
      async (exp) => {
        if (exp.uniqueStates >= maxStates) {
          return { exitReason: `State cap (${maxStates})`, lastTransition: null };
        }
        return null;
      },
    ],
  });

  const labels = new Map<string, string>();
  const styles = new Map<string, DotNodeStyle>();
  const stateByHash = new Map<string, SecretHitlerState>();

  const hashes = new Set<string>();
  let edgeCount = 0;
  for (const [from, targets] of explorer.graph) {
    hashes.add(from);
    for (const to of targets.keys()) {
      hashes.add(to);
      edgeCount++;
    }
  }

  for (const hash of hashes) {
    const state = await explorer.decode(hash);
    stateByHash.set(hash, state);
    labels.set(hash, labelForState(state));
    styles.set(hash, styleForState(state, initialHash, hash));
  }

  const { dot, idByHash } = markovGraphToDot(explorer.graph, {
    labels,
    styles,
    statesByHash: stateByHash,
  });
  const statesByNodeId: Record<string, SecretHitlerState> = {};
  for (const [hash, id] of idByHash) {
    statesByNodeId[id] = stateForUi(stateByHash.get(hash)!);
  }

  const svg = await renderDotToSvg(dot);
  const html = wrapSvgViewer(svg, {
    title: `${basename} · seed ${seed}`,
    statesByNodeId,
  });

  await mkdir(outDir, { recursive: true });
  const dotPath = join(outDir, `${basename}.dot`);
  const svgPath = join(outDir, `${basename}.svg`);
  const htmlPath = join(outDir, `${basename}.html`);
  const configPath = join(outDir, "config.json");
  await Bun.write(dotPath, dot);
  await Bun.write(svgPath, svg);
  await Bun.write(htmlPath, html);
  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return {
    exitReason: result.exitReason,
    uniqueStates: explorer.uniqueStates,
    nodeCount: hashes.size,
    edgeCount,
    studyDir: outDir,
    config,
    dotPath,
    svgPath,
    htmlPath,
  };
}
