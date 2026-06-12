"use client";

import { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    PauseCircle,
    PlayCircle,
    Plus,
    StopCircle,
    Webhook,
    MessageCircle,
    CheckCircle2,
    Copy,
    ExternalLink,
    Radio,
    Package,
    ArrowRight,
    Globe,
    Zap,
    AlertTriangle,
    Pencil,
    Send,
    Timer,
    Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    startAllMonitors,
    stopAllMonitors,
    toggleMonitor,
    updateMonitorWebhook,
    toggleWebhookStatus,
    toggleTelegramStatus,
} from "@/actions/dashboard-actions";
import { testDiscordWebhook } from "@/actions/monitor";
import { updateMonitorAlertDedupe } from "@/actions/account";
import { getBrandLabels } from "@/lib/brands";
import { getColorLabels } from "@/lib/colors";
import { getSizeLabels } from "@/lib/sizes";
import {
    getRegionLabel,
    getRegionFlags,
    getStatusLocaleForRegionCodes,
} from "@/lib/regions";
import { getStatusLabels } from "@/lib/statuses";
import { formatQueryDelay } from "@/lib/monitor-delay";

type MonitorHealth = {
    monitor_id: number;
    total_checks: number;
    total_errors: number;
    consecutive_errors: number;
    last_error?: string;
    updated_at: string;
};

export type Monitor = {
    id: number;
    name: string;
    query: string;
    query_delay_ms: number;
    status: string;
    price_max: number | null;
    catalog_ids: string | null;
    category_labels: string[];
    brand_ids: string | null;
    color_ids: string | null;
    status_ids: string | null;
    size_id: string | null;
    region: string;
    allowed_countries: string | null;
    discord_webhook: string | null;
    webhook_active: boolean;
    telegram_active: boolean;
    proxy_group_name: string | null;
    _count: { items: number };
    created_at: string;
};

type TelegramConnectionState = {
    connected: boolean;
    botUsername: string | null;
    connection: {
        chat_type: string | null;
        chat_title: string | null;
        username: string | null;
        updated_at: string;
    } | null;
};

type TelegramConnectCode = {
    code: string;
    expiresAt: string;
    botUsername: string | null;
    botLink: string | null;
};

async function readApiError(res: Response, fallback: string) {
    try {
        const data = await res.json();
        return data.error || fallback;
    } catch {
        return `${fallback} (${res.status})`;
    }
}

function hasProxyWarning(h?: MonitorHealth): boolean {
    if (!h) return false;
    if (h.consecutive_errors === -1 || h.consecutive_errors >= 3) return true;
    return false;
}

