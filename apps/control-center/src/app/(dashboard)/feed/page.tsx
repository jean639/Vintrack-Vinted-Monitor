"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ItemCard, ItemCardSkeleton, type ItemData } from "@/components/monitors/item-card";

type FeedSummary = {
  activeMonitors: number;
  totalMonitors: number;
};

export default function FeedPage() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FeedSummary | null>(null);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const [feedRes, summaryRes] = await Promise.all([
          fetch("/api/feed"),
          fetch("/api/monitors/summary"),
        ]);

        if (feedRes.ok) {
          const data: ItemData[] = await feedRes.json();
          setItems(data.map((i) => ({ ...i, isLive: false })));
        }

        if (summaryRes.ok) {
          const data: FeedSummary = await summaryRes.json();
          setSummary(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.onmessage = (event) => {
      try {
        const newItem: ItemData = JSON.parse(event.data);
        const liveItem: ItemData = {
          ...newItem,
          isLive: true,
          monitor_name: newItem.monitor_name || null,
        };

        setItems((prev) => {
          const newId = String(newItem.id);
          const existingIdx = prev.findIndex((i) => String(i.id) === newId);
          if (existingIdx !== -1) {
            const existing = prev[existingIdx];
            const merged = {
              ...existing,
              monitor_name: newItem.monitor_name || existing.monitor_name,
              location: newItem.location || existing.location,
              rating: newItem.rating || existing.rating,
              seller_id: newItem.seller_id || existing.seller_id,
              total_price: newItem.total_price || existing.total_price,
            };
            const updated = [...prev];
            updated[existingIdx] = merged;
            return updated;
          }
          return [{ ...liveItem, id: newId }, ...prev];
        });

        setTimeout(() => {
          setItems((curr) =>
            curr.map((item) =>
              String(item.id) === String(newItem.id) ? { ...item, isLive: false } : item
            )
          );
        }, 30000);
      } catch (e) {
        console.error("SSE Error", e);
      }
    };

    return () => eventSource.close();
  }, []);

  const activeMonitorCount = summary?.activeMonitors ?? 0;
  const hasActiveMonitors = activeMonitorCount > 0;
  const liveBadgeClassName = hasActiveMonitors
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Feed</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time stream across all your monitors.
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-[11px] font-medium sm:self-auto ${liveBadgeClassName}`}
        >
          {hasActiveMonitors ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-amber-500/80" />
          )}
          {hasActiveMonitors
            ? `Live · ${activeMonitorCount} monitor${activeMonitorCount === 1 ? "" : "s"}`
            : "No monitor active"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {loading && items.length === 0
          ? [...Array(8)].map((_, i) => <ItemCardSkeleton key={i} />)
          : items.map((item) => (
              <ItemCard key={item.id} item={item} showMonitor />
            ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/75 py-20 shadow-sm backdrop-blur">
          <div className="mb-4 rounded-xl bg-muted p-3">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Waiting for items...
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            New items will appear here in real-time as your monitors find them.
          </p>
        </div>
      )}
    </div>
  );
}
