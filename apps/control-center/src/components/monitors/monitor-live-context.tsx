"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type MonitorLiveContextValue = {
  itemCount: number;
  incrementItemCount: () => void;
};

const MonitorLiveContext = createContext<MonitorLiveContextValue | null>(null);

export function MonitorLiveProvider({
  children,
  initialItemCount,
}: {
  children: React.ReactNode;
  initialItemCount: number;
}) {
  const [itemCount, setItemCount] = useState(initialItemCount);
  const incrementItemCount = useCallback(() => {
    setItemCount((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({
      itemCount,
      incrementItemCount,
    }),
    [incrementItemCount, itemCount]
  );

  return (
    <MonitorLiveContext.Provider value={value}>
      {children}
    </MonitorLiveContext.Provider>
  );
}

export function useMonitorLiveContext() {
  const context = useContext(MonitorLiveContext);

  if (!context) {
    throw new Error("useMonitorLiveContext must be used within MonitorLiveProvider");
  }

  return context;
}
