import { blendSeasons, type BlendedLine } from "../engine/blend";
import type { Dataset, PlayerLine } from "../engine/types";

export type SeasonMode = "previous" | "current" | "blend" | "imported";

export interface SeasonOption {
  mode: SeasonMode;
  label: string;
  description: string;
}

/** The line the app works with: blended lines carry extra sample info. */
export type AppLine = PlayerLine & Partial<Pick<BlendedLine, "currentWeight" | "sampleGames">>;

export async function loadDataset(): Promise<Dataset | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/players.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as Dataset;
    return data.seasons?.length ? data : null;
  } catch {
    return null;
  }
}

export function seasonOptions(data: Dataset | null, imported: PlayerLine[] | null): SeasonOption[] {
  const opts: SeasonOption[] = [];
  const seasons = data?.seasons ?? [];
  const prev = seasons.length > 1 ? seasons[seasons.length - 2] : null;
  const cur = seasons.at(-1);
  if (prev && cur) {
    opts.push({
      mode: "blend",
      label: `Projection (${prev.label} + ${cur.label})`,
      description: "Blends both seasons, leaning on this season more as games pile up.",
    });
  }
  if (cur) opts.push({ mode: "current", label: `${cur.label} so far`, description: "This season's per-game stats only." });
  if (prev) opts.push({ mode: "previous", label: `${prev.label} full season`, description: "Last season's per-game stats." });
  if (imported) opts.push({ mode: "imported", label: "Imported CSV", description: "Stats from the file you imported." });
  return opts;
}

export function linesFor(mode: SeasonMode, data: Dataset | null, imported: PlayerLine[] | null): AppLine[] {
  if (mode === "imported") return imported ?? [];
  const seasons = data?.seasons ?? [];
  const cur = seasons.at(-1);
  const prev = seasons.length > 1 ? seasons[seasons.length - 2] : null;
  if (mode === "blend" && prev && cur) return blendSeasons(prev.players, cur.players);
  if (mode === "previous" && prev) return prev.players;
  return cur?.players ?? [];
}

/** Sensible minimum-games filter so 2-game samples don't top the board. */
export function defaultMinGames(mode: SeasonMode, lines: AppLine[]): number {
  if (mode === "blend") return 10;
  const maxGp = lines.reduce((m, p) => Math.max(m, p.gp), 0);
  return Math.max(1, Math.round(maxGp * 0.25));
}

export function gamesOf(p: AppLine): number {
  return p.sampleGames ?? p.gp;
}

export function headshotUrl(nbaId?: number | null): string | null {
  return nbaId ? `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png` : null;
}

export function matchesPosition(pos: string, filter: string): boolean {
  if (filter === "ALL") return true;
  const parts = pos.toUpperCase().split(/[-/,\s]+/);
  if (filter === "G") return parts.some((p) => p === "PG" || p === "SG" || p === "G");
  if (filter === "F") return parts.some((p) => p === "SF" || p === "PF" || p === "F");
  return parts.includes(filter);
}
