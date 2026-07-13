import type { Player } from "../types/player";

interface PlayerTableProps {
  players: Player[];
  loading: boolean;
}

export function PlayerTable({ players, loading }: PlayerTableProps) {
  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading players…</div>;
  }

  if (players.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No players match that search.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-court-line text-left text-xs uppercase tracking-wider text-slate-500">
          <th className="py-2 pr-4 font-medium">Player</th>
          <th className="py-2 pr-4 font-medium">Team</th>
          <th className="py-2 pr-4 font-medium">Pos</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.id} className="border-b border-court-line/60 hover:bg-court-panel">
            <td className="py-2 pr-4 font-medium text-slate-100">
              {player.first_name} {player.last_name}
            </td>
            <td className="py-2 pr-4 font-mono text-stat-accent">
              {player.team?.abbreviation ?? "—"}
            </td>
            <td className="py-2 pr-4 text-slate-400">{player.position ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