export function DashboardClient({
    initialMonitors,
    userName,
    initialDedupeMonitorAlerts,
}: {
    initialMonitors: Monitor[];
    userName: string;
    initialDedupeMonitorAlerts: boolean;
}) {
    const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(
        null,
    );
    const [webhookInput, setWebhookInput] = useState("");
    const [isWebhookOpen, setIsWebhookOpen] = useState(false);
    const [isWebhookActive, setIsWebhookActive] = useState(true);
    const [isTelegramActive, setIsTelegramActive] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [isTestingTelegram, setIsTestingTelegram] = useState(false);
    const [isCreatingTelegramCode, setIsCreatingTelegramCode] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [telegramConnection, setTelegramConnection] =
        useState<TelegramConnectionState | null>(null);
    const [telegramConnectCode, setTelegramConnectCode] =
        useState<TelegramConnectCode | null>(null);
    const [monitors, setMonitors] = useState<Monitor[]>(initialMonitors);
    const [dedupeMonitorAlerts, setDedupeMonitorAlerts] = useState(
        initialDedupeMonitorAlerts,
    );
    const [healthMap, setHealthMap] = useState<Record<number, MonitorHealth>>(
        {},
    );
    const [isDedupePending, startDedupeTransition] = useTransition();

    const handleTestWebhook = async () => {
        if (!webhookInput) {
            toast.error("Please enter a webhook URL first");
            return;
        }
        setIsTestingWebhook(true);
        const result = await testDiscordWebhook(webhookInput);
        setIsTestingWebhook(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Test webhook sent successfully!");
        }
    };

    const fetchTelegramConnection = useCallback(async () => {
        try {
            const res = await fetch("/api/telegram/connection", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as TelegramConnectionState;
            setTelegramConnection(data);
            if (data.connected) {
                setTelegramConnectCode(null);
            }
        } catch {
            setTelegramConnection(null);
        }
    }, []);

    const handleCreateTelegramCode = async () => {
        setIsCreatingTelegramCode(true);
        try {
            const res = await fetch("/api/telegram/connect-code", {
                method: "POST",
            });
            if (!res.ok) {
                toast.error(
                    await readApiError(
                        res,
                        "Failed to create Telegram connect code",
                    ),
                );
                return;
            }
            const data = await res.json();
            setTelegramConnectCode(data);
            toast.success("Telegram connect code created");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create Telegram connect code",
            );
        } finally {
            setIsCreatingTelegramCode(false);
        }
    };

    const handleCopyTelegramCode = async () => {
        if (!telegramConnectCode) return;
        try {
            await navigator.clipboard.writeText(
                `/connect ${telegramConnectCode.code}`,
            );
            toast.success("Telegram command copied");
        } catch {
            toast.error("Failed to copy Telegram command");
        }
    };

    const handleTestTelegram = async () => {
        setIsTestingTelegram(true);
        try {
            const res = await fetch("/api/telegram/test", { method: "POST" });
            if (!res.ok) {
                toast.error(
                    await readApiError(res, "Failed to send Telegram test"),
                );
                return;
            }
            toast.success("Test Telegram message sent successfully!");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to send Telegram test",
            );
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/monitors/health");
            if (res.ok) {
                const data = await res.json();
                setHealthMap(data);
            }
        } catch {}
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(fetchHealth, 0);
        const interval = setInterval(fetchHealth, 10_000);
        return () => {
            window.clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [fetchHealth]);

    useEffect(() => {
        if (!isWebhookOpen) return;
        fetchTelegramConnection();
    }, [fetchTelegramConnection, isWebhookOpen]);

    useEffect(() => {
        if (
            !isWebhookOpen ||
            !telegramConnectCode ||
            telegramConnection?.connected
        ) {
            return;
        }

        const interval = setInterval(fetchTelegramConnection, 2_000);
        return () => clearInterval(interval);
    }, [
        fetchTelegramConnection,
        isWebhookOpen,
        telegramConnectCode,
        telegramConnection?.connected,
    ]);

    const openWebhookDialog = (monitor: Monitor) => {
        setSelectedMonitor(monitor);
        setWebhookInput(monitor.discord_webhook || "");
        setIsWebhookActive(monitor.webhook_active);
        setIsTelegramActive(monitor.telegram_active);
        setTelegramConnectCode(null);
        setIsWebhookOpen(true);
    };

    const sortedMonitors = useMemo(() => {
        return [...monitors].sort((a, b) => {
            if (a.status === "active" && b.status !== "active") return -1;
            if (a.status !== "active" && b.status === "active") return 1;
            return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
        });
    }, [monitors]);

    const handleStopAll = async () => {
        setMonitors((prev) => prev.map((m) => ({ ...m, status: "paused" })));
        toast.promise(stopAllMonitors(), {
            loading: "Stopping all monitors...",
            success: "All monitors stopped",
            error: "Failed to stop monitors",
        });
    };

    const handleStartAll = async () => {
        toast.promise(startAllMonitors(), {
            loading: "Starting monitors...",
            success: (result) => {
                const startedIds = new Set(result.startedMonitorIds);
                setMonitors((prev) =>
                    prev.map((m) =>
                        startedIds.has(m.id) ? { ...m, status: "active" } : m,
                    ),
                );
                return result.message;
            },
            error: (error) =>
                error instanceof Error
                    ? error.message
                    : "Failed to start monitors",
        });
    };

    const handleToggle = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "paused" : "active";
        const actionText = newStatus === "active" ? "Resumed" : "Paused";

        setMonitors((prev) =>
            prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)),
        );

        toast.promise(toggleMonitor(id, currentStatus), {
            loading: "Updating...",
            success: `Monitor ${actionText}`,
            error: (error) => {
                setMonitors((prev) =>
                    prev.map((m) =>
                        m.id === id ? { ...m, status: currentStatus } : m,
                    ),
                );
                return error instanceof Error
                    ? error.message
                    : "Failed to update monitor";
            },
        });
    };

    const handleDedupeChange = (checked: boolean) => {
        setDedupeMonitorAlerts(checked);
        startDedupeTransition(async () => {
            const result = await updateMonitorAlertDedupe(checked);
            if ("error" in result) {
                setDedupeMonitorAlerts(!checked);
                toast.error(result.error);
                return;
            }
            toast.success(
                checked
                    ? "Duplicate item alerts are collapsed"
                    : "Monitor alerts are independent again",
            );
        });
    };

    const handleSaveWebhook = async () => {
        if (!selectedMonitor) return;
        setMonitors((prev) =>
            prev.map((m) =>
                m.id === selectedMonitor.id
                    ? {
                          ...m,
                          discord_webhook: webhookInput || null,
                          webhook_active: webhookInput ? true : false,
                      }
                    : m,
            ),
        );
        toast.promise(updateMonitorWebhook(selectedMonitor.id, webhookInput), {
            loading: "Saving...",
            success: () => {
                setIsWebhookOpen(false);
                return "Discord webhook saved";
            },
            error: "Failed to save Discord webhook",
        });
    };

    const activeCount = monitors.filter((m) => m.status === "active").length;
    const pausedCount = monitors.filter((m) => m.status === "paused").length;
    const totalItems = monitors.reduce((sum, m) => sum + m._count.items, 0);

    return (
        <div className="space-y-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Welcome back, {userName}
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        Manage and monitor your Vinted scrapers.
                    </p>
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                    {pausedCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStartAll}
                            className="flex-1 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 sm:flex-none dark:border-emerald-500/20 dark:bg-transparent dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                        >
                            <PlayCircle className="h-3.5 w-3.5" /> Start All
                        </Button>
                    )}
                    {activeCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStopAll}
                            className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:flex-none dark:border-red-500/20 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                            <StopCircle className="h-3.5 w-3.5" /> Stop All
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setIsSettingsOpen(true)}
                        title="Dashboard settings"
                        aria-label="Dashboard settings"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Link href="/monitors/new" className="flex-1 sm:flex-none">
                        <Button size="sm" className="w-full gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> New Monitor
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="border-border/75 bg-card/80 rounded-xl border px-5 py-4 shadow-sm backdrop-blur">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                        Total Monitors
                    </p>
                    <p className="text-foreground mt-1 text-2xl font-bold">
                        {monitors.length}
                    </p>
                </div>
                <div className="border-border/75 bg-card/80 rounded-xl border px-5 py-4 shadow-sm backdrop-blur">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                        Active
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                        <p className="text-foreground text-2xl font-bold">
                            {activeCount}
                        </p>
                        {activeCount > 0 && (
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                        )}
                    </div>
                </div>
                <div className="border-border/75 bg-card/80 rounded-xl border px-5 py-4 shadow-sm backdrop-blur">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                        Items Found
                    </p>
                    <p className="text-foreground mt-1 text-2xl font-bold">
                        {totalItems.toLocaleString()}
                    </p>
                </div>
            </div>

            {monitors.length === 0 ? (
                <div className="border-border/80 bg-card/75 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 shadow-sm backdrop-blur">
                    <div className="bg-muted mb-4 rounded-xl p-3">
                        <Radio className="text-muted-foreground h-6 w-6" />
                    </div>
                    <h3 className="text-foreground text-base font-semibold">
                        No monitors yet
                    </h3>
                    <p className="text-muted-foreground mt-1 mb-4 text-sm">
                        Create your first monitor to start finding deals.
                    </p>
                    <Link href="/monitors/new">
                        <Button size="sm" className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Create Monitor
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sortedMonitors.map((m) => (
                        <Card
                            key={m.id}
                            className="group border-border/75 bg-card/85 hover:border-border hover:bg-card flex flex-col overflow-hidden transition-colors"
                        >
                            <CardContent className="flex flex-1 flex-col p-5">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3
                                            className="text-foreground truncate text-[15px] font-semibold"
                                            title={m.name}
                                        >
                                            {m.name}
                                        </h3>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant={
                                                    m.status === "active"
                                                        ? "default"
                                                        : "secondary"
                                                }
                                                className={`text-[10px] font-medium ${
                                                    m.status === "active"
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-400 dark:hover:bg-emerald-500/18"
                                                        : m.status === "error"
                                                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/12 dark:text-red-400"
                                                          : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {m.status === "active" ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        Running
                                                    </span>
                                                ) : m.status === "error" ? (
                                                    <span className="flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Proxy Error
                                                    </span>
                                                ) : (
                                                    "Paused"
                                                )}
                                            </Badge>
                                            {m.price_max && (
                                                <span className="text-muted-foreground text-[11px]">
                                                    Max {m.price_max}€
                                                </span>
                                            )}
                                            {m.region && m.region && (
                                                <span className="text-muted-foreground text-[11px]">
                                                    {getRegionLabel(m.region)}
                                                </span>
                                            )}
                                            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                                                <Timer className="h-3 w-3" />
                                                {formatQueryDelay(
                                                    m.query_delay_ms,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <Link
                                            href={`/monitors/${m.id}/edit?from=dashboard`}
                                        >
                                            <button
                                                className="text-muted-foreground/55 hover:bg-accent hover:text-accent-foreground rounded-md p-1.5 transition-colors"
                                                title="Edit monitor"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => openWebhookDialog(m)}
                                            className="text-muted-foreground/55 hover:bg-accent hover:text-accent-foreground rounded-md p-1.5 transition-colors"
                                            title="Configure notifications"
                                        >
                                            <Webhook
                                                className={`h-3.5 w-3.5 ${
                                                    (m.discord_webhook &&
                                                        m.webhook_active) ||
                                                    m.telegram_active
                                                        ? "text-indigo-600 dark:text-indigo-400"
                                                        : ""
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {(m.catalog_ids ||
                                    m.brand_ids ||
                                    m.color_ids ||
                                    m.status_ids ||
                                    m.size_id ||
                                    m.allowed_countries) && (
                                    <div className="mb-3 flex flex-wrap gap-1">
                                        {m.allowed_countries && (
                                            <span
                                                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-400"
                                                title={`Only items from: ${m.allowed_countries}`}
                                            >
                                                {getRegionFlags(
                                                    m.allowed_countries,
                                                ).join(" ")}
                                            </span>
                                        )}
                                        {m.category_labels.map((label) => (
                                            <span
                                                key={`cat-${label}`}
                                                className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/12 dark:text-violet-400"
                                            >
                                                {label}
                                            </span>
                                        ))}
                                        {m.brand_ids &&
                                            getBrandLabels(m.brand_ids).map(
                                                (label) => (
                                                    <span
                                                        key={`brand-${label}`}
                                                        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/12 dark:text-blue-400"
                                                    >
                                                        {label}
                                                    </span>
                                                ),
                                            )}
                                        {m.color_ids &&
                                            getColorLabels(m.color_ids).map(
                                                (label) => (
                                                    <span
                                                        key={`color-${label}`}
                                                        className="inline-flex items-center rounded-md border border-pink-200 bg-pink-50 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:border-pink-500/20 dark:bg-pink-500/12 dark:text-pink-400"
                                                    >
                                                        {label}
                                                    </span>
                                                ),
                                            )}
                                        {m.status_ids &&
                                            getStatusLabels(
                                                m.status_ids,
                                                getStatusLocaleForRegionCodes(
                                                    m.allowed_countries,
                                                    m.region,
                                                ),
                                            ).map((label) => (
                                                <span
                                                    key={`status-${label}`}
                                                    className="inline-flex items-center rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/12 dark:text-cyan-400"
                                                    title={label}
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        {m.size_id &&
                                            getSizeLabels(m.size_id).map(
                                                (label) => (
                                                    <span
                                                        key={`size-${label}`}
                                                        className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-400"
                                                    >
                                                        {label}
                                                    </span>
                                                ),
                                            )}
                                    </div>
                                )}

                                <div className="flex-1" />

                                <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[13px]">
                                    <Package className="text-muted-foreground h-3.5 w-3.5" />
                                    <span className="text-foreground font-medium">
                                        {m._count.items.toLocaleString()}
                                    </span>
                                    items found
                                </div>

                                <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[13px]">
                                    {m.proxy_group_name ? (
                                        <>
                                            <Globe className="text-muted-foreground h-3.5 w-3.5" />
                                            <span
                                                className="text-foreground truncate font-medium"
                                                title={m.proxy_group_name}
                                            >
                                                {m.proxy_group_name}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                            <span className="font-medium text-amber-600 dark:text-amber-400">
                                                Server Proxies
                                            </span>
                                        </>
                                    )}
                                    {m.status === "active" &&
                                        hasProxyWarning(healthMap[m.id]) && (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/12 dark:text-red-400">
                                                <AlertTriangle className="h-3 w-3" />
                                                Proxy Warning
                                            </span>
                                        )}
                                </div>

                                <div className="border-border/70 flex items-center gap-2 border-t pt-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleToggle(m.id, m.status)
                                        }
                                        className={`h-8 px-3 text-xs font-medium ${
                                            m.status === "active"
                                                ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                                                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                                        }`}
                                    >
                                        {m.status === "active" ? (
                                            <>
                                                <PauseCircle className="mr-1 h-3.5 w-3.5" />{" "}
                                                Pause
                                            </>
                                        ) : (
                                            <>
                                                <PlayCircle className="mr-1 h-3.5 w-3.5" />{" "}
                                                Resume
                                            </>
                                        )}
                                    </Button>
                                    <div className="flex-1" />
                                    <Link href={`/monitors/${m.id}`}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-foreground h-8 gap-1 px-3 text-xs font-medium"
                                        >
                                            View{" "}
                                            <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dashboard settings</DialogTitle>
                        <DialogDescription>
                            Adjust global behavior for monitor alerts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="border-border/80 bg-muted/30 flex items-center justify-between gap-4 rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor="dedupe-monitor-alerts"
                                        className="text-sm font-medium"
                                    >
                                        Dedupe monitor alerts
                                    </Label>
                                    <Badge
                                        variant="outline"
                                        className="bg-background text-[10px]"
                                    >
                                        {dedupeMonitorAlerts ? "On" : "Off"}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-[12px]">
                                    Send one Discord or Telegram alert when
                                    multiple monitors find the same item.
                                </p>
                            </div>
                            <Switch
                                id="dedupe-monitor-alerts"
                                aria-label="Toggle duplicate monitor alerts"
                                checked={dedupeMonitorAlerts}
                                disabled={isDedupePending}
                                onCheckedChange={handleDedupeChange}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsSettingsOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isWebhookOpen} onOpenChange={setIsWebhookOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Notifications</DialogTitle>
                        <DialogDescription>
                            Configure notifications for{" "}
                            <strong>
                                {selectedMonitor?.name &&
                                selectedMonitor.name.length > 50
                                    ? selectedMonitor.name.slice(0, 50) + "..."
                                    : selectedMonitor?.name}
                            </strong>
                            .
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="webhook">Discord Webhook URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="webhook"
                                    placeholder="https://discord.com/api/webhooks/..."
                                    value={webhookInput}
                                    onChange={(e) =>
                                        setWebhookInput(e.target.value)
                                    }
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTestWebhook}
                                    disabled={isTestingWebhook || !webhookInput}
                                    className="shrink-0 gap-2"
                                >
                                    <Send className="h-4 w-4" />
                                    {isTestingWebhook ? "Testing..." : "Test"}
                                </Button>
                            </div>
                        </div>

                        {webhookInput.length > 0 && (
                            <div className="border-border/80 bg-muted/45 flex items-center justify-between space-x-2 rounded-lg border p-3">
                                <div className="flex flex-col space-y-0.5">
                                    <Label
                                        htmlFor="active-mode"
                                        className="cursor-pointer text-sm font-medium"
                                    >
                                        Enable Notifications
                                    </Label>
                                    <span className="text-muted-foreground text-[12px]">
                                        Pause notifications without deleting the
                                        URL.
                                    </span>
                                </div>
                                <Switch
                                    id="active-mode"
                                    checked={isWebhookActive}
                                    onCheckedChange={async (checked) => {
                                        setIsWebhookActive(checked);
                                        setMonitors((prev) =>
                                            prev.map((m) =>
                                                selectedMonitor &&
                                                m.id === selectedMonitor.id
                                                    ? {
                                                          ...m,
                                                          webhook_active:
                                                              checked,
                                                      }
                                                    : m,
                                            ),
                                        );
                                        if (selectedMonitor) {
                                            toast.promise(
                                                toggleWebhookStatus(
                                                    selectedMonitor.id,
                                                    !checked,
                                                ),
                                                {
                                                    success: checked
                                                        ? "Webhook activated"
                                                        : "Webhook deactivated",
                                                    error: "Failed to toggle",
                                                },
                                            );
                                        }
                                    }}
                                />
                            </div>
                        )}

                        <div className="border-border/80 bg-muted/25 grid gap-3 rounded-lg border p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm">Telegram</Label>
                                    {telegramConnection?.connected ? (
                                        <p className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            Connected to{" "}
                                            {telegramConnection.connection
                                                ?.chat_title || "Telegram"}
                                        </p>
                                    ) : (
                                        <p className="text-muted-foreground text-[12px]">
                                            Connect your Telegram once, then
                                            enable it per monitor.
                                        </p>
                                    )}
                                </div>
                                {telegramConnection?.connected ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestTelegram}
                                        disabled={isTestingTelegram}
                                        className="shrink-0 gap-2"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        {isTestingTelegram
                                            ? "Testing..."
                                            : "Test"}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCreateTelegramCode}
                                        disabled={isCreatingTelegramCode}
                                        className="shrink-0 gap-2"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        {isCreatingTelegramCode
                                            ? "Creating..."
                                            : "Connect Telegram"}
                                    </Button>
                                )}
                            </div>

                            {!telegramConnection?.connected &&
                                telegramConnectCode && (
                                    <div className="border-border/80 bg-background rounded-md border p-3 text-[12px]">
                                        <p className="text-foreground font-medium">
                                            Send this command to{" "}
                                            {telegramConnectCode.botUsername ? (
                                                <span>
                                                    @
                                                    {
                                                        telegramConnectCode.botUsername
                                                    }
                                                </span>
                                            ) : (
                                                "the Vintrack bot"
                                            )}
                                            :
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <code className="bg-muted text-foreground flex-1 rounded-md px-2 py-1.5">
                                                /connect{" "}
                                                {telegramConnectCode.code}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={handleCopyTelegramCode}
                                                title="Copy command"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                            {telegramConnectCode.botLink && (
                                                <a
                                                    href={
                                                        telegramConnectCode.botLink
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors"
                                                    title="Open Telegram"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground mt-2">
                                            Use the open button to jump directly
                                            to the bot. The dashboard will
                                            detect the connection automatically
                                            after you send it.
                                        </p>
                                    </div>
                                )}
                        </div>

                        {telegramConnection?.connected && (
                            <div className="border-border/80 bg-muted/45 flex items-center justify-between space-x-2 rounded-lg border p-3">
                                <div className="flex flex-col space-y-0.5">
                                    <Label
                                        htmlFor="telegram-active-mode"
                                        className="cursor-pointer text-sm font-medium"
                                    >
                                        Enable Telegram
                                    </Label>
                                    <span className="text-muted-foreground text-[12px]">
                                        Send new item and monitor status
                                        notifications to Telegram.
                                    </span>
                                </div>
                                <Switch
                                    id="telegram-active-mode"
                                    checked={isTelegramActive}
                                    onCheckedChange={async (checked) => {
                                        setIsTelegramActive(checked);
                                        setMonitors((prev) =>
                                            prev.map((m) =>
                                                selectedMonitor &&
                                                m.id === selectedMonitor.id
                                                    ? {
                                                          ...m,
                                                          telegram_active:
                                                              checked,
                                                      }
                                                    : m,
                                            ),
                                        );
                                        if (selectedMonitor) {
                                            toast.promise(
                                                toggleTelegramStatus(
                                                    selectedMonitor.id,
                                                    !checked,
                                                ),
                                                {
                                                    success: checked
                                                        ? "Telegram activated"
                                                        : "Telegram deactivated",
                                                    error: "Failed to toggle Telegram",
                                                },
                                            );
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsWebhookOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveWebhook}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
