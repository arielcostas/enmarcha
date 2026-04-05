import { useCallback, useState } from "react";

/**
 * Like useState, but backed by sessionStorage so state survives back-navigation
 * within the same browser tab. Cleared when the tab is closed.
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: T) => T)(prev)
            : updater;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // sessionStorage may be unavailable (private browsing quota, etc.)
        }
        return next;
      });
    },
    [key]
  );

  return [state, setState];
}
