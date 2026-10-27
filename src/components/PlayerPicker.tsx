import { useId, useMemo, useState } from "react";
import type { PlayerValue } from "../engine/value";
import { rankLabel, UNRANKED_HINT, type AppLine } from "../lib/data";
import { Headshot } from "./Headshot";
import { InjuryTag } from "./InjuryTag";

interface Props {
  players: PlayerValue<AppLine>[];
  exclude: Set<string>;
  onPick: (id: string) => void;
  placeholder?: string;
  label: string;
}

/** Type-ahead search over every player: ranked ones first, then everyone else. */
export function PlayerPicker({ players, exclude, onPick, placeholder, label }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return players.filter((p) => !exclude.has(p.player.id) && normalize(p.player.name).includes(q)).slice(0, 8);
  }, [players, exclude, query]);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
    setActive(0);
  };

  return (
    <div className="picker">
      <label className="sr-only" htmlFor={`${listId}-input`}>{label}</label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
        placeholder={placeholder ?? "Search players"}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && matches[active]) { e.preventDefault(); pick(matches[active].player.id); }
          else if (e.key === "Escape") setQuery("");
        }}
      />
      {matches.length > 0 && (
        <ul id={listId} role="listbox">
          {matches.map((m, i) => (
            <li
              key={m.player.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(m.player.id); }}
            >
              <Headshot name={m.player.name} nbaId={m.player.nbaId} />
              <span className="grow">
                {m.player.name}
                <span className="meta"> {m.player.team} {m.player.pos}<InjuryTag injury={m.player.injury} /></span>
              </span>
              <span className="r" title={m.unranked ? UNRANKED_HINT : undefined}>{rankLabel(m)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalize(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
