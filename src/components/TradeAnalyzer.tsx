import { useMemo } from "react";
import { evaluateTrade } from "../engine/trade";
import { CATEGORIES, CATEGORY_LABELS, type LeagueSettings } from "../engine/types";
import type { ValuationResult } from "../engine/value";
import { fmt1, fmt2, signed } from "../lib/format";
import { rankLabel, type AppLine } from "../lib/data";
import { Headshot } from "./Headshot";
import { InjuryTag } from "./InjuryTag";
import { PlayerPicker } from "./PlayerPicker";

export interface TradeState { send: string[]; receive: string[] }

interface Props {
  valuation: ValuationResult<AppLine>;
  settings: LeagueSettings;
  trade: TradeState;
  onChange: (t: TradeState) => void;
  onOpen: (id: string) => void;
}

export function TradeAnalyzer({ valuation, settings, trade, onChange, onOpen }: Props) {
  const isCats = settings.scoring === "categories";
  const fmt = isCats ? fmt2 : fmt1;
  const unit = isCats ? "z" : settings.basis === "total" ? "season FP" : "FP a game";
  const inTrade = useMemo(() => new Set([...trade.send, ...trade.receive]), [trade]);
  const ready = trade.send.length > 0 && trade.receive.length > 0;
  const result = ready ? evaluateTrade(valuation, trade.send, trade.receive) : null;
  // Only players with no stats at all in this view (e.g. an imported CSV) can't be valued.
  const missing = [...trade.send, ...trade.receive].filter((id) => !valuation.byId.has(id));

  const side = (key: keyof TradeState, title: string, hint: string) => (
    <div className="panel panel-pad side">
      <h3>{title}</h3>
      <PlayerPicker label={`Add a player to "${title}"`} players={[...valuation.players, ...valuation.extras]} exclude={inTrade}
        placeholder="Add a player" onPick={(id) => onChange({ ...trade, [key]: [...trade[key], id] })} />
      <div className="side-list">
        {trade[key].length === 0 && <div className="empty-slot">{hint}</div>}
        {trade[key].map((id) => {
          const v = valuation.byId.get(id);
          return (
            <div className="side-item" key={id}>
              {v && <Headshot name={v.player.name} nbaId={v.player.nbaId} />}
              <div className="grow">
                <button className="link-btn" style={{ color: "inherit", fontSize: 15 }} onClick={() => onOpen(id)}>
                  {v?.player.name ?? id}
                </button>
                <div className="meta">
                  {v ? `${rankLabel(v)} overall, ${v.player.team}` : "No stats in this view"}
                  {v && <InjuryTag injury={v.player.injury} />}
                </div>
              </div>
              <span className="value">{v ? fmt(v.value) : "–"}</span>
              <button className="remove" aria-label={`Remove ${v?.player.name ?? id}`}
                onClick={() => onChange({ ...trade, [key]: trade[key].filter((x) => x !== id) })}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div className="trade-grid">
        {side("send", "You send", "Players leaving your team")}
        {side("receive", "You receive", "Players joining your team")}
      </div>

      {missing.length > 0 && <p className="notice" style={{ marginTop: 16 }}>Some players have no stats in the current stats view and aren't counted. Switch the Stats menu to include them.</p>}

      {!result ? (
        <div className="panel panel-pad" style={{ marginTop: 16 }}>
          <p className="hint">Add at least one player to each side to see who wins the trade, scored with your league settings.</p>
        </div>
      ) : (
        <div className="panel panel-pad" style={{ marginTop: 16 }}>
          <div className={`verdict ${result.verdict}`} role="status">
            <span className="headline">
              {result.verdict === "win" ? "You win" : result.verdict === "lose" ? "You lose" : "About even"}
            </span>
            <p><b>{signed(result.net, isCats ? 2 : 1)} {unit}</b> for your team after the trade.</p>
            <p className="meta">Within 10% either way counts as even.</p>
          </div>

          <table className="ledger">
            <tbody>
              <tr><td>Value you receive</td><td>{fmt(result.receiveValue)}</td></tr>
              <tr><td>Value you send</td><td>−{fmt(result.sendValue)}</td></tr>
              {result.rosterAdjustment !== 0 && (
                <tr>
                  <td>
                    {trade.send.length > trade.receive.length
                      ? `Roster spot${trade.send.length - trade.receive.length > 1 ? "s" : ""} freed, filled from waivers`
                      : `Waiver-level player${trade.receive.length - trade.send.length > 1 ? "s" : ""} you cut to make room`}
                  </td>
                  <td>{signed(result.rosterAdjustment, isCats ? 2 : 1)}</td>
                </tr>
              )}
              <tr className="total"><td>Net change</td><td>{signed(result.net, isCats ? 2 : 1)}</td></tr>
            </tbody>
          </table>

          {result.categoryNet && (
            <>
              <h3 className="section-title" style={{ marginTop: 22 }}>By category</h3>
              <div className="bars">
                {CATEGORIES.map((c) => {
                  const z = result.categoryNet![c];
                  const off = !settings.categories.includes(c);
                  return (
                    <div className="bar-row" key={c}>
                      <span className="label">{CATEGORY_LABELS[c]}</span>
                      <span className="diverge" aria-hidden="true">
                        <span className={`${z >= 0 ? "up" : "down"}${off ? " off" : ""}`} style={{ width: `${Math.min(Math.abs(z), 4) / 4 * 50}%` }} />
                      </span>
                      <span className="val">{off ? "punt" : signed(z, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <button className="link-btn" style={{ marginTop: 16 }} onClick={() => onChange({ send: [], receive: [] })}>Clear trade</button>
        </div>
      )}
    </div>
  );
}
