"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

type MonitorHealth = {
  monitor_id: number;
  total_checks: number;
  total_errors: number;
  consecutive_errors: number;
  last_error?: string;
  updated_at: string;
};

export function ProxyHealthCard({ monitorId }: { monitorId: number }) {
  const [health, setHealth] = useState<MonitorHealth | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/monitors/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data[monitorId] || null);
      }
    } catch {}
  }, [monitorId]);

  useEffect(() => {
    const timeout = window.setTimeout(fetchHealth, 0);
    const interval = setInterval(fetchHealth, 10_000);
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchHealth]);

  if (!health) return null;

  const hasWarning =
    health.consecutive_errors === -1 || health.consecutive_errors >= 3;

  if (!hasWarning) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />
        <p className="text-[13px] font-semibold text-red-800 dark:text-red-300">
          Proxy Warning
        </p>
      </div>
      <p className="text-[12px] text-red-700 dark:text-red-400">
        Your proxies are producing errors. If this continues, the monitor will
        be stopped automatically. Check your proxy group settings.
      </p>
    </div>
  );
}
