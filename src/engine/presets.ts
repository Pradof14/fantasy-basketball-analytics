import { CATEGORIES, type Category, type CountingStat, type LeagueSettings } from "./types";

export interface ScoringPreset {
  id: string;
  label: string;
  weights: Partial<Record<CountingStat, number>>;
}

/**
 * Default points systems from the major platforms. Double-double / triple-double
 * bonuses are left out on purpose: they need game logs, and season averages
 * can't tell us how often a player hit one.
 */
export const POINTS_PRESETS: ScoringPreset[] = [
  {
    id: "espn",
    label: "ESPN default",
    weights: { pts: 1, tpm: 1, fga: -1, fgm: 2, fta: -1, ftm: 1, reb: 1, ast: 2, stl: 4, blk: 4, tov: -2 },
  },
  {
    id: "yahoo",
    label: "Yahoo default",
    weights: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, tov: -1 },
  },
  {
    id: "simple",
    label: "Simple (1/1/1/2/2/-1)",
    weights: { pts: 1, reb: 1, ast: 1, stl: 2, blk: 2, tov: -1 },
  },
];

export const CATEGORY_PRESETS: { id: string; label: string; categories: Category[] }[] = [
  { id: "9cat", label: "9-cat", categories: [...CATEGORIES] },
  { id: "8cat", label: "8-cat (no TO)", categories: CATEGORIES.filter((c) => c !== "tov") },
];

export const DEFAULT_SETTINGS: LeagueSettings = {
  scoring: "points",
  weights: { ...POINTS_PRESETS[0].weights },
  categories: [...CATEGORIES],
  teams: 12,
  rosterSize: 13,
  basis: "perGame",
};

/** Which preset (if any) a set of weights matches exactly. */
export function matchPreset(weights: LeagueSettings["weights"]): string | null {
  const clean = (w: LeagueSettings["weights"]) =>
    JSON.stringify(Object.entries(w).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)));
  return POINTS_PRESETS.find((p) => clean(p.weights) === clean(weights))?.id ?? null;
}
