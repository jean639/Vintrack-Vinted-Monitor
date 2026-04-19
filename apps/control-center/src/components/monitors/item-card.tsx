"use client";

import { memo, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ImageOff, Heart, MessageCircle, Send, Loader2, XIcon, ChevronLeft, ChevronRight, Tag, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useVintedAccount } from "@/components/account-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { runBrowserBuyViaExtension } from "@/lib/vintrack-extension";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ItemData = {
  id: string;
  monitor_id: number;
  title: string | null;
  brand?: string | null;
  price: string | null;
  total_price: string | null;
  size: string | null;
  condition: string | null;
  url: string | null;
  image_url: string | null;
  extra_images?: string[] | null;
  found_at: string;
  monitor_name?: string | null;
  isLive?: boolean;
  location: string | null;
  rating: string | null;
  seller_id: string | null;
};

interface ItemCardProps {
  item: ItemData;
  showMonitor?: boolean;
}

function getMonitorLabel(item: ItemData) {
  const name = item.monitor_name?.trim();
  return name ? `${name} (${item.monitor_id})` : `Monitor #${item.monitor_id}`;
}

function ItemCardComponent({ item, showMonitor = false }: ItemCardProps) {
  const { linked, domain: accountDomain, likedIds, addLike, removeLike } = useVintedAccount();
  const liked = likedIds.has(Number(item.id));
  const [liking, setLiking] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedImgIndex, setSelectedImgIndex] = useState<number | null>(null);

  const allImages = item.image_url ? [item.image_url, ...(item.extra_images || [])] : [];
  const hasDifferentTotalPrice =
    Boolean(item.total_price) && item.total_price !== item.price;

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedImgIndex((prev) =>
      prev === null ? prev : (prev + 1) % allImages.length
    );
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedImgIndex((prev) =>
      prev === null ? prev : (prev - 1 + allImages.length) % allImages.length
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImgIndex !== null) {
        if (e.key === "ArrowRight") {
          setSelectedImgIndex((prev) =>
            prev === null ? prev : (prev + 1) % allImages.length
          );
        }
        if (e.key === "ArrowLeft") {
          setSelectedImgIndex((prev) =>
            prev === null ? prev : (prev - 1 + allImages.length) % allImages.length
          );
        }
        if (e.key === "Escape") setSelectedImgIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImgIndex, allImages.length]);

  const timeStr = new Date(item.found_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!linked) {
      toast.error("Link your Vinted account first (Account tab)");
      return;
    }
    setLiking(true);
    try {
      const endpoint = liked ? "/api/items/unlike" : "/api/items/like";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: Number(item.id) }),
      });
      if (res.ok) {
        if (liked) {
          removeLike(Number(item.id));
        } else {
          addLike(Number(item.id));
        }
        toast.success(liked ? "Unliked" : "Liked!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Like failed (${res.status})`);
      }
    } catch {
      toast.error("Network error — could not reach server");
    }
    setLiking(false);
  };

  const handleSendMessage = async () => {
    if (!linked) {
      toast.error("Link your Vinted account first (Account tab)");
      return;
    }
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: Number(item.id),
          seller_id: Number(item.seller_id),
          message: msgText.trim(),
        }),
      });
      if (res.ok) {
        toast.success("Message sent!");
        setMsgOpen(false);
        setMsgText("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Send failed (${res.status})`);
      }
    } catch {
      toast.error("Network error — could not reach server");
    }
    setSending(false);
  };

  const handleSendOffer = async () => {
    if (!linked) {
      toast.error("Link your Vinted account first (Account tab)");
      return;
    }
    const priceVal = parseFloat(offerPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    
    // Vinted server-side minimum offer is 60% of the original item price
    const currentPrice = parseFloat(item.price || "0");
    if (!isNaN(currentPrice) && currentPrice > 0) {
      const minPrice = currentPrice * 0.6;
      if (priceVal < minPrice) {
        toast.error(`Offer too low. Minimum allowed is €${minPrice.toFixed(2)}`);
        return;
      }
    }

    setSendingOffer(true);
    try {
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: Number(item.id),
          seller_id: Number(item.seller_id),
          price: priceVal.toString(),
          currency: "EUR",
        }),
      });
      if (res.ok) {
        toast.success("Offer sent!");
        setOfferOpen(false);
        setOfferPrice("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Offer failed (${res.status})`);
      }
    } catch {
      toast.error("Network error — could not reach server");
    }
    setSendingOffer(false);
  };

  const runBuy = async () => {
    if (!linked) {
      toast.error("Link your Vinted account first (Account tab)");
      return;
    }
    if (!item.seller_id) {
      toast.error("Seller information is missing");
      return;
    }

    setBuying(true);
    try {
      const browserBuyResult = await runBrowserBuyViaExtension({
        itemId: Number(item.id),
        sellerId: Number(item.seller_id),
        itemUrl: item.url || undefined,
        domain: accountDomain || (item.url ? new URL(item.url).hostname : undefined),
        pickupType: 1,
      });

      if (browserBuyResult) {
        if (browserBuyResult.ok) {
          if (!browserBuyResult.checkoutUrl) {
            toast.error("Browser checkout returned no Vinted checkout URL");
            return;
          }

          await fetch("/api/items/checkout-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item_id: Number(item.id),
              seller_id: Number(item.seller_id),
              transaction_id: browserBuyResult.transactionId || 0,
              purchase_id: browserBuyResult.purchaseId || "",
              checkout_url: browserBuyResult.checkoutUrl,
              status: "checkout_ready",
            }),
          }).catch(() => {});

          toast.success("Vinted checkout opened. Choose the payment method there.");
          setBuyDialogOpen(false);
          return;
        }

        if (browserBuyResult.code === "datadome_challenge") {
          toast.error(
            "Vinted requested a captcha in the browser tab. Solve it there, then retry checkout."
          );
          return;
        }

        toast.error(browserBuyResult.error || "Browser checkout failed");
        return;
      }

      toast.error("Browser extension not detected or not responding");
    } catch {
      toast.error("Browser checkout could not be started");
    } finally {
      setBuying(false);
    }
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!linked) {
      toast.error("Link your Vinted account first (Account tab)");
      return;
    }
    if (!item.seller_id) {
      toast.error("Seller information is missing");
      return;
    }
    setBuyDialogOpen(true);
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border/75 bg-card/92 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.28)] ${
        item.isLive
          ? "animate-in slide-in-from-top-2 fade-in duration-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10"
          : ""
      }`}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        {item.image_url ? (
          item.extra_images && item.extra_images.length > 0 ? (
            <div className="w-full h-full flex gap-0.5">
              <div
                className="flex-2 h-full overflow-hidden cursor-pointer"
                onClick={() => setSelectedImgIndex(0)}
              >
                <img
                  src={item.image_url}
                  alt={item.title || "Item"}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 h-full flex flex-col gap-0.5">
                {item.extra_images.slice(0, 2).map((img, idx) => (
                  <div
                    key={idx}
                    className="flex-1 cursor-pointer overflow-hidden bg-muted-foreground/10"
                    onClick={() => setSelectedImgIndex(idx + 1)}
                  >
                    <img
                      src={img}
                      alt={`${item.title} ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full cursor-pointer"
              onClick={() => setSelectedImgIndex(0)}
            >
              <img
                src={item.image_url}
                alt={item.title || "Item"}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </div>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/45">
            <ImageOff className="w-8 h-8" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-slate-950/82 via-slate-950/34 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="rounded-xl bg-slate-950/66 px-3 py-2 text-white shadow-lg backdrop-blur-md">
            <div className="text-lg font-semibold tracking-tight text-white">
              {item.price}
            </div>
            {hasDifferentTotalPrice && (
              <div className="mt-0.5 text-[11px] font-medium text-white/72">
                {item.total_price} total
              </div>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="rounded-full border border-white/14 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/88 backdrop-blur-sm">
              {allImages.length} photos
            </div>
          )}
        </div>

        {item.isLive && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/50 dark:bg-emerald-400/50 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 dark:bg-emerald-400" />
            </span>
            NEW
          </div>
        )}

        <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 sm:group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity z-10 sm:opacity-0 max-sm:opacity-100 md:group-hover:opacity-100">
          {linked && (
            <button
              onClick={handleLike}
              disabled={liking}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors cursor-pointer sm:h-7 sm:w-7",
                liked
                  ? "border-red-400/30 bg-red-500 text-white"
                  : "hover:bg-slate-950/80 hover:text-red-300"
              )}
              title={liked ? "Unlike" : "Like"}
            >
              <Heart className={cn("w-4 h-4 sm:w-3.5 sm:h-3.5", liked && "fill-current")} />
            </button>
          )}
          {linked && item.seller_id && (
            <>
              <button
                onClick={handleBuy}
                disabled={buying}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/25 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer sm:h-7 sm:w-7"
                title="Open Vinted checkout"
              >
                {buying ? (
                  <Loader2 className="w-4 h-4 animate-spin sm:w-3.5 sm:h-3.5" />
                ) : (
                  <ShoppingCart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOfferOpen(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-emerald-300 cursor-pointer sm:h-7 sm:w-7"
                title="Make an offer"
              >
                <Tag className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMsgOpen(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-sky-300 cursor-pointer sm:h-7 sm:w-7"
                title="Send message to seller"
              >
                <MessageCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3
          className="min-h-11 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground"
          title={item.title || ""}
        >
          {item.title || "Untitled"}
        </h3>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {item.brand && (
            <span className="flex h-5 items-center rounded-md border border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground">
              {item.brand}
            </span>
          )}
          {item.size && (
            <Badge
              variant="secondary"
              className="h-5 rounded-md border border-blue-500/20 bg-blue-500/10 px-1.5 text-[10px] font-medium text-blue-300"
            >
              {item.size}
            </Badge>
          )}
          {item.location && (
            <span className="flex h-5 items-center rounded-md border border-border/60 bg-muted/40 px-1.5 text-[10px] text-muted-foreground">
              {item.location}
            </span>
          )}
          {item.rating && (
            <span className="flex h-5 items-center rounded-md border border-amber-200/70 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-300">
              {item.rating}
            </span>
          )}
          {item.condition && (
            <span className="flex h-5 items-center rounded-md border border-border/60 bg-muted/40 px-1.5 text-[10px] text-muted-foreground">
              {item.condition}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {showMonitor ? (
            <Link
              href={`/monitors/${item.monitor_id}`}
              className="z-10 min-w-0 max-w-[calc(100%-4.5rem)]"
            >
              <span className="inline-flex max-w-full truncate text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:text-blue-400">
                {getMonitorLabel(item)}
              </span>
            </Link>
          ) : (
            <span />
          )}

          <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            {timeStr}
          </span>
        </div>
      </div>

      <a
        href={item.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 bg-primary py-2.5 text-xs font-medium tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
      >
        View on Vinted
        <ExternalLink className="w-3 h-3" />
      </a>

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <div className="flex gap-5 mb-4">
                  {item.image_url ? (
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted shadow-sm">
                      <img 
                        src={item.image_url} 
                        alt={item.title || "Item preview"} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted">
                      <ImageOff className="w-8 h-8 text-muted-foreground/45" />
                    </div>
                  )}
                  <div className="flex flex-col justify-center gap-1.5 min-w-0 overflow-hidden">
                    <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                      {item.title || "this item"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.brand && (
                        <span className="flex h-4.5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                          {item.brand}
                        </span>
                      )}
                      {item.size && (
                        <span className="text-[10px] px-1.5 h-4.5 flex items-center rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-100/50 dark:border-blue-500/20">
                          {item.size}
                        </span>
                      )}
                      {item.condition && (
                        <span className="flex h-4.5 items-center rounded border border-border/70 bg-muted px-1.5 text-[10px] text-muted-foreground">
                          {item.condition}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.location && (
                        <span className="flex h-4.5 items-center rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                          {item.location}
                        </span>
                      )}
                      {item.rating && (
                        <span className="text-[10px] px-1.5 h-4.5 flex items-center rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-500/20">
                          ★ {item.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mb-4 flex items-center justify-between rounded-lg border border-border/70 bg-muted/45 p-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Price</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">€{item.price || "0.00"}</span>
                    {hasDifferentTotalPrice && (
                      <span className="block text-[10px] text-muted-foreground">
                        Incl. fees: €{item.total_price}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Send a message to the seller of &quot;{item.title || "this item"}&quot;
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="Write your message..."
            maxLength={2000}
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
          <DialogFooter>
            <Button
              onClick={handleSendMessage}
              disabled={sending || !msgText.trim()}
              className="gap-1.5"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Vinted Checkout</DialogTitle>
            <DialogDescription>
              This opens the normal Vinted checkout in your logged-in browser. Choose the payment
              method there and finish the order on Vinted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runBuy} disabled={buying} className="gap-2">
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {buying ? "Starting..." : "Open Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <div className="flex gap-5 mb-3">
                  {item.image_url ? (
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted shadow-sm">
                      <img 
                        src={item.image_url} 
                        alt={item.title || "Item preview"} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted">
                      <ImageOff className="w-8 h-8 text-muted-foreground/45" />
                    </div>
                  )}
                  <div className="flex flex-col justify-center gap-1.5 min-w-0 overflow-hidden">
                    <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                      {item.title || "this item"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.brand && (
                        <span className="flex h-4.5 items-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                          {item.brand}
                        </span>
                      )}
                      {item.size && (
                        <span className="flex h-4.5 items-center rounded border border-blue-500/20 bg-blue-500/10 px-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          {item.size}
                        </span>
                      )}
                      {item.condition && (
                        <span className="flex h-4.5 items-center rounded border border-border/70 bg-muted px-1.5 text-[10px] text-muted-foreground">
                          {item.condition}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.location && (
                        <span className="flex h-4.5 items-center rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                          {item.location}
                        </span>
                      )}
                      {item.rating && (
                        <span className="flex h-4.5 items-center rounded border border-amber-200/70 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-600 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-400">
                          ★ {item.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/45 p-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Original Price</span>
                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">€{item.price || "0.00"}</span>
                    {hasDifferentTotalPrice && (
                      <span className="block text-[10px] text-muted-foreground">
                        Incl. fees: €{item.total_price}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder={`e.g. ${(parseFloat(item.price || "0") * 0.9).toFixed(2)}`}
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
          </div>
          <div className="flex gap-2 w-full pt-1">
            {[5, 10, 15].map((discount) => {
              const currentPrice = parseFloat(item.price || "0");
              if (isNaN(currentPrice) || currentPrice <= 0) return null;
              const discountedPrice = (currentPrice * (1 - discount / 100)).toFixed(2);
              
              return (
                <Button
                  key={discount}
                  variant="outline"
                  size="sm"
                  onClick={() => setOfferPrice(discountedPrice)}
                  className="flex-1 text-xs"
                >
                  -{discount}% (€{discountedPrice})
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSendOffer}
              disabled={sendingOffer || !offerPrice.trim()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {sendingOffer ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Tag className="w-4 h-4" />
              )}
              {sendingOffer ? "Sending..." : "Send Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedImgIndex !== null} onOpenChange={(open) => !open && setSelectedImgIndex(null)}>
        <DialogContent showCloseButton={false} className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center outline-none">
          <button 
            onClick={() => setSelectedImgIndex(null)}
            className="fixed top-6 right-6 z-60 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-black/40 transition-all hover:scale-110 active:scale-95 shadow-2xl group cursor-pointer"
          >
            <XIcon className="w-6 h-6 transition-transform group-hover:rotate-90" />
          </button>
          
          {selectedImgIndex !== null && allImages.length > 1 && (
            <>
              <button 
                onClick={handlePrevImage}
                className="fixed left-6 top-1/2 -translate-y-1/2 z-60 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-black/40 transition-all hover:scale-110 active:scale-95 shadow-2xl cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 pr-0.5" />
              </button>
              <button 
                onClick={handleNextImage}
                className="fixed right-6 top-1/2 -translate-y-1/2 z-60 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-black/40 transition-all hover:scale-110 active:scale-95 shadow-2xl cursor-pointer"
              >
                <ChevronRight className="w-6 h-6 pl-0.5" />
              </button>
            </>
          )}

          {selectedImgIndex !== null && (
            <img
              src={allImages[selectedImgIndex]}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const ItemCard = memo(
  ItemCardComponent,
  (prevProps, nextProps) =>
    prevProps.showMonitor === nextProps.showMonitor &&
    prevProps.item === nextProps.item
);

ItemCard.displayName = "ItemCard";

export function ItemCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/75 bg-card/85">
      <div className="aspect-4/5 animate-pulse bg-muted" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-10 animate-pulse bg-muted-foreground/15" />
    </div>
  );
}
