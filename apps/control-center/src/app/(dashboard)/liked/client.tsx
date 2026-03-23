"use client";

import { useEffect, useState, useCallback } from "react";
import { ItemCard, ItemCardSkeleton, ItemData } from "@/components/monitors/item-card";
import { useVintedAccount } from "@/components/account-provider";
import { toast } from "sonner";
import { Heart, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface VintedFavItem {
  id: number;
  title: string;
  price: { amount: string; currency_code: string };
  total_item_price?: { amount: string; currency_code: string };
  url: string;
  photo: { url: string };
  photos?: { url: string }[];
  size_title: string;
  brand_title: string;
  status: string;
  user: { id: number; login: string };
  location?: string;
  rating?: string;
}

interface PaginationData {
  current_page: number;
  total_pages: number;
  total_entries: number;
}

export function LikedClient() {
  const { linked, loading: accountLoading, syncLikes } = useVintedAccount();
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);

  const fetchFavorites = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/favorites?page=${pageNum}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch favorites: ${res.status}`);
      }
      const data = await res.json();
      
      const vItems = (data.items || []) as VintedFavItem[];
      
      if (vItems.length > 0) {
        syncLikes(vItems.map(i => Number(i.id)));
      }

      const mapped: ItemData[] = vItems.map((item: VintedFavItem) => ({
        id: String(item.id),
        monitor_id: 0,
        title: item.title,
        brand: item.brand_title,
        price: `${item.price.amount} ${item.price.currency_code}`,
        total_price: item.total_item_price 
          ? `${item.total_item_price.amount} ${item.total_item_price.currency_code}` 
          : null,
        size: item.size_title,
        condition: item.status,
        url: item.url,
        image_url: item.photo?.url,
        extra_images: item.photos ? item.photos.slice(1).map(p => p.url) : [],
        found_at: new Date().toISOString(),
        seller_id: String(item.user.id),
        location: item.location || null,
        rating: item.rating || null,
      }));

      setItems(mapped);
      if (data.pagination) {
        setPagination({
          current_page: data.pagination.current_page,
          total_pages: data.pagination.total_pages,
          total_entries: data.pagination.total_entries,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load liked items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (linked) {
      fetchFavorites(page);
    }
  }, [linked, page, fetchFavorites]);

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
          <Heart className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Vinted Account Not Linked</h2>
        <p className="mt-1.5 text-muted-foreground max-w-sm">
          Connect your Vinted account in the settings to view and manage your liked items directly from Vintrack.
        </p>
        <Button asChild className="mt-6">
          <Link href="/account">Go to Account Settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liked Items</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination ? `${pagination.total_pages} items found` : "Manage your Vinted favorites."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFavorites(page)}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-center">
          <Heart className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {page > 1 ? "No more items on this page" : "No liked items found"}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {page > 1 
              ? "Try going back to the previous page." 
              : "Your Vinted favorites will appear here."}
          </p>
          {page > 1 && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => setPage(1)}
              className="mt-2 text-blue-500"
            >
              Back to first page
            </Button>
          )}
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {pagination.total_pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            disabled={page === pagination.total_pages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
