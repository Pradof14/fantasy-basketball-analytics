import type { PlayerLine } from "./types";

/** A player line that may mix two seasons. */
export interface BlendedLine extends PlayerLine {
  /** Share of the line that comes from the current season, 0–1. */
  currentWeight: number;
  /** Games behind the blended line (both seasons). */
  sampleGames: number;
}

const RATE_FIELDS = [
  "min", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "oreb", "dreb",
  "reb", "ast", "stl", "blk", "tov", "pf", "pts",
] as const;

/**
 * Early in a season, a few games of box scores are mostly noise. This blends
 * the current season into last season's per-game line, giving the new season
 * more weight as games accumulate:
 *
 *     weight_current = games_this_season / (games_this_season + stabilization)
 *
 * With the default of 15, a player 5 games in counts 25% current, 75% at
 * 45 games, and approaches 100% by season's end. It's the same idea as
 * regressing to a prior in baseball projection systems like Marcel.
 */
export function blendSeasons(
  previous: PlayerLine[],
  current: PlayerLine[],
  stabilization = 15,
): BlendedLine[] {
  const prevById = new Map(previous.map((p) => [p.id, p]));
  const out: BlendedLine[] = [];
  const seen = new Set<string>();

  for (const cur of current) {
    seen.add(cur.id);
    const prev = prevById.get(cur.id);
    if (!prev) {
      // Rookies and players who didn't play last year: current season only.
      out.push({ ...cur, currentWeight: 1, sampleGames: cur.gp });
      continue;
    }
    const w = cur.gp / (cur.gp + stabilization);
    const line: BlendedLine = {
      ...cur,
      currentWeight: w,
      sampleGames: cur.gp + prev.gp,
    };
    for (const f of RATE_FIELDS) {
      line[f] = round2(w * cur[f] + (1 - w) * prev[f]);
    }
    out.push(line);
  }

  // Players who haven't suited up yet (injury, holdout) keep last season's line.
  for (const prev of previous) {
    if (!seen.has(prev.id)) out.push({ ...prev, currentWeight: 0, sampleGames: prev.gp });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
