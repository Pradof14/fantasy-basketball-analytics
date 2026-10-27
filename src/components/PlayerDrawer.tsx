import { useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_LABELS, STAT_LABELS, type CountingStat, type LeagueSettings, type PlayerLine } from "../engine/types";
import type { PlayerValue, ValuationResult } from "../engine/value";
import { gamesOf, type AppLine } from "../lib/data";
import { fmt1, fmt2, pct, signed } from "../lib/format";
import { Headshot } from "./Headshot";
import { fmtDate } from "./InjuryTag";

interface Props {
  value: PlayerValue<AppLine>;
  valuation: ValuationResult<AppLine>;
  settings: LeagueSettings;
  /** Same player in other seasons, for context. */
  history: { label: string; line: PlayerLine }[];
  starred: boolean;
  onRoster: boolean;
  tradeSide: "send" | "receive" | null;
  onClose: () => void;
  onToggleStar: () => void;
  onToggleRoster: () => void;
  onTrade: (side: "send" | "receive") => void;
}

export function PlayerDrawer(props: Props) {
  const { value: v, settings, valuation } = props;
  const p = v.player;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const isCats = settings.scoring === "categories";
  const tier = v.rank <= valuation.draftable ? `Round ${Math.ceil(v.rank / settings.teams)} value` : "Waiver level";

  return (
    <>
      <div className="scrim" onClick={props.onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-name">
        <button ref={closeRef} className="btn small close" onClick={props.onClose}>Close</button>
        <div className="drawer-head">
          <Headshot name={p.name} nbaId={p.nbaId} large />
          <div>
            <h2 id="drawer-name">{p.name}</h2>
            <div className="meta">{p.team} {p.pos}{p.age ? `, age ${p.age}` : ""}</div>
            <div className="meta">{gamesOf(p)} games, {fmt1(p.min)} minutes a game</div>
          </div>
          <div className="big-rank">#{v.rank}<small>{tier}</small></div>
        </div>
        {p.currentWeight !== undefined && p.currentWeight > 0 && p.currentWeight < 1 && (
          <p className="compare-line">
            Projection: {Math.round(p.currentWeight * 100)}% this season, {Math.round((1 - p.currentWeight) * 100)}% last season.
          </p>
        )}
        {p.currentWeight === 0 && <p className="compare-line">Hasn't played this season yet, so this is last season's line.</p>}
        {p.newThisSeason && (
          <p className="compare-line">
            No stats from last season (a rookie, or missed the year), so this is just {p.gp} game{p.gp === 1 ? "" : "s"} of this
            season. Treat the ranking as a small sample.
          </p>
        )}
        {p.injury && (
          <div className={`injury-box${p.injury.status === "dtd" || p.injury.status === "other" ? "" : " out"}`} role="note">
            <b>{p.injury.label}{p.injury.injury ? ` (${p.injury.injury})` : ""}</b>
            <span className="meta"> · updated {fmtDate(p.injury.updated)}</span>
            <div>{p.injury.note}</div>
            <p className="hint">From the Basketball Reference injury report.</p>
          </div>
        )}

        <div className="statline">
          <div><b>{fmt1(p.pts)}</b><span>PTS</span></div>
          <div><b>{fmt1(p.reb)}</b><span>REB</span></div>
          <div><b>{fmt1(p.ast)}</b><span>AST</span></div>
          <div><b>{fmt1(p.stl)}</b><span>STL</span></div>
          <div><b>{fmt1(p.blk)}</b><span>BLK</span></div>
          <div><b>{fmt1(p.tpm)}</b><span>3PM</span></div>
          <div><b>{pct(p.fgm, p.fga)}</b><span>FG%</span></div>
          <div><b>{pct(p.ftm, p.fta)}</b><span>FT%</span></div>
          <div><b>{fmt1(p.tov)}</b><span>TO</span></div>
          <div><b>{fmt1(v.fppg)}</b><span>FPPG</span></div>
        </div>

        {isCats ? (
          <>
            <h3 className="section-title">Category impact</h3>
            <p className="hint">Z-scores against the {valuation.draftable} players who'd be rostered. 0 is an average starter.</p>
            <div className="bars">
              {CATEGORIES.map((c) => {
                const z = v.z![c];
                const off = !settings.categories.includes(c);
                const w = Math.min(Math.abs(z), 3) / 3 * 50;
                return (
                  <div className="bar-row" key={c}>
                    <span className="label">{CATEGORY_LABELS[c]}</span>
                    <span className="diverge" aria-hidden="true">
                      <span className={`${z >= 0 ? "up" : "down"}${off ? " off" : ""}`} style={{ width: `${w}%` }} />
                    </span>
                    <span className="val">{off ? "punt" : signed(z, 2)}</span>
                  </div>
                );
              })}
            </div>
            <p className="compare-line">Total {fmt2(v.value)}, which is {signed(v.overReplacement, 2)} over a waiver pickup.</p>
          </>
        ) : (
          <>
            <h3 className="section-title">Where the points come from</h3>
            <PointsBreakdown breakdown={v.breakdown ?? {}} />
            <p className="compare-line">
              {fmt1(v.fppg)} fantasy points a game. That's {signed(v.overReplacement)} {settings.basis === "total" ? "season points" : "a game"} over a waiver pickup.
            </p>
          </>
        )}

        {props.history.length > 0 && (
          <>
            <h3 className="section-title" style={{ marginTop: 22 }}>By season</h3>
            <table className="ledger">
              <tbody>
                {props.history.map((h) => (
                  <tr key={h.label}>
                    <td>{h.label} ({h.line.gp} G)</td>
                    <td>{fmt1(h.line.pts)} / {fmt1(h.line.reb)} / {fmt1(h.line.ast)}, {pct(h.line.fgm, h.line.fga)} FG</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="drawer-actions">
          <button className="btn primary" onClick={props.onToggleRoster}>
            {props.onRoster ? "Remove from my team" : "Add to my team"}
          </button>
          <button className="btn" onClick={props.onToggleStar}>{props.starred ? "★ On watchlist" : "☆ Watch"}</button>
          <button className="btn" disabled={props.tradeSide === "send"} onClick={() => props.onTrade("send")}>Trade away</button>
          <button className="btn" disabled={props.tradeSide === "receive"} onClick={() => props.onTrade("receive")}>Trade for</button>
        </div>
      </aside>
    </>
  );
}

function PointsBreakdown({ breakdown }: { breakdown: Partial<Record<CountingStat, number>> }) {
  const entries = (Object.entries(breakdown) as [CountingStat, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(1, ...entries.map(([, x]) => Math.abs(x)));
  return (
    <div className="bars">
      {entries.map(([stat, pts]) => (
        <div className="bar-row" key={stat}>
          <span className="label">{STAT_LABELS[stat]}</span>
          <span className="diverge" aria-hidden="true">
            <span className={pts >= 0 ? "up" : "down"} style={{ width: `${(Math.abs(pts) / max) * 50}%` }} />
          </span>
          <span className="val">{signed(pts)}</span>
        </div>
      ))}
    </div>
  );
}
