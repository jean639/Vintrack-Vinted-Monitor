"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Info } from "lucide-react";
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
    detectionCount?: number;
    detectionWindow?: number;
    earlyDetectionCount?: number;
    earlyWinCount?: number;
    earlyAlertCount?: number;
    medianEarlyLeadMs?: number | null;
    p95DetectToAlertMs?: number | null;
    preindexExperimentDetectionCount?: number;
    preindexDetectionCount?: number;
    preindexWinCount?: number;
    preindexWinRate?: number | null;
    avgPreindexLeadMs?: number | null;
    medianPreindexLeadMs?: number | null;
    p95PreindexLeadMs?: number | null;
    preindexWindowDays?: number;
    preindexTargetMatches?: number;
    preindexReady?: boolean;
    preindexQualified?: boolean;
    preindexProbeCount?: number;
    preindexHitCount?: number;
    preindexMissCount?: number;
    preindexIssueCount?: number;
    preindexBlockedCount?: number;
    avgPreindexProbeMs?: number | null;
    p95PreindexProbeMs?: number | null;
};

type MonitorMetricsResponse = {
    totalChecks: number;
    successRate: number | null;
    avgDurationMs: number | null;
    p95DurationMs?: number | null;
    newItemCount: number;
    failedCount: number;
    lastError: string | null;
    detectionCount: number;
    detectionWindow: number;
    earlyDetectionCount: number;
    earlyWinCount: number;
    earlyAlertCount: number;
    medianEarlyLeadMs: number | null;
    p95DetectToAlertMs: number | null;
    preindexExperimentDetectionCount: number;
    preindexDetectionCount: number;
    preindexWinCount: number;
    preindexWinRate: number | null;
    avgPreindexLeadMs: number | null;
    medianPreindexLeadMs: number | null;
    p95PreindexLeadMs: number | null;
    preindexWindowDays: number;
    preindexTargetMatches: number;
    preindexReady: boolean;
    preindexQualified: boolean;
    preindexProbeCount: number;
    preindexHitCount: number;
    preindexMissCount: number;
    preindexIssueCount: number;
    preindexBlockedCount: number;
    avgPreindexProbeMs: number | null;
    p95PreindexProbeMs: number | null;
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
                detectionCount: data.detectionCount,
                detectionWindow: data.detectionWindow,
                earlyDetectionCount: data.earlyDetectionCount,
                earlyWinCount: data.earlyWinCount,
                earlyAlertCount: data.earlyAlertCount,
                medianEarlyLeadMs: data.medianEarlyLeadMs,
                p95DetectToAlertMs: data.p95DetectToAlertMs,
                preindexExperimentDetectionCount:
                    data.preindexExperimentDetectionCount,
                preindexDetectionCount: data.preindexDetectionCount,
                preindexWinCount: data.preindexWinCount,
                preindexWinRate: data.preindexWinRate,
                avgPreindexLeadMs: data.avgPreindexLeadMs,
                medianPreindexLeadMs: data.medianPreindexLeadMs,
                p95PreindexLeadMs: data.p95PreindexLeadMs,
                preindexWindowDays: data.preindexWindowDays,
                preindexTargetMatches: data.preindexTargetMatches,
                preindexReady: data.preindexReady,
                preindexQualified: data.preindexQualified,
                preindexProbeCount: data.preindexProbeCount,
                preindexHitCount: data.preindexHitCount,
                preindexMissCount: data.preindexMissCount,
                preindexIssueCount: data.preindexIssueCount,
                preindexBlockedCount: data.preindexBlockedCount,
                avgPreindexProbeMs: data.avgPreindexProbeMs,
                p95PreindexProbeMs: data.p95PreindexProbeMs,
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
        detectionCount = 0,
        detectionWindow = 100,
        earlyDetectionCount = 0,
        earlyWinCount = 0,
        earlyAlertCount = 0,
        medianEarlyLeadMs = null,
        p95DetectToAlertMs = null,
        preindexExperimentDetectionCount = 0,
        preindexDetectionCount = 0,
        preindexWinCount = 0,
        preindexWinRate = null,
        avgPreindexLeadMs = null,
        medianPreindexLeadMs = null,
        p95PreindexLeadMs = null,
        preindexWindowDays = 14,
        preindexTargetMatches = 25,
        preindexReady = false,
        preindexQualified = false,
        preindexProbeCount = 0,
        preindexHitCount = 0,
        preindexMissCount = 0,
        preindexIssueCount = 0,
        preindexBlockedCount = 0,
        avgPreindexProbeMs = null,
        p95PreindexProbeMs = null,
    } = metrics;
    const hasIssues = failedChecks > 0 || Boolean(lastError);
    const hasPreindexExperiment =
        preindexProbeCount > 0 || preindexDetectionCount > 0;
    const preindexProgress = Math.min(
        100,
        Math.round(
            (preindexDetectionCount / Math.max(preindexTargetMatches, 1)) * 100,
        ),
    );
    const remainingPreindexMatches = Math.max(
        preindexTargetMatches - preindexDetectionCount,
        0,
    );

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
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4 pr-8">
                        <div className="space-y-1.5">
                            <DialogTitle>Monitor Health</DialogTitle>
                            <DialogDescription>
                                Latest 100 canonical worker checks and up to{" "}
                                {detectionWindow} item detections. Refreshes
                                every 10 seconds while this dialog is open.
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
                        description="Items saved since the oldest check included here."
                    />
                    <Metric
                        label="Failed checks"
                        value={String(failedChecks)}
                        description="Checks where all fetch attempts failed."
                    />
                    <Metric
                        label="Hybrid detections"
                        value={`${earlyDetectionCount} / ${detectionCount}`}
                        description={`Items found by the query-free discovery feed among up to ${detectionWindow} latest detections.`}
                    />
                    <Metric
                        label="Early wins"
                        value={String(earlyWinCount)}
                        description="Discovery detections that arrived before the canonical search result."
                    />
                    <Metric
                        label="Early alerts"
                        value={String(earlyAlertCount)}
                        description="Alerts delivered before the canonical search detected the item, including items canonical has not seen yet."
                    />
                    <Metric
                        label="Median early lead"
                        value={formatMs(medianEarlyLeadMs)}
                        description="Typical lead over canonical search when hybrid discovery won; the median limits batch outliers."
                    />
                    <Metric
                        label="p95 detect to alert"
                        value={formatMs(p95DetectToAlertMs)}
                        description="95% of first configured alert deliveries completed within this time after detection. Telegram or Discord is used when enabled; otherwise dashboard/SSE is the delivery point."
                    />
                </div>

                {hasPreindexExperiment && (
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            Pre-index shadow experiment
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Bounded ID samples using an isolated free-proxy
                            process. Cumulative experiment window (max{" "}
                            {preindexWindowDays} days); these probes never send
                            alerts.
                        </p>
                    </div>
                )}

                {hasPreindexExperiment && (
                    <div
                        className={
                            preindexQualified
                                ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                                : "border-border/75 bg-muted/25 rounded-lg border px-4 py-3"
                        }
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-semibold">
                                {preindexQualified
                                    ? "Ready for detail-resolution shadow"
                                    : preindexReady
                                      ? "Evidence target reached"
                                      : "Collecting evidence"}
                            </p>
                            <p className="text-muted-foreground text-xs tabular-nums">
                                {preindexDetectionCount} /{" "}
                                {preindexTargetMatches} matches
                            </p>
                        </div>
                        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                            <div
                                className={
                                    preindexQualified
                                        ? "h-full rounded-full bg-emerald-500 transition-[width]"
                                        : "bg-foreground/70 h-full rounded-full transition-[width]"
                                }
                                style={{ width: `${preindexProgress}%` }}
                            />
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">
                            {preindexQualified
                                ? "At least 60% wins, 5s median lead, and 98% canonical success are confirmed."
                                : preindexReady
                                  ? "Enough matches collected; the lead and stability thresholds are not all confirmed yet."
                                  : `${remainingPreindexMatches} more matched samples needed before the Phase 3 decision.`}
                        </p>
                    </div>
                )}

                {hasPreindexExperiment && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Metric
                            label="Pre-index coverage"
                            value={`${preindexDetectionCount} / ${preindexExperimentDetectionCount}`}
                            description={`Monitor detections since this regional experiment began, capped to ${preindexWindowDays} days, whose exact item ID was sampled. Matches no longer roll out after 500 detections.`}
                        />
                        <Metric
                            label="Pre-index wins"
                            value={`${preindexWinCount} / ${preindexDetectionCount}${preindexWinRate === null ? "" : ` (${preindexWinRate}%)`}`}
                            description="Sampled item IDs that became reachable before hybrid or canonical catalog detection. Shadow only; these hits do not send alerts."
                        />
                        <Metric
                            label="Median pre-index lead"
                            value={formatMs(medianPreindexLeadMs)}
                            description="Middle winning lead across the cumulative experiment. This is the primary speed threshold because it is less sensitive to outliers than the average."
                        />
                        <Metric
                            label="Avg pre-index lead"
                            value={formatMs(avgPreindexLeadMs)}
                            description="Average lead from a verified bare-item redirect to the first catalog detection for matching sampled IDs."
                        />
                        <Metric
                            label="p95 pre-index lead"
                            value={formatMs(p95PreindexLeadMs)}
                            description="95% of winning matched samples had a lead at or below this value."
                        />
                        <Metric
                            label="Pre-index probes"
                            value={`${preindexHitCount} hit / ${preindexProbeCount}`}
                            description={`Latest 500 bounded shadow probes in this monitor's region; ${preindexMissCount} were not yet reachable.`}
                        />
                        <Metric
                            label="Pre-index issues"
                            value={`${preindexIssueCount} (${preindexBlockedCount} blocked)`}
                            description="Probe responses that were neither verified item redirects nor clean misses. Blocking automatically slows the scanner down."
                        />
                        <Metric
                            label="p95 probe latency"
                            value={formatMs(p95PreindexProbeMs)}
                            description={`95% of recent shadow probes completed within this time; average ${formatMs(avgPreindexProbeMs)}.`}
                        />
                    </div>
                )}

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
        <div className="border-border/75 bg-muted/25 rounded-lg border px-4 py-3">
            <div className="flex items-center gap-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                    {label}
                </p>
                <span
                    className="group text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground relative inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors outline-none"
                    tabIndex={0}
                    aria-label={`${label}: ${description}`}
                >
                    <Info className="h-3.5 w-3.5" />
                    <span className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-md border px-2.5 py-2 text-left text-[11px] leading-snug shadow-md group-hover:block group-focus-visible:block">
                        {description}
                    </span>
                </span>
            </div>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}
