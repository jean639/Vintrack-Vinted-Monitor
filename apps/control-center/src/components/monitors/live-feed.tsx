"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ItemCard, ItemCardSkeleton, type ItemData } from "@/components/monitors/item-card";
import { useMonitorLiveContext } from "@/components/monitors/monitor-live-context";

export function LiveFeed({ monitorId }: { monitorId: number }) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { incrementItemCount } = useMonitorLiveContext();
  const seenItemIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`/api/monitors/${monitorId}/items`);
        if (res.ok) {
          const data: ItemData[] = await res.json();
          seenItemIds.current = new Set(data.map((item) => String(item.id)));
          setItems(data.map((i) => ({ ...i, isLive: false })));
        }
      } catch (err) {
        console.error("Fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [incrementItemCount, monitorId]);

  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.onmessage = (event) => {
      try {
        const newItem: ItemData = JSON.parse(event.data);

        if (newItem.monitor_id === monitorId) {
          const newId = String(newItem.id);
          const liveItem: ItemData = { ...newItem, id: newId, isLive: true };
          const isExisting = seenItemIds.current.has(newId);

          if (!isExisting) {
            seenItemIds.current.add(newId);
            incrementItemCount();
          }

          setItems((prev) => {
            const existingIdx = prev.findIndex((i) => String(i.id) === newId);
            if (existingIdx !== -1) {
              const existing = prev[existingIdx];
              const merged = {
                ...existing,
                location: newItem.location || existing.location,
                rating: newItem.rating || existing.rating,
                seller_id: newItem.seller_id || existing.seller_id,
                total_price: newItem.total_price || existing.total_price,
                extra_images: newItem.extra_images || existing.extra_images,
              };
              const updated = [...prev];
              updated[existingIdx] = merged;
              return updated;
            }
            return [liveItem, ...prev];
          });

          setTimeout(() => {
            setItems((curr) =>
              curr.map((item) =>
                String(item.id) === String(newItem.id) ? { ...item, isLive: false } : item
              )
            );
          }, 10000);
        }
      } catch (e) {
        console.error("SSE Parse Error", e);
      }
    };

    return () => eventSource.close();
  }, [incrementItemCount, monitorId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {loading && items.length === 0
        ? [...Array(5)].map((_, i) => <ItemCardSkeleton key={i} />)
        : items.map((item) => <ItemCard key={item.id} item={item} />)}

      {items.length === 0 && !loading && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl bg-card">
          <div className="bg-muted p-3 rounded-xl mb-4">
            <Search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No items found yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            Items will appear here in real-time as the worker finds them.
          </p>
        </div>
      )}
    </div>
  );
}
