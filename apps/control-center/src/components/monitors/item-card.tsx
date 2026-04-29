"use client";

import { memo, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
    ExternalLink,
    ImageOff,
    Heart,
    MessageCircle,
    Send,
    Loader2,
    XIcon,
    ChevronLeft,
    ChevronRight,
    Tag,
    ShoppingCart,
} from "lucide-react";
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
    return name
        ? `${name} (${item.monitor_id})`
        : `Monitor #${item.monitor_id}`;
}

function ItemCardComponent({ item, showMonitor = false }: ItemCardProps) {
    const {
        linked,
        domain: accountDomain,
        likedIds,
        addLike,
        removeLike,
    } = useVintedAccount();
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
    const [selectedImgIndex, setSelectedImgIndex] = useState<number | null>(
        null,
    );

    const allImages = item.image_url
        ? [item.image_url, ...(item.extra_images || [])]
        : [];
    const hasDifferentTotalPrice =
        Boolean(item.total_price) && item.total_price !== item.price;

    const handleNextImage = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedImgIndex((prev) =>
            prev === null ? prev : (prev + 1) % allImages.length,
        );
    };

    const handlePrevImage = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedImgIndex((prev) =>
            prev === null
                ? prev
                : (prev - 1 + allImages.length) % allImages.length,
        );
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImgIndex !== null) {
                if (e.key === "ArrowRight") {
                    setSelectedImgIndex((prev) =>
                        prev === null ? prev : (prev + 1) % allImages.length,
                    );
                }
                if (e.key === "ArrowLeft") {
                    setSelectedImgIndex((prev) =>
                        prev === null
                            ? prev
                            : (prev - 1 + allImages.length) % allImages.length,
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
                toast.error(
                    `Offer too low. Minimum allowed is €${minPrice.toFixed(2)}`,
                );
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
                domain:
                    accountDomain ||
                    (item.url ? new URL(item.url).hostname : undefined),
                pickupType: 1,
            });

            if (browserBuyResult) {
                if (browserBuyResult.ok) {
                    if (!browserBuyResult.checkoutUrl) {
                        toast.error(
                            "Browser checkout returned no Vinted checkout URL",
                        );
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

                    toast.success(
                        "Vinted checkout opened. Choose the payment method there.",
                    );
                    setBuyDialogOpen(false);
                    return;
                }

                if (browserBuyResult.code === "datadome_challenge") {
                    toast.error(
                        "Vinted requested a captcha in the browser tab. Solve it there, then retry checkout.",
                    );
                    return;
                }

                toast.error(
                    browserBuyResult.error || "Browser checkout failed",
                );
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
            className={`group border-border/75 bg-card/92 hover:border-border relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.28)] ${
                item.isLive
                    ? "animate-in slide-in-from-top-2 fade-in shadow-md ring-2 shadow-emerald-500/10 ring-emerald-500/30 duration-500"
                    : ""
            }`}
        >
            <div className="bg-muted relative aspect-4/5 overflow-hidden">
                {item.image_url ? (
                    item.extra_images && item.extra_images.length > 0 ? (
                        <div className="flex h-full w-full gap-0.5">
                            <div
                                className="h-full flex-2 cursor-pointer overflow-hidden"
                                onClick={() => setSelectedImgIndex(0)}
                            >
                                <img
                                    src={item.image_url}
                                    alt={item.title || "Item"}
                                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                            <div className="flex h-full flex-1 flex-col gap-0.5">
                                {item.extra_images
                                    .slice(0, 2)
                                    .map((img, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-muted-foreground/10 flex-1 cursor-pointer overflow-hidden"
                                            onClick={() =>
                                                setSelectedImgIndex(idx + 1)
                                            }
                                        >
                                            <img
                                                src={img}
                                                alt={`${item.title} ${idx + 1}`}
                                                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                                loading="lazy"
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="h-full w-full cursor-pointer"
                            onClick={() => setSelectedImgIndex(0)}
                        >
                            <img
                                src={item.image_url}
                                alt={item.title || "Item"}
                                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                loading="lazy"
                            />
                        </div>
                    )
                ) : (
                    <div className="text-muted-foreground/45 flex h-full w-full items-center justify-center">
                        <ImageOff className="h-8 w-8" />
                    </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-slate-950/82 via-slate-950/34 to-transparent" />

                <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
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
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/50 opacity-75 dark:bg-emerald-400/50" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        </span>
                        NEW
                    </div>
                )}

                <div className="absolute top-2.5 right-2.5 z-10 flex gap-1 opacity-0 transition-opacity max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 md:group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                    {linked && (
                        <button
                            onClick={handleLike}
                            disabled={liking}
                            className={cn(
                                "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors sm:h-7 sm:w-7",
                                liked
                                    ? "border-red-400/30 bg-red-500 text-white"
                                    : "hover:bg-slate-950/80 hover:text-red-300",
                            )}
                            title={liked ? "Unlike" : "Like"}
                        >
                            <Heart
                                className={cn(
                                    "h-4 w-4 sm:h-3.5 sm:w-3.5",
                                    liked && "fill-current",
                                )}
                            />
                        </button>
                    )}
                    {linked && item.seller_id && (
                        <>
                            <button
                                onClick={handleBuy}
                                disabled={buying}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-amber-400/25 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-70 sm:h-7 sm:w-7"
                                title="Open Vinted checkout"
                            >
                                {buying ? (
                                    <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" />
                                ) : (
                                    <ShoppingCart className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOfferOpen(true);
                                }}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-emerald-300 sm:h-7 sm:w-7"
                                title="Make an offer"
                            >
                                <Tag className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setMsgOpen(true);
                                }}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-slate-950/62 text-white shadow-md backdrop-blur-md transition-colors hover:bg-slate-950/80 hover:text-sky-300 sm:h-7 sm:w-7"
                                title="Send message to seller"
                            >
                                <MessageCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3.5">
                <h3
                    className="text-foreground line-clamp-2 min-h-11 text-[13px] leading-snug font-semibold"
                    title={item.title || ""}
                >
                    {item.title || "Untitled"}
                </h3>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {item.brand && (
                        <span className="border-border/60 bg-muted/40 text-muted-foreground flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium">
                            {item.brand}
                        </span>
                    )}
                    {item.size && (
                        <Badge
                            variant="secondary"
                            className="h-5 rounded-md border border-blue-200 bg-blue-50 px-1.5 text-[10px] font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                        >
                            {item.size}
                        </Badge>
                    )}
                    {item.location && (
                        <span className="border-border/60 bg-muted/40 text-muted-foreground flex h-5 items-center rounded-md border px-1.5 text-[10px]">
                            {item.location}
                        </span>
                    )}
                    {item.rating && (
                        <span className="flex h-5 items-center rounded-md border border-amber-200/70 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-300">
                            {item.rating}
                        </span>
                    )}
                    {item.condition && (
                        <span className="border-border/60 bg-muted/40 text-muted-foreground flex h-5 items-center rounded-md border px-1.5 text-[10px]">
                            {item.condition}
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                    {showMonitor ? (
                        <Link
                            href={`/monitors/${item.monitor_id}`}
                            className="z-10 max-w-[calc(100%-4.5rem)] min-w-0"
                        >
                            <span className="text-muted-foreground inline-flex max-w-full truncate text-[11px] font-medium transition-colors duration-200 hover:text-blue-400">
                                {getMonitorLabel(item)}
                            </span>
                        </Link>
                    ) : (
                        <span />
                    )}

                    <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-[0.16em] uppercase">
                        {timeStr}
                    </span>
                </div>
            </div>

            <a
                href={item.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium tracking-wide transition-colors"
            >
                View on Vinted
                <ExternalLink className="h-3 w-3" />
            </a>

            <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send Message</DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-muted-foreground text-sm">
                                <div className="mb-4 flex gap-5">
                                    {item.image_url ? (
                                        <div className="border-border/80 bg-muted relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border shadow-sm">
                                            <img
                                                src={item.image_url}
                                                alt={
                                                    item.title || "Item preview"
                                                }
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="border-border/80 bg-muted flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border">
                                            <ImageOff className="text-muted-foreground/45 h-8 w-8" />
                                        </div>
                                    )}
                                    <div className="flex min-w-0 flex-col justify-center gap-1.5 overflow-hidden">
                                        <p className="text-foreground line-clamp-2 leading-snug font-semibold">
                                            {item.title || "this item"}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {item.brand && (
                                                <span className="bg-muted text-muted-foreground flex h-4.5 items-center rounded px-1.5 text-[10px] font-medium">
                                                    {item.brand}
                                                </span>
                                            )}
                                            {item.size && (
                                                <span className="flex h-4.5 items-center rounded border border-blue-100/50 bg-blue-50 px-1.5 text-[10px] font-medium text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                                                    {item.size}
                                                </span>
                                            )}
                                            {item.condition && (
                                                <span className="border-border/70 bg-muted text-muted-foreground flex h-4.5 items-center rounded border px-1.5 text-[10px]">
                                                    {item.condition}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {item.location && (
                                                <span className="bg-muted text-muted-foreground flex h-4.5 items-center rounded px-1.5 text-[10px]">
                                                    {item.location}
                                                </span>
                                            )}
                                            {item.rating && (
                                                <span className="flex h-4.5 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                                    ★ {item.rating}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="border-border/70 bg-muted/45 mb-4 flex items-center justify-between rounded-lg border p-2.5">
                                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                        Price
                                    </span>
                                    <div className="text-right">
                                        <span className="text-foreground text-base font-bold">
                                            €{item.price || "0.00"}
                                        </span>
                                        {hasDifferentTotalPrice && (
                                            <span className="text-muted-foreground block text-[10px]">
                                                Incl. fees: €{item.total_price}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-muted-foreground">
                                    Send a message to the seller of &quot;
                                    {item.title || "this item"}&quot;
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
                        className="border-border bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-1 focus:outline-none"
                    />
                    <DialogFooter>
                        <Button
                            onClick={handleSendMessage}
                            disabled={sending || !msgText.trim()}
                            className="gap-1.5"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
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
                            This opens the normal Vinted checkout in your
                            logged-in browser. Choose the payment method there
                            and finish the order on Vinted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBuyDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={runBuy}
                            disabled={buying}
                            className="gap-2"
                        >
                            {buying ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ShoppingCart className="h-4 w-4" />
                            )}
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
                            <div className="text-muted-foreground text-sm">
                                <div className="mb-3 flex gap-5">
                                    {item.image_url ? (
                                        <div className="border-border/80 bg-muted relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border shadow-sm">
                                            <img
                                                src={item.image_url}
                                                alt={
                                                    item.title || "Item preview"
                                                }
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="border-border/80 bg-muted flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border">
                                            <ImageOff className="text-muted-foreground/45 h-8 w-8" />
                                        </div>
                                    )}
                                    <div className="flex min-w-0 flex-col justify-center gap-1.5 overflow-hidden">
                                        <p className="text-foreground line-clamp-2 leading-snug font-semibold">
                                            {item.title || "this item"}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {item.brand && (
                                                <span className="bg-muted text-muted-foreground flex h-4.5 items-center rounded px-1.5 text-[10px] font-medium">
                                                    {item.brand}
                                                </span>
                                            )}
                                            {item.size && (
                                                <span className="flex h-4.5 items-center rounded border border-blue-500/20 bg-blue-500/10 px-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                                    {item.size}
                                                </span>
                                            )}
                                            {item.condition && (
                                                <span className="border-border/70 bg-muted text-muted-foreground flex h-4.5 items-center rounded border px-1.5 text-[10px]">
                                                    {item.condition}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {item.location && (
                                                <span className="bg-muted text-muted-foreground flex h-4.5 items-center rounded px-1.5 text-[10px]">
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

                                <div className="border-border/70 bg-muted/45 flex items-center justify-between rounded-lg border p-2.5">
                                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                        Original Price
                                    </span>
                                    <div className="text-right">
                                        <span className="text-foreground text-base font-bold">
                                            €{item.price || "0.00"}
                                        </span>
                                        {hasDifferentTotalPrice && (
                                            <span className="text-muted-foreground block text-[10px]">
                                                Incl. fees: €{item.total_price}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                            €
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            min="1"
                            value={offerPrice}
                            onChange={(e) => setOfferPrice(e.target.value)}
                            placeholder={`e.g. ${(parseFloat(item.price || "0") * 0.9).toFixed(2)}`}
                            className="border-border bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pr-3 pl-8 text-sm focus:ring-2 focus:ring-offset-1 focus:outline-none"
                        />
                    </div>
                    <div className="flex w-full gap-2 pt-1">
                        {[5, 10, 15].map((discount) => {
                            const currentPrice = parseFloat(item.price || "0");
                            if (isNaN(currentPrice) || currentPrice <= 0)
                                return null;
                            const discountedPrice = (
                                currentPrice *
                                (1 - discount / 100)
                            ).toFixed(2);

                            return (
                                <Button
                                    key={discount}
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setOfferPrice(discountedPrice)
                                    }
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
                            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            {sendingOffer ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Tag className="h-4 w-4" />
                            )}
                            {sendingOffer ? "Sending..." : "Send Offer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={selectedImgIndex !== null}
                onOpenChange={(open) => !open && setSelectedImgIndex(null)}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex max-h-[90vh] max-w-[90vw] items-center justify-center border-none bg-transparent p-0 shadow-none outline-none"
                >
                    <button
                        onClick={() => setSelectedImgIndex(null)}
                        className="group fixed top-6 right-6 z-60 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20 text-white shadow-2xl backdrop-blur-xl transition-all hover:scale-110 hover:bg-black/40 active:scale-95"
                    >
                        <XIcon className="h-6 w-6 transition-transform group-hover:rotate-90" />
                    </button>

                    {selectedImgIndex !== null && allImages.length > 1 && (
                        <>
                            <button
                                onClick={handlePrevImage}
                                className="fixed top-1/2 left-6 z-60 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20 text-white shadow-2xl backdrop-blur-xl transition-all hover:scale-110 hover:bg-black/40 active:scale-95"
                            >
                                <ChevronLeft className="h-6 w-6 pr-0.5" />
                            </button>
                            <button
                                onClick={handleNextImage}
                                className="fixed top-1/2 right-6 z-60 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/20 text-white shadow-2xl backdrop-blur-xl transition-all hover:scale-110 hover:bg-black/40 active:scale-95"
                            >
                                <ChevronRight className="h-6 w-6 pl-0.5" />
                            </button>
                        </>
                    )}

                    {selectedImgIndex !== null && (
                        <img
                            src={allImages[selectedImgIndex]}
                            alt="Preview"
                            className="animate-in zoom-in-95 max-h-[90vh] max-w-full rounded-xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] duration-300"
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
        prevProps.item === nextProps.item,
);

ItemCard.displayName = "ItemCard";

export function ItemCardSkeleton() {
    return (
        <div className="border-border/75 bg-card/85 flex flex-col overflow-hidden rounded-xl border">
            <div className="bg-muted aspect-4/5 animate-pulse" />
            <div className="space-y-2.5 p-3.5">
                <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
                <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
                <div className="flex gap-1.5 pt-1">
                    <div className="bg-muted h-5 w-10 animate-pulse rounded" />
                    <div className="bg-muted h-5 w-14 animate-pulse rounded" />
                </div>
            </div>
            <div className="bg-muted-foreground/15 h-10 animate-pulse" />
        </div>
    );
}
