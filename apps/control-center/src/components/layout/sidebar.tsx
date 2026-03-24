"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, PlusCircle, Radio, LogOut, Globe, Shield, User, Star, BookOpen, X, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const ACCOUNT_SEEN_KEY = "vintrack:account-tab-seen";

const navItems = [
  { href: "/dashboard", label: "Monitors", icon: LayoutDashboard },
  { href: "/feed", label: "Live Feed", icon: Radio },
  { href: "/proxies", label: "Proxy Groups", icon: Globe },
  { href: "/account", label: "Account", icon: User },
  { href: "/liked", label: "Liked Items", icon: Heart },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

const adminNavItems = [
  { href: "/admin", label: "User Management", icon: Shield },
];

interface SidebarProps {
  user?: { name?: string | null; image?: string | null; email?: string | null; role?: string };
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [showAccountBadge, setShowAccountBadge] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return !localStorage.getItem(ACCOUNT_SEEN_KEY);
  });

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 z-50 flex h-full w-60 flex-col border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>

      <div className="flex h-14 items-center justify-between border-b border-sidebar-border/80 px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <span className="text-xs font-bold">V</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight">
              Vintrack
            </span>
          </div>
        </Link>
        <button 
          onClick={onClose}
          className="p-1 text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
          Navigation
        </p>

        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.href === "/account" && showAccountBadge) {
                  localStorage.setItem(ACCOUNT_SEEN_KEY, "1");
                  setShowAccountBadge(false);
                }
                onClose?.();
              }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/45"
                )}
              />
              {item.label}
              {item.href === "/account" && showAccountBadge && (
                <span className="ml-auto text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  New
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/monitors/new"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-sidebar-border/80 px-3 py-2 text-[13px] font-medium text-sidebar-foreground/68 transition-colors hover:border-sidebar-foreground/20 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PlusCircle className="w-4 h-4 text-sidebar-foreground/45" />
            New Monitor
          </Link>
        </div>

        <div className="pt-4">
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
            Community
          </p>
          <a
            href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-amber-500 transition-colors hover:bg-amber-500/12 hover:text-amber-400"
          >
            <Star className="w-4 h-4" />
            Star on GitHub
          </a>
        </div>

        {user?.role === "admin" && (
          <div className="pt-4">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
              Admin
            </p>
            {adminNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4",
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/45"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border/80 p-3">
        <ThemeToggle className="mb-3" />
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {user?.image ? (
            <img
              src={user.image}
              alt=""
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-bold text-sidebar-accent-foreground">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                {user?.name || "User"}
              </p>
              {user?.role === "premium" && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                  Pro
                </span>
              )}
              {user?.role === "admin" && (
                <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
                  Admin
                </span>
              )}
            </div>
          </div>
          <Link
            href="/logout"
            className="p-1 text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="mt-2 px-2 flex justify-center">
          <p className="text-[10px] font-medium text-sidebar-foreground/40">
            Vintrack v{process.env.NEXT_PUBLIC_APP_VERSION}
          </p>
        </div>
      </div>
    </aside>
  );
}
