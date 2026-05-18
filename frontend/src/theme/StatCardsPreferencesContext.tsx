import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "dashboardStatsVisible";

function loadShowStats(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "boolean") return parsed;
    return true;
  } catch {
    return true;
  }
}

type StatCardsPreferencesContextValue = {
  showStats: boolean;
  toggleShowStats: () => void;
};

const StatCardsPreferencesContext = createContext<StatCardsPreferencesContextValue | undefined>(
  undefined,
);

export function useStatCardsPreferences() {
  const ctx = useContext(StatCardsPreferencesContext);
  if (!ctx) {
    throw new Error("useStatCardsPreferences must be used within StatCardsPreferencesProvider");
  }
  return ctx;
}

export function StatCardsPreferencesProvider({ children }: { children: ReactNode }) {
  const [showStats, setShowStats] = useState(loadShowStats);

  const toggleShowStats = useCallback(() => {
    setShowStats(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ showStats, toggleShowStats }), [showStats, toggleShowStats]);

  return (
    <StatCardsPreferencesContext.Provider value={value}>
      {children}
    </StatCardsPreferencesContext.Provider>
  );
}
