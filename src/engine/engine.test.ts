import { describe, expect, it } from "vitest";
import { blendSeasons } from "./blend";
import { playersFromCsv } from "./csv";
import { DEFAULT_SETTINGS, POINTS_PRESETS, matchPreset } from "./presets";
import { evaluateTrade } from "./trade";
import type { LeagueSettings, PlayerLine } from "./types";
import { fantasyPoints, valuePlayers } from "./value";

function line(id: string, over: Partial<PlayerLine> = {}): PlayerLine {
  return {
    id, name: id, team: "HOU", pos: "SF", age: 25, gp: 60, gs: 60, min: 30,
    fgm: 6, fga: 13, tpm: 1.5, tpa: 4, ftm: 3, fta: 4, oreb: 1, dreb: 4, reb: 5,
    ast: 3, stl: 1, blk: 0.5, tov: 2, pf: 2, pts: 16.5, ...over,
  };
}

/** A league of 40 average-ish players with a spread, plus named outliers. */
function league(extra: PlayerLine[] = []): PlayerLine[] {
  const base = Array.from({ length: 40 }, (_, i) =>
    line(`p${i}`, { pts: 8 + i * 0.4, reb: 3 + (i % 7), ast: 1 + (i % 5), min: 15 + i * 0.4 }),
  );
  return [...base, ...extra];
}

const points = (over: Partial<LeagueSettings> = {}): LeagueSettings => ({
  ...DEFAULT_SETTINGS, scoring: "points", teams: 2, rosterSize: 10, ...over,
});
const cats = (over: Partial<LeagueSettings> = {}): LeagueSettings => ({
  ...DEFAULT_SETTINGS, scoring: "categories", teams: 2, rosterSize: 10, ...over,
});

describe("fantasy points", () => {
  it("applies ESPN default weights", () => {
    const p = line("x", { pts: 20, tpm: 2, fga: 15, fgm: 8, fta: 5, ftm: 4, reb: 6, ast: 5, stl: 1, blk: 1, tov: 3 });
    // 20 + 2 - 15 + 16 - 5 + 4 + 6 + 10 + 4 + 4 - 6
    expect(fantasyPoints(p, POINTS_PRESETS[0].weights)).toBe(40);
  });

  it("recognises presets and custom weights", () => {
    expect(matchPreset(POINTS_PRESETS[1].weights)).toBe("yahoo");
    expect(matchPreset({ ...POINTS_PRESETS[1].weights, pts: 2 })).toBeNull();
  });
});

describe("points valuation", () => {
  it("ranks by fantasy points and measures against replacement", () => {
    const star = line("star", { pts: 35, ast: 9, reb: 10 });
    const result = valuePlayers(league([star]), points());
    expect(result.players[0].player.id).toBe("star");
    expect(result.players[0].rank).toBe(1);
    expect(result.draftable).toBe(20);
    const r20 = result.players[20];
    expect(r20.overReplacement).toBeLessThan(1);
    expect(result.players[0].overReplacement).toBeGreaterThan(20);
  });

  it("uses season totals when asked, rewarding durability", () => {
    const healthy = line("healthy", { pts: 20, gp: 80 });
    const fragile = line("fragile", { pts: 22, gp: 30 });
    const perGame = valuePlayers([healthy, fragile], points());
    const totals = valuePlayers([healthy, fragile], points({ basis: "total" }));
    expect(perGame.players[0].player.id).toBe("fragile");
    expect(totals.players[0].player.id).toBe("healthy");
  });
});

describe("category valuation", () => {
  it("weights FG% by volume, not just the percentage", () => {
    const volume = line("volume", { fgm: 11, fga: 20 }); // 55% on 20 shots
    const dunker = line("dunker", { fgm: 1.4, fga: 2 }); // 70% on 2 shots
    const result = valuePlayers(league([volume, dunker]), cats());
    expect(result.byId.get("volume")!.z!.fgpct).toBeGreaterThan(result.byId.get("dunker")!.z!.fgpct);
  });

  it("scores turnovers negatively", () => {
    const careless = line("careless", { tov: 5 });
    const careful = line("careful", { tov: 0.5 });
    const result = valuePlayers(league([careless, careful]), cats());
    expect(result.byId.get("careless")!.z!.tov).toBeLessThan(0);
    expect(result.byId.get("careful")!.z!.tov).toBeGreaterThan(0);
  });

  it("punting a category removes it from the total but keeps the score", () => {
    const shooter = line("shooter", { ftm: 0.5, fta: 4, pts: 30 }); // awful FT%
    const full = valuePlayers(league([shooter]), cats());
    const punted = valuePlayers(league([shooter]), cats({ categories: DEFAULT_SETTINGS.categories.filter((c) => c !== "ftpct") }));
    const before = full.byId.get("shooter")!;
    const after = punted.byId.get("shooter")!;
    expect(after.value).toBeGreaterThan(before.value);
    expect(after.z!.ftpct).toBeLessThan(0);
    expect(after.rank).toBeLessThanOrEqual(before.rank);
  });

  it("puts the rostered pool near zero on average", () => {
    const result = valuePlayers(league(), cats());
    const top = result.players.slice(0, result.draftable);
    const mean = top.reduce((s, p) => s + p.value, 0) / top.length;
    expect(Math.abs(mean)).toBeLessThan(1.5);
  });
});

