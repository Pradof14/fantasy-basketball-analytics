import { useMemo, useState } from "react";
import { CATEGORY_LABELS, type Category, type LeagueSettings } from "../engine/types";
import type { PlayerValue, ValuationResult } from "../engine/value";
import { gamesOf, matchesPosition, type AppLine } from "../lib/data";
import { fmt1, fmt2, pct, zClass } from "../lib/format";
import { Headshot } from "./Headshot";

const POSITIONS = ["ALL", "PG", "SG", "SF", "PF", "C", "G", "F"];
const POINTS_STATS = [
  ["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["tpm", "3PM"], ["tov", "TO"],
] as const;
const PAGE = 100;

type SortKey = string;

interface Props {
  valuation: ValuationResult<AppLine>;
  settings: LeagueSettings;
  minGames: number;
  onMinGames: (n: number) => void;
  starred: string[];
  onToggleStar: (id: string) => void;
  roster: string[];
  onOpen: (id: string) => void;
  seasonNote?: string;
}

export function RankingsTable(props: Props) {
  const { valuation, settings, starred, roster, onOpen, onToggleStar } = props;
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "rank", desc: false });
  const [limit, setLimit] = useState(PAGE);
  const isCats = settings.scoring === "categories";

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    const star = new Set(starred);
    let list = valuation.players.filter(
      (p) =>
        matchesPosition(p.player.pos, position) &&
        (!q || normalize(p.player.name).includes(q) || p.player.team.toLowerCase() === q) &&
        (!starredOnly || star.has(p.player.id)),
    );
    if (sort.key !== "rank") {
      const get = sortValue(sort.key);
      list = [...list].sort((a, b) => (sort.desc ? get(b) - get(a) : get(a) - get(b)));
    } else if (sort.desc) {
      list = [...list].reverse();
    }
    return list;
  }, [valuation, query, position, starredOnly, starred, sort]);

  const top = valuation.players[0]?.value ?? 1;
  const starSet = new Set(starred);
  const rosterSet = new Set(roster);

  const header = (key: SortKey, label: string, title?: string, left = false) => {
    const active = sort.key === key;
    return (
      <th className={left ? "left" : undefined} title={title}
        aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
        <button onClick={() => setSort(active ? { key, desc: !sort.desc } : { key, desc: key !== "rank" })}>{label}</button>
      </th>
    );
  };

  return (
    <section className="panel" aria-label="Player rankings">
      <div className="toolbar">
        <input type="search" placeholder="Search a player or team (HOU)" aria-label="Search players"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <div className="chips" role="group" aria-label="Position">
          {POSITIONS.map((p) => (
            <button key={p} className="chip" aria-pressed={position === p} onClick={() => setPosition(p)}>
              {p === "ALL" ? "All" : p}
            </button>
          ))}
        </div>
        <button className="chip" aria-pressed={starredOnly} onClick={() => setStarredOnly((s) => !s)}>
          ★ Watchlist{starred.length ? ` (${starred.length})` : ""}
        </button>
        <span className="spacer" />
        <label className="min-gp">
          Min games
          <input type="number" min={0} value={props.minGames}
            onChange={(e) => props.onMinGames(Math.max(0, parseInt(e.target.value, 10) || 0))} />
        </label>
      </div>
      {props.seasonNote && <p className="hint" style={{ padding: "10px 16px 0" }}>{props.seasonNote}</p>}

      <div className="table-wrap">
        <table className={`rank${isCats ? " cats" : ""}`}>
          <thead>
            <tr>
              {header("rank", "Rank")}
              <th className="left" style={{ width: 28 }}><span className="sr-only">Watchlist</span></th>
              <th className="left">Player</th>
              {header("gp", "GP", "Games played")}
              {header("min", "MIN", "Minutes per game")}
              {isCats
                ? settingsCats(settings).map((c) =>
                    header(`z:${c}`, CATEGORY_LABELS[c], settings.categories.includes(c) ? `${CATEGORY_LABELS[c]} z-score` : `${CATEGORY_LABELS[c]} (punted)`))
                : <>
                    {POINTS_STATS.map(([k, l]) => header(k, l))}
                    {settings.basis === "total" && header("fppg", "FPPG", "Fantasy points per game")}
                  </>}
              {header("value", isCats ? "Total z" : settings.basis === "total" ? "Season FP" : "FPPG",
                isCats ? "Sum of z-scores in the categories you count" : "Fantasy points with your scoring")}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => (
              <Row key={p.player.id} p={p} isCats={isCats} settings={settings} top={top}
                starred={starSet.has(p.player.id)} mine={rosterSet.has(p.player.id)}
                draftLine={sort.key === "rank" && !sort.desc && p.rank === valuation.draftable}
                replacement={valuation.replacement}
                onOpen={onOpen} onToggleStar={onToggleStar} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty">
            <p className="hint">
              {starredOnly && !starred.length
                ? "Star players with ☆ to build a watchlist."
                : "No players match. Try another search, position, or a lower minimum games filter."}
            </p>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="more">
          <span>Showing {Math.min(limit, rows.length)} of {rows.length}</span>
          {limit < rows.length && <button className="btn small" onClick={() => setLimit((l) => l + PAGE)}>Show {PAGE} more</button>}
        </div>
      )}
    </section>
  );
}

