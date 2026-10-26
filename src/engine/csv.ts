import type { PlayerLine } from "./types";

/**
 * Import per-game stats from a CSV. Built for Basketball Reference's
 * "Share & Export → Get table as CSV" output, but header matching is loose
 * enough for most stat sites (e.g. "3P" / "3PM", "TRB" / "REB", "TOV" / "TO").
 */
const HEADER_ALIASES: Record<keyof Omit<PlayerLine, "id" | "nbaId">, string[]> = {
  name: ["player", "name", "player name"],
  team: ["team", "tm"],
  pos: ["pos", "position"],
  age: ["age"],
  gp: ["g", "gp", "games"],
  gs: ["gs"],
  min: ["mp", "min", "mpg"],
  fgm: ["fg", "fgm"],
  fga: ["fga"],
  tpm: ["3p", "3pm", "fg3", "fg3m", "3ptm"],
  tpa: ["3pa", "fg3a", "3pta"],
  ftm: ["ft", "ftm"],
  fta: ["fta"],
  oreb: ["orb", "oreb", "or"],
  dreb: ["drb", "dreb", "dr"],
  reb: ["trb", "reb", "rpg"],
  ast: ["ast", "apg"],
  stl: ["stl", "spg"],
  blk: ["blk", "bpg"],
  tov: ["tov", "to", "topg"],
  pf: ["pf"],
  pts: ["pts", "ppg"],
};
const REQUIRED = ["name", "pts", "reb", "ast"] as const;
const COMBINED_TEAM = /^(\dTM|TOT)$/i;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function playersFromCsv(text: string): PlayerLine[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new Error("The CSV looks empty.");
  const header = rows[0].map((h) => h.trim().toLowerCase());

  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[field as keyof typeof HEADER_ALIASES] = idx;
  }
  const missing = REQUIRED.filter((f) => col[f] === undefined);
  if (missing.length) {
    throw new Error(`Missing column(s): ${missing.join(", ")}. Expected a per-game stats table.`);
  }
  const idCol = header.indexOf("player-additional");

  const byId = new Map<string, PlayerLine>();
  for (const r of rows.slice(1)) {
    const get = (f: keyof typeof HEADER_ALIASES) => (col[f] === undefined ? "" : (r[col[f]!] ?? "").trim());
    const name = get("name").replace(/\*$/, "");
    if (!name || name.toLowerCase() === "player" || name === "League Average") continue;
    const id = (idCol >= 0 && r[idCol]?.trim()) || slug(name);
    const team = get("team");

    const existing = byId.get(id);
    if (existing) {
      if (!COMBINED_TEAM.test(team)) existing.team = team;
      continue;
    }
    const n = (f: keyof typeof HEADER_ALIASES) => {
      const v = parseFloat(get(f));
      return Number.isFinite(v) ? v : 0;
    };
    const line: PlayerLine = {
      id, name, team, pos: get("pos"),
      age: n("age"), gp: n("gp"), gs: n("gs"), min: n("min"),
      fgm: n("fgm"), fga: n("fga"), tpm: n("tpm"), tpa: n("tpa"),
      ftm: n("ftm"), fta: n("fta"), oreb: n("oreb"), dreb: n("dreb"),
      reb: n("reb"), ast: n("ast"), stl: n("stl"), blk: n("blk"),
      tov: n("tov"), pf: n("pf"), pts: n("pts"),
    };
    // Some exports omit games played; treat each row as a season with games.
    if (col.gp === undefined) line.gp = 1;
    byId.set(id, line);
  }
  const players = [...byId.values()].filter((p) => p.gp > 0);
  if (!players.length) throw new Error("No player rows found.");
  return players;
}

function slug(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
