"use client";

import { useMonitorLiveContext } from "@/components/monitors/monitor-live-context";

export function MonitorItemCount() {
  const { itemCount } = useMonitorLiveContext();

  return <span>{itemCount.toLocaleString()} items</span>;
}
