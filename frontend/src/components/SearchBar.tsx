interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search players by name..."
      className="w-full max-w-sm rounded-md border border-court-line bg-court-panel px-3 py-2
                 text-sm text-slate-200 placeholder-slate-500 outline-none
                 focus:border-stat-accent focus:ring-1 focus:ring-stat-accent"
    />
  );
}
