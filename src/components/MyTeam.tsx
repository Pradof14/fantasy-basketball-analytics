import { useMemo } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type LeagueSettings } from "../engine/types";
import type { PlayerValue, ValuationResult } from "../engine/value";
import type { AppLine } from "../lib/data";
import { fmt1, fmt2, signed } from "../lib/format";
import { Headshot } from "./Headshot";
import { PlayerPicker } from "./PlayerPicker";

interface Props {
  valuation: ValuationResult<AppLine>;
  settings: LeagueSettings;
  roster: string[];
  onChange: (ids: string[]) => void;
  onOpen: (id: string) => void;
}

export function MyTeam({ valuation, settings, roster, onChange, onOpen }: Props) {
  const isCats = settings.scoring === "categories";
  const fmt = isCats ? fmt2 : fmt1;
  const members = roster.map((id) => valuation.byId.get(id)).filter((p): p is PlayerValue<AppLine> => !!p);
  const rosterSet = useMemo(() => new Set(roster), [roster]);
  const hidden = roster.length - members.length;

  const total = members.reduce((s, p) => s + p.value, 0);
  const avgRank = members.length ? members.reduce((s, p) => s + p.rank, 0) / members.length : 0;
  // A team built from evenly spread picks would average this rank.
  const expectedRank = (valuation.draftable + 1) / 2;

  const profile = useMemo(() => {
    if (!isCats) return null;
    const sums = {} as Record<Category, number>;
    for (const c of CATEGORIES) sums[c] = members.reduce((s, p) => s + (p.z?.[c] ?? 0), 0);
    return sums;
  }, [isCats, members]);

  const counted = settings.categories;
  const weakest = profile ? [...counted].sort((a, b) => profile[a] - profile[b]).slice(0, Math.min(3, counted.length - 1)) : [];
  const strongest = profile ? [...counted].sort((a, b) => profile[b] - profile[a]).slice(0, 2) : [];

  // Players near or past the draft line are the ones likely sitting on waivers.
  const targets = useMemo(() => {
    const pool = valuation.players.filter((p) => !rosterSet.has(p.player.id) && p.rank > valuation.draftable * 0.8);
    if (profile && weakest.length) {
      const fit = (p: PlayerValue<AppLine>) => weakest.reduce((s, c) => s + (p.z?.[c] ?? 0), 0);
      return [...pool].sort((a, b) => fit(b) - fit(a)).slice(0, 8);
    }
    return pool.slice(0, 8);
  }, [valuation, rosterSet, profile, weakest]);

  return (
    <div className="team-grid">
      <section className="panel panel-pad">
        <h2 className="section-title">My team</h2>
        <p className="hint">Add your roster to see its strengths and who to target. It's saved in this browser.</p>
        <div style={{ marginTop: 12 }}>
          <PlayerPicker label="Add a player to my team" players={valuation.players} exclude={rosterSet}
            placeholder="Add a player" onPick={(id) => onChange([...roster, id])} />
        </div>

        {members.length > 0 && (
          <div className="kpis">
            <div className="kpi"><b>{members.length}<span style={{ fontSize: 16 }}>/{settings.rosterSize}</span></b><span>Players</span></div>
            <div className="kpi"><b>{fmt(total)}</b><span>{isCats ? "Total z" : settings.basis === "total" ? "Season FP" : "FP a game, all players"}</span></div>
            <div className="kpi" title={`An average team's players rank around #${Math.round(expectedRank)}`}>
              <b>#{Math.round(avgRank)}</b><span>Average rank (typical team #{Math.round(expectedRank)})</span>
            </div>
          </div>
        )}
        {hidden > 0 && <p className="notice">{hidden} of your players are hidden by the min games filter and aren't counted.</p>}

        <div className="side-list">
          {members.length === 0 && <div className="empty-slot">Your roster is empty. Search above, or use "Add to my team" on any player.</div>}
          {[...members].sort((a, b) => a.rank - b.rank).map((p) => (
            <div className="side-item" key={p.player.id}>
              <Headshot name={p.player.name} nbaId={p.player.nbaId} />
              <div className="grow">
                <button className="link-btn" style={{ color: "inherit", fontSize: 15 }} onClick={() => onOpen(p.player.id)}>{p.player.name}</button>
                <div className="meta">#{p.rank} overall, {p.player.team} {p.player.pos}</div>
              </div>
              <span className="value">{fmt(p.value)}</span>
              <button className="remove" aria-label={`Remove ${p.player.name}`} onClick={() => onChange(roster.filter((x) => x !== p.player.id))}>×</button>
            </div>
          ))}
        </div>
        {roster.length > 0 && <button className="link-btn" style={{ marginTop: 12 }} onClick={() => onChange([])}>Clear roster</button>}
      </section>

      <section className="panel panel-pad">
        {profile && members.length > 0 ? (
          <>
            <h2 className="section-title">Category profile</h2>
            <p className="hint">Your players' combined z-scores. Above 0 beats an average team in that category.</p>
            <div className="bars">
              {CATEGORIES.map((c) => {
                const z = profile[c];
                const off = !counted.includes(c);
                return (
                  <div className="bar-row" key={c}>
                    <span className="label">{CATEGORY_LABELS[c]}</span>
                    <span className="diverge" aria-hidden="true">
                      <span className={`${z >= 0 ? "up" : "down"}${off ? " off" : ""}`} style={{ width: `${Math.min(Math.abs(z), 8) / 8 * 50}%` }} />
                    </span>
                    <span className="val">{off ? "punt" : signed(z, 1)}</span>
                  </div>
                );
              })}
            </div>
            <p className="compare-line">
              Strongest in {strongest.map((c) => CATEGORY_LABELS[c]).join(" and ")}. Weakest in {weakest.map((c) => CATEGORY_LABELS[c]).join(", ")}.
              {profile[weakest[0]] < -3 && ` If ${CATEGORY_LABELS[weakest[0]]} is out of reach, try punting it in league settings and see how your rankings change.`}
            </p>
            <h3 className="section-title" style={{ marginTop: 22 }}>Waiver targets for your weak spots</h3>
          </>
        ) : (
          <>
            <h2 className="section-title">Waiver targets</h2>
            <p className="hint">
              {members.length
                ? "The best players ranked around your league's draft line, who are often unowned."
                : "Players ranked around your league's draft line, who are often unowned. Add your roster to tailor these."}
            </p>
          </>
        )}
        <p className="hint">Check they're actually available in your league.</p>
        <div className="target-list">
          {targets.map((p) => (
            <div className="side-item" key={p.player.id}>
              <Headshot name={p.player.name} nbaId={p.player.nbaId} />
              <div className="grow">
                <button className="link-btn" style={{ color: "inherit", fontSize: 15 }} onClick={() => onOpen(p.player.id)}>{p.player.name}</button>
                <div className="meta">
                  #{p.rank}, {p.player.team}
                  {profile && weakest.length ? `, ${weakest.map((c) => `${CATEGORY_LABELS[c]} ${signed(p.z![c], 1)}`).join(", ")}` : `, ${fmt1(p.fppg)} FPPG`}
                </div>
              </div>
              <button className="btn small" onClick={() => onChange([...roster, p.player.id])}>Add</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
