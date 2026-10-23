import { describe, expect, test } from "bun:test";
import type { MarkovGraph } from "@very-coffee/statespace";
import {
  embedJson,
  escapeDotLabel,
  extractSvgElement,
  labelForState,
  markovGraphToDot,
  normalizeSvgForViewport,
  renderDotToSvg,
  wrapSvgViewer,
} from "../vis";
import { initialState } from "../setup";
import type { SecretHitlerState } from "../state";

describe("escapeDotLabel", () => {
  test("escapes quotes and backslashes", () => {
    expect(escapeDotLabel(`a"b\\c`)).toBe(`a\\"b\\\\c`);
  });
});

describe("embedJson", () => {
  test("escapes angle brackets for script safety", () => {
    expect(embedJson({ x: "</script>" })).toContain("\\u003c/script>");
  });
});

describe("labelForState", () => {
  test("includes phase and tracks", () => {
    const state = initialState({
      policy: { kind: "seeded", seed: 1 },
      playerCount: 5,
      roles: ["liberal", "fascist", "liberal", "hitler", "liberal"],
    });
    const label = labelForState(state);
    expect(label).toContain("nominate");
    expect(label).toContain("L0");
    expect(label).toContain("F0");
  });
});

describe("markovGraphToDot", () => {
  test("emits digraph with nodes and labeled edges", () => {
    const graph: MarkovGraph = new Map([
      [
        "hashA",
        new Map([
          [
            "hashB",
            [
              { name: "nominate:1" },
              1,
            ],
          ],
        ]),
      ],
    ]);

    const { dot, idByHash } = markovGraphToDot(graph, {
      labels: new Map([
        ["hashA", "start"],
        ["hashB", "after nom"],
      ]),
    });

    expect(dot).toContain("digraph statespace");
    expect(dot).toContain("rankdir=LR");
    expect(dot).toContain('label="start"');
    expect(dot).toContain('label="after nom"');
    expect(dot).toContain('label="nominate:1"');
    expect(dot).toMatch(/n\d+ -> n\d+/);
    expect(idByHash.get("hashA")).toMatch(/^n\d+$/);
    expect(idByHash.get("hashB")).toMatch(/^n\d+$/);
  });

  test("ballot edges omit dead seats in labels", () => {
    const fromState = initialState({
      policy: { kind: "seeded", seed: 1 },
      playerCount: 5,
      roles: ["liberal", "fascist", "liberal", "hitler", "liberal"],
    });
    fromState.players[2]!.alive = false;
    fromState.phase = "vote";
    fromState.nominee = 1;

    const graph: MarkovGraph = new Map([
      [
        "from",
        new Map([
          ["to", [{ name: "ballot:JNNNN" }, 1]],
        ]),
      ],
    ]);

    const { dot } = markovGraphToDot(graph, {
      labels: new Map([
        ["from", "vote"],
        ["to", "next"],
      ]),
      statesByHash: new Map([["from", fromState as SecretHitlerState]]),
    });

    expect(dot).toContain('label="ballot:0J,1N,3N,4N"');
    expect(dot).not.toContain("ballot:JNNNN");
  });
});

describe("renderDotToSvg", () => {
  test("renders a tiny digraph to svg", async () => {
    const svg = await renderDotToSvg(`digraph G { a -> b [label="t"]; }`);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});

describe("wrapSvgViewer", () => {
  test("builds html that fits, zooms, and embeds states", async () => {
    const svg = await renderDotToSvg(`digraph G { n0 -> n1; }`);
    const html = wrapSvgViewer(svg, {
      title: "test",
      statesByNodeId: {
        n0: { phase: "nominate", liberalTrack: 0 },
        n1: { phase: "vote", liberalTrack: 0 },
      },
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('id="viewport"');
    expect(html).toContain('id="inspector"');
    expect(html).toContain('id="node-states"');
    expect(html).toContain('"phase":"nominate"');
    expect(html).toContain("showState");
    expect(normalizeSvgForViewport(extractSvgElement(svg))).toContain(
      'width="100%"',
    );
  });
});
