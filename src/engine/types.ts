/** One player's per-game line for one season, as written by pipeline/build_dataset.py. */
export interface PlayerLine {
  id: string;
  name: string;
  team: string;
  pos: string;
  age: number;
  gp: number;
  gs: number;
  min: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  nbaId?: number | null;
}

export interface SeasonData {
  id: string;
  label: string;
  players: PlayerLine[];
}

/** One row of the injury report, as written by pipeline/build_dataset.py. */
export interface Injury {
  id: string;
  name: string;
  team: string;
  /** Normalized status: out, out for the season, day-to-day, or anything else. */
  status: "out" | "out-season" | "dtd" | "other";
  /** The source's wording, e.g. "Day To Day". */
  label: string;
  /** Body part or reason, e.g. "Ankle". */
  injury: string;
  /** ISO date of the latest update. */
  updated: string;
  note: string;
}

export interface Dataset {
  generatedAt: string;
  source: string;
  seasons: SeasonData[];
  injuries?: Injury[];
  injuriesUpdatedAt?: string;
}

/** Counting stats a points league can put a weight on. */
export const COUNTING_STATS = [
  "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov",
  "tpm", "tpa", "fgm", "fga", "ftm", "fta", "pf",
] as const;
export type CountingStat = (typeof COUNTING_STATS)[number];

export const STAT_LABELS: Record<CountingStat, string> = {
  pts: "PTS", reb: "REB", oreb: "OREB", dreb: "DREB", ast: "AST", stl: "STL",
  blk: "BLK", tov: "TO", tpm: "3PM", tpa: "3PA", fgm: "FGM", fga: "FGA",
  ftm: "FTM", fta: "FTA", pf: "PF",
};

/** Standard head-to-head / roto categories. */
export const CATEGORIES = ["pts", "reb", "ast", "stl", "blk", "tpm", "fgpct", "ftpct", "tov"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  pts: "PTS", reb: "REB", ast: "AST", stl: "STL", blk: "BLK",
  tpm: "3PM", fgpct: "FG%", ftpct: "FT%", tov: "TO",
};

export type ScoringType = "points" | "categories";
export type StatBasis = "perGame" | "total";

export interface LeagueSettings {
  scoring: ScoringType;
  /** Points per unit of each stat (points leagues). */
  weights: Partial<Record<CountingStat, number>>;
  /** Categories that count (categories leagues). Leaving one out = punting it. */
  categories: Category[];
  teams: number;
  rosterSize: number;
  basis: StatBasis;
}
