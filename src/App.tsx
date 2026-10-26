import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "./engine/presets";
import type { Dataset, LeagueSettings, PlayerLine } from "./engine/types";
import { valuePlayers } from "./engine/value";
import { MyTeam } from "./components/MyTeam";
import { PlayerDrawer } from "./components/PlayerDrawer";
import { RankingsTable } from "./components/RankingsTable";
import { CsvImport, SettingsPanel } from "./components/SettingsPanel";
import { TradeAnalyzer, type TradeState } from "./components/TradeAnalyzer";
import { defaultMinGames, gamesOf, linesFor, loadDataset, seasonOptions, type SeasonMode } from "./lib/data";
import { useStored } from "./lib/useStored";

type Tab = "rankings" | "trade" | "team";
const TABS: { id: Tab; label: string }[] = [
  { id: "rankings", label: "Rankings" },
  { id: "trade", label: "Trade analyzer" },
  { id: "team", label: "My team" },
];
const REPO_URL = "https://github.com/Pradof14/fantasy-basketball-analytics";
const PORTFOLIO_URL = "https://juanprado.dev/";

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [imported, setImported] = useStored<PlayerLine[] | null>("fbc.imported", null);
  const [settings, setSettings] = useStored<LeagueSettings>("fbc.settings", DEFAULT_SETTINGS);
  const [storedMode, setMode] = useStored<SeasonMode | null>("fbc.season", null);
  const [minGamesByMode, setMinGamesByMode] = useStored<Partial<Record<SeasonMode, number>>>("fbc.minGames", {});
  const [starred, setStarred] = useStored<string[]>("fbc.starred", []);
  const [roster, setRoster] = useStored<string[]>("fbc.roster", []);
  const [trade, setTrade] = useStored<TradeState>("fbc.trade", { send: [], receive: [] });
  const [tab, setTab] = useState<Tab>(() => tabFromHash());
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadDataset().then((d) => { setData(d); setLoading(false); });
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const options = useMemo(() => seasonOptions(data, imported), [data, imported]);
  const mode: SeasonMode | null =
    storedMode && options.some((o) => o.mode === storedMode) ? storedMode : options[0]?.mode ?? null;

  const lines = useMemo(() => (mode ? linesFor(mode, data, imported) : []), [mode, data, imported]);
  const minGames = mode ? minGamesByMode[mode] ?? defaultMinGames(mode, lines) : 0;
  const effective: LeagueSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...settings, basis: mode === "blend" ? "perGame" : settings.basis }),
    [settings, mode],
  );
  const valuation = useMemo(
    () => valuePlayers(lines.filter((p) => gamesOf(p) >= minGames), effective),
    [lines, minGames, effective],
  );

  const goTab = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const open = openId ? valuation.byId.get(openId) : undefined;
  const historyFor = (id: string) =>
    (data?.seasons ?? [])
      .map((s) => ({ label: s.label, line: s.players.find((p) => p.id === id) }))
      .filter((h): h is { label: string; line: PlayerLine } => !!h.line);

  const maxGp = lines.reduce((m, p) => Math.max(m, p.gp), 0);
  const seasonNote =
    mode === "current" && maxGp < 20 && options.some((o) => o.mode === "blend")
      ? `It's early: nobody has played more than ${maxGp} games. For steadier numbers, switch to the projection, which blends in last season.`
      : undefined;

  const importCsv = (players: PlayerLine[]) => { setImported(players); setMode("imported"); };

  if (loading) return <div className="empty"><p className="hint">Loading player stats…</p></div>;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="ball" aria-hidden="true" />
          <h1>Fantasy Hoops Calculator</h1>
          <a className="byline" href={PORTFOLIO_URL}>by Juan Prado</a>
        </div>
        {mode && (
          <>
            <nav className="tabs" role="tablist" aria-label="Sections">
              {TABS.map((t) => (
                <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => goTab(t.id)}>
                  {t.label}
                  {t.id === "team" && roster.length > 0 && <span className="count">{roster.length}</span>}
                  {t.id === "trade" && trade.send.length + trade.receive.length > 0 && (
                    <span className="count">{trade.send.length + trade.receive.length}</span>
                  )}
                </button>
              ))}
            </nav>
            <label className="season-select">
              Stats
              <select value={mode} onChange={(e) => setMode(e.target.value as SeasonMode)}
                title={options.find((o) => o.mode === mode)?.description}>
                {options.map((o) => <option key={o.mode} value={o.mode}>{o.label}</option>)}
              </select>
            </label>
          </>
        )}
      </header>

      {!mode ? (
        <main className="empty">
          <h2>No stats loaded yet</h2>
          <p className="hint">
            The nightly data job hasn't produced <code>public/data/players.json</code>. Run{" "}
            <code>python pipeline/build_dataset.py</code>, or import a per-game CSV to start right away.
          </p>
          <div style={{ display: "grid", justifyItems: "center", marginTop: 16 }}><CsvImport onImport={importCsv} /></div>
        </main>
      ) : (
        <main className="layout">
          <SettingsPanel settings={effective} onChange={setSettings} onImport={importCsv} basisDisabled={mode === "blend"} />
          <div>
            {tab === "rankings" && (
              <RankingsTable valuation={valuation} settings={effective} minGames={minGames}
                onMinGames={(n) => setMinGamesByMode({ ...minGamesByMode, [mode]: n })}
                starred={starred} onToggleStar={(id) => setStarred(toggle(starred, id))}
                roster={roster} onOpen={setOpenId} seasonNote={seasonNote} />
            )}
            {tab === "trade" && (
              <TradeAnalyzer valuation={valuation} settings={effective} trade={trade} onChange={setTrade} onOpen={setOpenId} />
            )}
            {tab === "team" && (
              <MyTeam valuation={valuation} settings={effective} roster={roster} onChange={setRoster} onOpen={setOpenId} />
            )}
          </div>
        </main>
      )}

      {open && (
        <PlayerDrawer
          value={open}
          valuation={valuation}
          settings={effective}
          history={historyFor(open.player.id)}
          starred={starred.includes(open.player.id)}
          onRoster={roster.includes(open.player.id)}
          tradeSide={trade.send.includes(open.player.id) ? "send" : trade.receive.includes(open.player.id) ? "receive" : null}
          onClose={() => setOpenId(null)}
          onToggleStar={() => setStarred(toggle(starred, open.player.id))}
          onToggleRoster={() => setRoster(toggle(roster, open.player.id))}
          onTrade={(side) => {
            const id = open.player.id;
            const other = side === "send" ? "receive" : "send";
            setTrade({ ...trade, [side]: [...trade[side].filter((x) => x !== id), id], [other]: trade[other].filter((x) => x !== id) });
            setOpenId(null);
            goTab("trade");
          }}
        />
      )}

      <footer className="foot">
        {data && <>Stats from {data.source}, updated {new Date(data.generatedAt).toLocaleDateString()}. </>}
        Built by <a href={PORTFOLIO_URL}>Juan Prado</a>. <a href={REPO_URL}>Source on GitHub</a>
      </footer>
    </>
  );
}

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as Tab) : "rankings";
}
