import { useRef, useState } from "react";
import { playersFromCsv } from "../engine/csv";
import { CATEGORY_PRESETS, DEFAULT_SETTINGS, POINTS_PRESETS, matchPreset } from "../engine/presets";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COUNTING_STATS,
  STAT_LABELS,
  type Category,
  type LeagueSettings,
  type PlayerLine,
} from "../engine/types";

interface Props {
  settings: LeagueSettings;
  onChange: (s: LeagueSettings) => void;
  onImport: (players: PlayerLine[]) => void;
  basisDisabled: boolean;
}

export function SettingsPanel({ settings, onChange, onImport, basisDisabled }: Props) {
  const set = (patch: Partial<LeagueSettings>) => onChange({ ...settings, ...patch });
  const preset = matchPreset(settings.weights);
  // On phones, start collapsed so the rankings are on screen first.
  const [startOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 961px)").matches);

  const toggleCategory = (c: Category) => {
    const has = settings.categories.includes(c);
    if (has && settings.categories.length === 1) return; // keep at least one
    set({ categories: has ? settings.categories.filter((x) => x !== c) : CATEGORIES.filter((x) => x === c || settings.categories.includes(x)) });
  };

  return (
    <aside className="panel panel-pad settings" aria-label="League settings">
      <details open={startOpen}>
        <summary>
          <h2 className="section-title">Your league</h2>
        </summary>
        <p className="hint">Match these to your league and every ranking, trade, and team grade updates.</p>

        <div className="field">
          <span className="field-label" id="scoring-label">Scoring</span>
          <div className="seg" role="group" aria-labelledby="scoring-label">
            <button aria-pressed={settings.scoring === "points"} onClick={() => set({ scoring: "points" })}>Points</button>
            <button aria-pressed={settings.scoring === "categories"} onClick={() => set({ scoring: "categories" })}>Categories</button>
          </div>
        </div>

        {settings.scoring === "points" ? (
          <>
            <div className="field">
              <label htmlFor="preset">Scoring system</label>
              <select
                id="preset"
                className="input"
                value={preset ?? "custom"}
                onChange={(e) => {
                  const p = POINTS_PRESETS.find((x) => x.id === e.target.value);
                  if (p) set({ weights: { ...p.weights } });
                }}
              >
                {POINTS_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="custom" disabled={!!preset}>Custom</option>
              </select>
            </div>
            <div className="field">
              <span className="field-label">Points per stat</span>
              <div className="weights">
                {COUNTING_STATS.map((stat) => {
                  const w = settings.weights[stat] ?? 0;
                  return (
                    <label key={stat}>
                      {STAT_LABELS[stat]}
                      <input
                        type="number"
                        step="0.25"
                        value={w}
                        className={w ? "nonzero" : undefined}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          set({ weights: { ...settings.weights, [stat]: Number.isFinite(v) ? v : 0 } });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="hint">Double-double bonuses aren't counted: season averages can't show how often they happen.</p>
            </div>
          </>
        ) : (
          <div className="field">
            <span className="field-label">Categories</span>
            <div className="chips">
              {CATEGORY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="chip"
                  aria-pressed={sameSet(p.categories, settings.categories)}
                  onClick={() => set({ categories: [...p.categories] })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="chips" style={{ marginTop: 8 }}>
              {CATEGORIES.map((c) => {
                const on = settings.categories.includes(c);
                return (
                  <button
                    key={c}
                    className={`chip${on ? "" : " punted"}`}
                    aria-pressed={on}
                    onClick={() => toggleCategory(c)}
                    title={on ? `Punt ${CATEGORY_LABELS[c]}` : `Count ${CATEGORY_LABELS[c]} again`}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
            <p className="hint">Turn a category off to punt it. Rankings re-sort for that build.</p>
          </div>
        )}

        <div className="field">
          <div className="row2">
            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="teams">Teams</label>
              <IntField id="teams" min={2} max={30} value={settings.teams} onCommit={(teams) => set({ teams })} />
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="roster">Roster spots</label>
              <IntField id="roster" min={5} max={25} value={settings.rosterSize} onCommit={(rosterSize) => set({ rosterSize })} />
            </div>
          </div>
          <p className="hint">{settings.teams * settings.rosterSize} players get rostered. Anyone below that line is a waiver pickup.</p>
        </div>

        <div className="field">
          <span className="field-label" id="basis-label">Value by</span>
          <div className="seg" role="group" aria-labelledby="basis-label">
            <button aria-pressed={settings.basis === "perGame"} onClick={() => set({ basis: "perGame" })}>Per game</button>
            <button aria-pressed={settings.basis === "total"} disabled={basisDisabled} onClick={() => set({ basis: "total" })}>Season totals</button>
          </div>
          <p className="hint">
            {basisDisabled
              ? "Season totals aren't available for projections, which mix two seasons."
              : "Totals reward players who stayed on the floor."}
          </p>
        </div>

        <button className="link-btn" style={{ marginTop: 14 }} onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Reset to defaults
        </button>

        <hr className="divider" />
        <CsvImport onImport={onImport} />
      </details>
    </aside>
  );
}

export function CsvImport({ onImport }: { onImport: (players: PlayerLine[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setDone(null);
    try {
      const players = playersFromCsv(await file.text());
      onImport(players);
      setDone(players.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="field">
      <span className="field-label">Use your own stats</span>
      <p className="hint">
        Import a per-game CSV, such as Basketball Reference's "Get table as CSV" export or your own projections.
      </p>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file"
        onChange={(e) => handle(e.target.files?.[0])} />
      <label htmlFor="csv-file" className="btn small" style={{ justifySelf: "start" }}>Import CSV</label>
      {done !== null && <p className="hint">Imported {done} players. They're under "Imported CSV" in the stats menu.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Number input that lets you type freely and only commits values in range. */
function IntField({ id, value, min, max, onCommit }: {
  id: string; value: number; min: number; max: number; onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setDraft(String(value)); }
  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
    else setDraft(String(value));
  };
  return (
    <input id={id} type="number" min={min} max={max} value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (n >= min && n <= max) onCommit(n);
      }}
      onBlur={commit} />
  );
}
