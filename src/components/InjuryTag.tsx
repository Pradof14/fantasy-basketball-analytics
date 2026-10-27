import type { Injury } from "../engine/types";
import type { AppLine } from "../lib/data";

const SHORT: Record<Injury["status"], string> = { out: "OUT", "out-season": "OUT (season)", dtd: "DTD", other: "INJ" };

/** Compact status badge: red for out, amber for day-to-day. */
export function InjuryTag({ injury }: { injury?: Injury }) {
  if (!injury) return null;
  const kind = injury.status === "dtd" ? "dtd" : injury.status === "other" ? "inj" : "out";
  const what = injury.injury ? ` (${injury.injury})` : "";
  return (
    <span className={`tag ${kind}`} title={`${injury.label}${what}, updated ${fmtDate(injury.updated)}: ${injury.note}`}>
      {SHORT[injury.status]}{injury.injury ? ` · ${injury.injury}` : ""}
    </span>
  );
}

/** Flags a projection built only on this season's handful of games. */
export function SampleTag({ player }: { player: AppLine }) {
  if (!player.newThisSeason) return null;
  return (
    <span className="tag new" title={`No stats from last season (rookie, or missed the year). Ranked on ${player.gp} game${player.gp === 1 ? "" : "s"} this season, so treat it as a small sample.`}>
      New · small sample
    </span>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
