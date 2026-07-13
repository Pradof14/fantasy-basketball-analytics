import { useEffect, useState } from "react";
import { listPlayers } from "../api/players";
import { PlayerTable } from "../components/PlayerTable";
import { SearchBar } from "../components/SearchBar";
import type { Player } from "../types/player";

const PAGE_SIZE = 25;

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input so we're not firing a request on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listPlayers({ name: search, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setPlayers(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load players. Is the backend running?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 font-mono text-2xl font-semibold text-slate-100">Players</h1>
      <p className="mb-6 text-sm text-slate-500">{total} players in the database</p>

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {error ? (
        <div className="rounded-md border border-stat-negative/40 bg-stat-negative/10 px-4 py-3 text-sm text-stat-negative">
          {error}
        </div>
      ) : (
        <div className="rounded-lg border border-court-line bg-court-panel px-4">
          <PlayerTable players={players} loading={loading} />
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-court-line px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-court-line px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
