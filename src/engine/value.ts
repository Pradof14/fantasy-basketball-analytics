import {
  CATEGORIES,
  type Category,
  type CountingStat,
  type LeagueSettings,
  type PlayerLine,
} from "./types";

export type CategoryScores = Record<Category, number>;

export interface PlayerValue<P extends PlayerLine = PlayerLine> {
  player: P;
  /** Overall rank under these settings (1 = best). */
  rank: number;
  /** Fantasy points (points leagues) or summed z-score (category leagues). */
  value: number;
  /** Value above the best player you could pick up off waivers. */
  overReplacement: number;
  /** Fantasy points per game, always available for display. */
  fppg: number;
  /** Per-category z-scores (category leagues only). Includes punted categories. */
  z?: CategoryScores;
  /** How much each stat contributes to fppg (points leagues). */
  breakdown?: Partial<Record<CountingStat, number>>;
}

export interface ValuationResult<P extends PlayerLine = PlayerLine> {
  players: PlayerValue<P>[];
  byId: Map<string, PlayerValue<P>>;
  /** Number of rostered players league-wide (teams × roster size). */
  draftable: number;
  /** Value of a freely available replacement player. */
  replacement: number;
  /** Category profile of a replacement-level player (category leagues). */
  replacementZ?: CategoryScores;
}

// ---------------------------------------------------------------- points

export function fantasyPoints(line: PlayerLine, weights: LeagueSettings["weights"]): number {
  let total = 0;
  for (const [stat, w] of Object.entries(weights) as [CountingStat, number][]) {
    if (w) total += w * (line[stat] ?? 0);
  }
  return total;
}

export function pointsBreakdown(line: PlayerLine, weights: LeagueSettings["weights"]) {
  const out: Partial<Record<CountingStat, number>> = {};
  for (const [stat, w] of Object.entries(weights) as [CountingStat, number][]) {
    if (w) out[stat] = w * (line[stat] ?? 0);
  }
  return out;
}

// ------------------------------------------------------------ categories

interface RawCats {
  pts: number; reb: number; ast: number; stl: number; blk: number; tpm: number; tov: number;
  fgm: number; fga: number; ftm: number; fta: number;
}

function rawCats(line: PlayerLine, scale: number): RawCats {
  return {
    pts: line.pts * scale, reb: line.reb * scale, ast: line.ast * scale,
    stl: line.stl * scale, blk: line.blk * scale, tpm: line.tpm * scale,
    tov: line.tov * scale, fgm: line.fgm * scale, fga: line.fga * scale,
    ftm: line.ftm * scale, fta: line.fta * scale,
  };
}

interface PoolStats {
  mean: Record<Category, number>;
  sd: Record<Category, number>;
  fgPct: number;
  ftPct: number;
}

/**
 * Percentages can't be z-scored directly: a 60% shooter on 2 attempts barely
 * moves a fantasy team's FG%, while a 52% shooter on 20 attempts moves it a lot.
 * So we score "impact" instead — makes above what an average shooter in the
 * pool would make on the same attempts.
 */
function percentageImpacts(r: RawCats, fgPct: number, ftPct: number) {
  return { fgpct: r.fgm - r.fga * fgPct, ftpct: r.ftm - r.fta * ftPct };
}

function catVector(r: RawCats, fgPct: number, ftPct: number): Record<Category, number> {
  const { fgpct, ftpct } = percentageImpacts(r, fgPct, ftPct);
  return {
    pts: r.pts, reb: r.reb, ast: r.ast, stl: r.stl, blk: r.blk, tpm: r.tpm,
    tov: r.tov, fgpct, ftpct,
  };
}

