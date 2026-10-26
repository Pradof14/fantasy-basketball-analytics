/** Fixed decimals without the "-0.0" that toFixed gives tiny negatives. */
const fixed = (n: number, d: number) => (Number.isFinite(n) ? (Math.abs(n) < 0.5 / 10 ** d ? 0 : n).toFixed(d) : "–");
export const fmt1 = (n: number) => fixed(n, 1);
export const fmt2 = (n: number) => fixed(n, 2);
export const signed = (n: number, digits = 1) => {
  const s = Math.abs(n).toFixed(digits);
  return Number(s) === 0 ? s : `${n > 0 ? "+" : "−"}${s}`;
};
export const pct = (made: number, att: number) => (att > 0 ? `${((made / att) * 100).toFixed(1)}%` : "–");

/** Bucket a z-score into a heat class for table cells. */
export function zClass(z: number): string {
  if (z >= 1.5) return "pos2";
  if (z >= 0.5) return "pos1";
  if (z <= -1.5) return "neg2";
  if (z <= -0.5) return "neg1";
  return "neutral";
}

export function initials(name: string): string {
  const parts = name.replace(/,/g, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
