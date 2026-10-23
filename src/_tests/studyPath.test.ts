import { describe, expect, test } from "bun:test";
import { encodeStudyConfig, studyDataDir } from "../studyPath";

describe("encodeStudyConfig", () => {
  test("vis encoding is stable and unique per params", () => {
    const a = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
    });
    const b = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 42,
      maxStates: 500,
    });
    const c = encodeStudyConfig({
      kind: "vis",
      players: 5,
      seed: 43,
      maxStates: 500,
    });
    expect(a).toBe(b);
    expect(a).toBe("vis_p5_seed42_m500");
    expect(a).not.toBe(c);
  });

  test("studyDataDir nests under .data", () => {
    expect(
      studyDataDir({
        kind: "vis",
        players: 7,
        seed: 1,
        maxStates: 200,
      }),
    ).toBe(".data/vis_p7_seed1_m200");
  });
});