describe("players outside the rankings", () => {
  it("are valued on the same scale without changing the ranked list", () => {
    const pool = league([line("star", { pts: 34 })]);
    const alone = valuePlayers(pool, points());
    const withExtra = valuePlayers(pool, points(), [line("injured", { pts: 25, gp: 0 })]);
    expect(withExtra.players.map((p) => [p.player.id, p.value])).toEqual(alone.players.map((p) => [p.player.id, p.value]));
    expect(withExtra.replacement).toBe(alone.replacement);
    const extra = withExtra.byId.get("injured")!;
    expect(extra.unranked).toBe(true);
    expect(extra.value).toBeCloseTo(fantasyPoints(line("injured", { pts: 25 }), points().weights));
    expect(extra.rank).toBe(withExtra.players.filter((p) => p.value >= extra.value).length + 1);
  });

  it("works in category leagues too", () => {
    const result = valuePlayers(league([line("star", { pts: 34 })]), cats(), [line("rookie", { pts: 20, reb: 9 })]);
    expect(result.extras).toHaveLength(1);
    expect(result.extras[0].z).toBeDefined();
  });

  it("never duplicates a ranked player", () => {
    const pool = league([line("star")]);
    expect(valuePlayers(pool, points(), [line("star")]).extras).toHaveLength(0);
  });
});

describe("season blending", () => {
  it("leans on last season early and the new season later", () => {
    const prev = [line("a", { pts: 20, gp: 70 })];
    const early = blendSeasons(prev, [line("a", { pts: 30, gp: 3 })])[0];
    const late = blendSeasons(prev, [line("a", { pts: 30, gp: 60 })])[0];
    expect(early.pts).toBeCloseTo(20 + 10 * (3 / 18), 1);
    expect(late.pts).toBeGreaterThan(27);
    expect(early.sampleGames).toBe(73);
  });

  it("keeps rookies and players who haven't played yet", () => {
    const out = blendSeasons([line("vet")], [line("rookie", { gp: 4 })]);
    expect(out.map((p) => [p.id, p.currentWeight])).toEqual([["rookie", 1], ["vet", 0]]);
  });

  it("flags players with no line last season as new", () => {
    const out = blendSeasons([line("vet")], [line("vet", { gp: 3 }), line("rookie", { gp: 3 })]);
    expect(out.find((p) => p.id === "rookie")?.newThisSeason).toBe(true);
    expect(out.find((p) => p.id === "vet")?.newThisSeason).toBeUndefined();
  });
});

describe("trade analyzer", () => {
  const roster = league([line("star", { pts: 34, ast: 9, reb: 10, stl: 1.8 })]);

  it("says a star for a scrub is a loss", () => {
    const v = valuePlayers(roster, points());
    const t = evaluateTrade(v, ["star"], ["p0"]);
    expect(t.verdict).toBe("lose");
    expect(t.net).toBeLessThan(0);
  });

  it("credits the open roster spot in a 2-for-1", () => {
    const v = valuePlayers(roster, points());
    const t = evaluateTrade(v, ["p30", "p31"], ["star"]);
    expect(t.rosterAdjustment).toBeCloseTo(v.replacement);
    expect(t.net).toBeCloseTo(t.receiveValue + v.replacement - t.sendValue);
  });

  it("reports per-category changes in category leagues", () => {
    const v = valuePlayers(roster, cats());
    const t = evaluateTrade(v, ["p5"], ["star"]);
    expect(t.categoryNet!.pts).toBeGreaterThan(0);
    expect(t.verdict).toBe("win");
  });
});

describe("CSV import", () => {
  const csv = [
    "Rk,Player,Age,Team,Pos,G,GS,MP,FG,FGA,FG%,3P,3PA,3P%,2P,2PA,2P%,eFG%,FT,FTA,FT%,ORB,DRB,TRB,AST,STL,BLK,TOV,PF,PTS,Awards,Player-additional",
    '1,"Dončić, Luka",26,LAL,PG,70,70,36.0,10.0,21.0,.476,4.0,11.0,.364,6.0,10.0,.600,.571,7.0,9.0,.778,1.0,7.5,8.5,8.0,1.5,0.5,4.0,2.5,31.0,,doncilu01',
    "2,Traded Guy,28,2TM,SG,50,10,20.0,3.0,7.0,.429,1.0,3.0,.333,2.0,4.0,.500,.500,1.0,1.2,.833,0.5,2.0,2.5,2.0,0.7,0.2,1.0,1.5,8.0,,tradegu01",
    "3,Traded Guy,28,MIA,SG,25,5,20.0,3.0,7.0,.429,1.0,3.0,.333,2.0,4.0,.500,.500,1.0,1.2,.833,0.5,2.0,2.5,2.0,0.7,0.2,1.0,1.5,8.0,,tradegu01",
    "4,Traded Guy,28,TOR,SG,25,5,20.0,3.0,7.0,.429,1.0,3.0,.333,2.0,4.0,.500,.500,1.0,1.2,.833,0.5,2.0,2.5,2.0,0.7,0.2,1.0,1.5,8.0,,tradegu01",
    ",League Average,26.5,,,,,22.0,3.9,8.5,.463,1.3,3.6,.361,2.6,4.9,.541,.539,1.6,2.1,.784,1.0,3.0,4.0,2.4,0.7,0.5,1.3,1.8,10.7,,",
  ].join("\n");

  it("reads Basketball Reference exports, merging traded players", () => {
    const players = playersFromCsv(csv);
    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({ id: "doncilu01", name: "Dončić, Luka", pts: 31, tpm: 4, reb: 8.5 });
    expect(players[1]).toMatchObject({ gp: 50, team: "TOR" });
  });

  it("explains what's missing from a bad file", () => {
    expect(() => playersFromCsv("Name,Team\nA,HOU")).toThrow(/pts, reb, ast/);
  });
});
