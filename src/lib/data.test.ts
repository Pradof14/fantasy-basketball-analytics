import { describe, expect, it } from "vitest";
import type { Dataset, Injury, PlayerLine } from "../engine/types";
import { isOut, missingFromView, passesMinGames, withInjuries, type AppLine } from "./data";

const base = (id: string, gp: number, over: Partial<AppLine> = {}): AppLine =>
  ({ id, name: id, team: "HOU", pos: "G", age: 22, gp, gs: 0, min: 30, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
     oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0, ...over }) as AppLine;

const injury = (id: string, status: Injury["status"]): Injury =>
  ({ id, name: id, team: "HOU", status, label: "Out", injury: "Ankle", updated: "2026-10-26", note: "" });

describe("min games filter", () => {
  it("lets players new this season through, even on a few games", () => {
    expect(passesMinGames(base("rookie", 3, { newThisSeason: true, sampleGames: 3 }), 10)).toBe(true);
    expect(passesMinGames(base("bench", 3, { sampleGames: 3 }), 10)).toBe(false);
    expect(passesMinGames(base("vet", 3, { sampleGames: 73 }), 10)).toBe(true);
  });
});

describe("injuries", () => {
  it("attaches the report entry by player id", () => {
    const data = { generatedAt: "", source: "", seasons: [], injuries: [injury("a", "dtd")] } as Dataset;
    const out = withInjuries([base("a", 5), base("b", 5)] as PlayerLine[], data);
    expect(out[0].injury?.status).toBe("dtd");
    expect(out[1].injury).toBeUndefined();
  });

  it("treats out and out-for-season as out, day-to-day as playable", () => {
    expect(isOut(base("a", 1, { injury: injury("a", "out") }))).toBe(true);
    expect(isOut(base("a", 1, { injury: injury("a", "out-season") }))).toBe(true);
    expect(isOut(base("a", 1, { injury: injury("a", "dtd") }))).toBe(false);
  });
});

describe("players missing from a view", () => {
  const data = {
    generatedAt: "", source: "",
    seasons: [
      { id: "2026", label: "2025-26", players: [base("vet", 60), base("both", 70)] },
      { id: "2027", label: "2026-27", players: [base("both", 3), base("rookie", 3)] },
    ],
  } as unknown as Dataset;

  it("this-season view keeps players who haven't played, on last season's line", () => {
    const out = missingFromView("current", data);
    expect(out.map((p) => [p.id, p.gp, p.currentWeight])).toEqual([["vet", 60, 0]]);
  });

  it("last-season view keeps rookies, flagged as new", () => {
    const out = missingFromView("previous", data);
    expect(out.map((p) => [p.id, p.newThisSeason])).toEqual([["rookie", true]]);
  });

  it("projection already includes everyone", () => {
    expect(missingFromView("blend", data)).toEqual([]);
  });
});
