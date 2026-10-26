import { useEffect, useState } from "react";

/**
 * useState that survives reloads. Storage can be unavailable (private mode,
 * blocked cookies), so every access is guarded and the app still works
 * without it — it just forgets on refresh.
 */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked; keep working in memory */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
