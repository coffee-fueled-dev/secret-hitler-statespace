import { describe, expect, test } from "bun:test";
import { encodeStudyConfig, studyDataDir } from "../studyPath";

describe("encodeStudyConfig", () => {
  test("vis encoding is stable and unique per params", () => {
    const a = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
      mode: "bfs",
    });
    const b = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
      mode: "bfs",
    });
    const c = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 43,
      maxStates: 500,
      mode: "bfs",
    });
    expect(a).toBe(b);
    expect(a).toBe("vis_p5_seed42_m500");
    expect(a).not.toBe(c);
  });

  test("vis dfs encoding appends _dfs without changing bfs paths", () => {
    const bfs = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
      mode: "bfs",
    });
    const dfs = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
      mode: "dfs",
    });
    expect(bfs).toBe("vis_p5_seed42_m500");
    expect(dfs).toBe("vis_p5_seed42_m500_dfs");
  });

  test("studyDataDir nests under .data", () => {
    expect(
      studyDataDir({
        kind: "vis",
        players: 7,
        seed: 1,
        maxStates: 200,
        mode: "bfs",
      }),
    ).toBe(".data/vis_p7_seed1_m200");
    expect(
      studyDataDir({
        kind: "vis",
        players: 7,
        seed: 1,
        maxStates: 200,
        mode: "dfs",
      }),
    ).toBe(".data/vis_p7_seed1_m200_dfs");
  });
});
