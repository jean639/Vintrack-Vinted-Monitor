"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, ExternalLink, Github, Loader2, Menu, Star } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useVintedAccount } from "@/components/account-provider";
import { cn } from "@/lib/utils";

type NotificationEntry = {
  id: string;
  body?: string;
  is_read?: boolean;
  url?: string;
  small_photo_url?: string;
  updated_at?: string;
};

function formatNotificationTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function NotificationBell() {
  const { linked, loading } = useVintedAccount();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((entry) => entry.is_read === false).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!linked) {
      setNotifications([]);
      setHasLoaded(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications?page=1&per_page=5", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to load notifications (${res.status})`);
      }

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setHasLoaded(true);
    } catch (error) {
      console.error(error);
      setNotifications([]);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [linked]);

  useEffect(() => {
    if (!loading && linked) {
      void fetchNotifications();
    }
  }, [fetchNotifications, linked, loading]);

  useEffect(() => {
    if (loading || !linked) {
      setOpen(false);
      setNotifications([]);
      setHasLoaded(false);
    }
  }, [linked, loading]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (loading || !linked) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen && !hasLoaded) {
            void fetchNotifications();
          }
        }}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-foreground transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground"
        aria-label="Open Vinted notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-5 text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-88 overflow-hidden rounded-2xl border border-border/70 bg-background/96 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Vinted Notifications</p>
              <p className="text-xs text-muted-foreground">Your 5 most recent Notifications</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchNotifications()}
              disabled={isLoading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
              aria-label="Refresh notifications"
            >
              <Loader2 className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          </div>

          <div className="max-h-104 overflow-y-auto p-2">
            {isLoading && notifications.length === 0 ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-18 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <a
                  key={notification.id}
                  href={notification.url || undefined}
                  target={notification.url ? "_blank" : undefined}
                  rel={notification.url ? "noopener noreferrer" : undefined}
                  className={cn(
                    "flex gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent/70",
                    notification.is_read === false && "bg-accent/35"
                  )}
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {notification.small_photo_url ? (
                      <img
                        src={notification.small_photo_url}
                        alt="Notification"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Bell className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="max-h-15 overflow-hidden text-sm leading-5 text-foreground">
                        {notification.body || "Neue Vinted-Benachrichtigung"}
                      </p>
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {notification.is_read === false && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatNotificationTime(notification.updated_at)}
                      </span>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">No Notifications found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  As soon as you get a Notification it will be displayed here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  const getBreadcrumbs = (): { label: string; isCurrent: boolean }[] => {
    if (pathname === "/dashboard")
      return [{ label: "Monitors", isCurrent: true }];
    if (pathname === "/feed")
      return [{ label: "Live Feed", isCurrent: true }];
    if (pathname === "/monitors/new")
      return [
        { label: "Monitors", isCurrent: false },
        { label: "Create", isCurrent: true },
      ];
    if (pathname.includes("/monitors/"))
      return [
        { label: "Monitors", isCurrent: false },
        { label: "Details", isCurrent: true },
      ];
    return [{ label: "Vintrack", isCurrent: true }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border/70 bg-background/72 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <nav className="hidden sm:flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
              <span
                className={
                  crumb.isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <NotificationBell />
        <ThemeToggle compact className="hidden sm:inline-flex" />
        <a
          href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1.5 rounded-md border border-border/80 bg-card/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 sm:flex"
        >
          <Github className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Star us on GitHub</span>
          <Star className="w-3.5 h-3.5" />
        </a>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden xs:inline">Connected</span>
        </div>
      </div>
    </header>
  );
}
