"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type MonitorMetricsDialogProps = {
    monitorId: number;
    initialMetrics: MonitorMetrics;
};

type MonitorMetrics = {
    recentChecks: number;
    successRate: number | null;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    newItems: number;
    failedChecks: number;
    lastError: string | null;
};

type MonitorMetricsResponse = {
    totalChecks: number;
    successRate: number | null;
    avgDurationMs: number | null;
    p95DurationMs?: number | null;
    newItemCount: number;
    failedCount: number;
    lastError: string | null;
};

function formatMs(value: number | null) {
    if (value === null) return "n/a";
    return `${value} ms`;
}

export function MonitorMetricsDialog({
    monitorId,
    initialMetrics,
}: MonitorMetricsDialogProps) {
    const [open, setOpen] = useState(false);
    const [metrics, setMetrics] = useState(initialMetrics);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshMetrics = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch(`/api/monitors/${monitorId}/metrics`, {
                cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as MonitorMetricsResponse;
            setMetrics({
                recentChecks: data.totalChecks,
                successRate: data.successRate,
                avgDurationMs: data.avgDurationMs,
                p95DurationMs: data.p95DurationMs ?? null,
                newItems: data.newItemCount,
                failedChecks: data.failedCount,
                lastError: data.lastError,
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [monitorId]);

    useEffect(() => {
        if (!open) return;
        void refreshMetrics();
        const interval = window.setInterval(refreshMetrics, 10_000);
        return () => window.clearInterval(interval);
    }, [open, refreshMetrics]);

    const {
        recentChecks,
        successRate,
        avgDurationMs,
        p95DurationMs,
        newItems,
        failedChecks,
        lastError,
    } = metrics;
    const hasIssues = failedChecks > 0 || Boolean(lastError);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground border-border hover:bg-muted h-8 gap-1.5 text-xs font-medium"
                    title="Open monitor metrics"
                >
                    <Activity className="h-3.5 w-3.5" />
                    Metrics
                    {hasIssues && (
                        <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                            aria-label="Monitor has recent issues"
                        />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4 pr-8">
                        <div>
                            <DialogTitle>Monitor Health</DialogTitle>
                            <DialogDescription>
                                Latest 100 worker checks. Refreshes every 10
                                seconds while this dialog is open.
                            </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={refreshMetrics}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? "Refreshing..." : "Refresh"}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Metric
                        label="Recent checks"
                        value={String(recentChecks)}
                        description="How many saved worker checks are included in this view."
                    />
                    <Metric
                        label="Success rate"
                        value={successRate === null ? "n/a" : `${successRate}%`}
                        description="Share of checks that reached Vinted successfully."
                    />
                    <Metric
                        label="Avg latency"
                        value={formatMs(avgDurationMs)}
                        description="Average time a check took from request start to result."
                    />
                    <Metric
                        label="p95 latency"
                        value={formatMs(p95DurationMs)}
                        description="95% of checks were faster than this value."
                    />
                    <Metric
                        label="New items"
                        value={String(newItems)}
                        description="New matching items found in the included checks."
                    />
                    <Metric
                        label="Failed checks"
                        value={String(failedChecks)}
                        description="Checks where all fetch attempts failed."
                    />
                </div>

                {hasIssues && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                            Recent issue
                        </p>
                        <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">
                            {failedChecks} failed check
                            {failedChecks === 1 ? "" : "s"} in the latest 100
                            runs{lastError ? ` · ${lastError}` : ""}.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Metric({
    label,
    value,
    description,
}: {
    label: string;
    value: string;
    description: string;
}) {
    return (
        <div
            className="border-border/75 bg-muted/25 rounded-lg border px-4 py-3"
            title={description}
        >
            <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                {label}
            </p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                {description}
            </p>
        </div>
    );
}