function poolStats(pool: RawCats[]): PoolStats {
  const sum = (f: (r: RawCats) => number) => pool.reduce((s, r) => s + f(r), 0);
  const fga = sum((r) => r.fga);
  const fta = sum((r) => r.fta);
  const fgPct = fga ? sum((r) => r.fgm) / fga : 0;
  const ftPct = fta ? sum((r) => r.ftm) / fta : 0;

  const vectors = pool.map((r) => catVector(r, fgPct, ftPct));
  const mean = {} as Record<Category, number>;
  const sd = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    const vals = vectors.map((v) => v[c]);
    const m = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length || 1);
    mean[c] = m;
    sd[c] = Math.sqrt(variance) || 1;
  }
  return { mean, sd, fgPct, ftPct };
}

function zScores(r: RawCats, stats: PoolStats): CategoryScores {
  const v = catVector(r, stats.fgPct, stats.ftPct);
  const z = {} as CategoryScores;
  for (const c of CATEGORIES) {
    const score = (v[c] - stats.mean[c]) / stats.sd[c];
    z[c] = c === "tov" ? -score : score; // fewer turnovers is better
  }
  return z;
}

const sumCats = (z: CategoryScores, cats: readonly Category[]) =>
  cats.reduce((s, c) => s + z[c], 0);

// ----------------------------------------------------------------- main

/**
 * Rank every player under a league's settings.
 *
 * Category leagues use z-scores against the pool of players who'd actually be
 * rostered, found in two passes: first against the top 2N players by minutes
 * (a rough guess at who matters), then against the top N by the first-pass
 * score. Measuring against the whole league would let 400 bench players drag
 * the averages down and inflate everyone's value.
 */
export function valuePlayers<P extends PlayerLine>(
  lines: P[],
  settings: LeagueSettings,
): ValuationResult<P> {
  const draftable = Math.max(1, settings.teams * settings.rosterSize);
  const scaleOf = (p: PlayerLine) => (settings.basis === "total" ? p.gp : 1);

  let scored: { player: P; value: number; fppg: number; z?: CategoryScores; breakdown?: PlayerValue["breakdown"] }[];

  if (settings.scoring === "points") {
    scored = lines.map((player) => {
      const fppg = fantasyPoints(player, settings.weights);
      return {
        player,
        fppg,
        value: fppg * scaleOf(player),
        breakdown: pointsBreakdown(player, settings.weights),
      };
    });
  } else {
    const raws = lines.map((p) => rawCats(p, scaleOf(p)));
    const cats = settings.categories.length ? settings.categories : [...CATEGORIES];

    const byMinutes = lines
      .map((p, i) => ({ i, m: p.min * scaleOf(p) }))
      .sort((a, b) => b.m - a.m)
      .slice(0, draftable * 2)
      .map((x) => raws[x.i]);
    const firstPass = poolStats(byMinutes);
    const firstTotals = raws.map((r, i) => ({ i, t: sumCats(zScores(r, firstPass), cats) }));
    const pool = firstTotals
      .sort((a, b) => b.t - a.t)
      .slice(0, draftable)
      .map((x) => raws[x.i]);
    const finalStats = poolStats(pool);

    scored = lines.map((player, i) => {
      const z = zScores(raws[i], finalStats);
      return {
        player,
        z,
        value: sumCats(z, cats),
        fppg: fantasyPoints(player, settings.weights),
      };
    });
  }

  scored.sort((a, b) => b.value - a.value);
  const replacementSlice = scored.slice(draftable, draftable + 10);
  const replacement = replacementSlice.length
    ? average(replacementSlice.map((s) => s.value))
    : scored.at(-1)?.value ?? 0;

  let replacementZ: CategoryScores | undefined;
  if (settings.scoring === "categories" && replacementSlice.length) {
    replacementZ = {} as CategoryScores;
    for (const c of CATEGORIES) replacementZ[c] = average(replacementSlice.map((s) => s.z![c]));
  }

  const players: PlayerValue<P>[] = scored.map((s, i) => ({
    ...s,
    rank: i + 1,
    overReplacement: s.value - replacement,
  }));
  return {
    players,
    byId: new Map(players.map((p) => [p.player.id, p])),
    draftable,
    replacement,
    replacementZ,
  };
}

function average(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