function Row({ p, isCats, settings, top, starred, mine, draftLine, replacement, onOpen, onToggleStar }: {
  p: PlayerValue<AppLine>; isCats: boolean; settings: LeagueSettings; top: number; starred: boolean; mine: boolean;
  draftLine: boolean; replacement: number; onOpen: (id: string) => void; onToggleStar: (id: string) => void;
}) {
  const pl = p.player;
  const share = top > 0 ? Math.max(0, Math.min(1, p.value / top)) : 0;
  const notPlayed = pl.currentWeight === 0;
  return (
    <tr className={draftLine ? "draft-line" : undefined} onClick={() => onOpen(pl.id)}
      title={draftLine ? "Last rostered player in your league. Everyone below is replacement level." : undefined}>
      <td className="rank-num">{p.rank}</td>
      <td className="left">
        <button className="star-btn" aria-pressed={starred} aria-label={`${starred ? "Remove" : "Add"} ${pl.name} ${starred ? "from" : "to"} watchlist`}
          onClick={(e) => { e.stopPropagation(); onToggleStar(pl.id); }}>{starred ? "★" : "☆"}</button>
      </td>
      <td className="left">
        <div className="player-cell">
          <Headshot name={pl.name} nbaId={pl.nbaId} />
          <div>
            <button className="name" style={{ all: "unset", fontWeight: 600, cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onOpen(pl.id); }}>{pl.name}</button>
            <div className="sub">
              <span>{pl.team}</span><span>{pl.pos}</span>
              {mine && <span className="tag mine">My team</span>}
              {notPlayed && <span className="tag" title="No games this season yet. Using last season's line.">Not played</span>}
            </div>
          </div>
        </div>
      </td>
      <td>{gamesOf(pl)}</td>
      <td>{fmt1(pl.min)}</td>
      {isCats
        ? settingsCats(settings).map((c) => {
            const z = p.z![c];
            const punted = !settings.categories.includes(c);
            return (
              <td key={c} title={rawCategory(pl, c)}>
                <span className={`z ${zClass(z)}${punted ? " punted" : ""}`}>{fmt2(z)}</span>
              </td>
            );
          })
        : <>
            {POINTS_STATS.map(([k]) => <td key={k}>{fmt1(pl[k])}</td>)}
            {settings.basis === "total" && <td>{fmt1(p.fppg)}</td>}
          </>}
      <td>
        <div className="meter" title={`${fmt2(p.overReplacement)} above a replacement-level pickup`}>
          <span className="num">{isCats ? fmt2(p.value) : fmt1(p.value)}</span>
          <span className="track"><span className={`fill${p.value < replacement ? " below" : ""}`} style={{ width: `${share * 100}%`, display: "block" }} /></span>
        </div>
      </td>
    </tr>
  );
}

function settingsCats(s: LeagueSettings): Category[] {
  // Show counted categories first, punted ones after (greyed out).
  const all: Category[] = ["pts", "reb", "ast", "stl", "blk", "tpm", "fgpct", "ftpct", "tov"];
  return [...all.filter((c) => s.categories.includes(c)), ...all.filter((c) => !s.categories.includes(c))];
}

function rawCategory(p: AppLine, c: Category): string {
  if (c === "fgpct") return `${pct(p.fgm, p.fga)} on ${fmt1(p.fga)} FGA`;
  if (c === "ftpct") return `${pct(p.ftm, p.fta)} on ${fmt1(p.fta)} FTA`;
  return `${fmt1(p[c])} per game`;
}

function sortValue(key: SortKey): (p: PlayerValue<AppLine>) => number {
  if (key.startsWith("z:")) { const c = key.slice(2) as Category; return (p) => p.z?.[c] ?? 0; }
  if (key === "value") return (p) => p.value;
  if (key === "fppg") return (p) => p.fppg;
  if (key === "gp") return (p) => gamesOf(p.player);
  return (p) => Number(p.player[key as keyof AppLine] ?? 0);
}

function normalize(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
