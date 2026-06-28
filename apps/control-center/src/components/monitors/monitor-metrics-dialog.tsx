"use client";

import { Activity, AlertTriangle } from "lucide-react";
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
    recentChecks: number;
    successRate: number | null;
    avgDuration: string;
    p95Duration: string;
    newItems: number;
    failedChecks: number;
    lastError: string | null;
};

export function MonitorMetricsDialog({
    recentChecks,
    successRate,
    avgDuration,
    p95Duration,
    newItems,
    failedChecks,
    lastError,
}: MonitorMetricsDialogProps) {
    const hasIssues = failedChecks > 0 || Boolean(lastError);
    const healthLabel = successRate === null ? "Health" : `${successRate}%`;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 gap-1.5 text-xs font-medium ${
                        hasIssues
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/10"
                            : "text-muted-foreground border-border hover:bg-muted"
                    }`}
                >
                    {hasIssues ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                        <Activity className="h-3.5 w-3.5" />
                    )}
                    {healthLabel}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Monitor Health</DialogTitle>
                    <DialogDescription>
                        Recent worker checks for this monitor.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Metric
                        label="Recent checks"
                        value={String(recentChecks)}
                    />
                    <Metric
                        label="Success rate"
                        value={successRate === null ? "n/a" : `${successRate}%`}
                    />
                    <Metric label="Avg latency" value={avgDuration} />
                    <Metric label="p95 latency" value={p95Duration} />
                    <Metric label="New items" value={String(newItems)} />
                    <Metric
                        label="Failed checks"
                        value={String(failedChecks)}
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

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-border/75 bg-muted/25 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                {label}
            </p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}
