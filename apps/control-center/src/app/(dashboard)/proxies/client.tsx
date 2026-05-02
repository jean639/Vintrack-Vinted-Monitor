"use client";

import {
    createProxyGroup,
    deleteProxyGroup,
    resetProxyGroupBandwidth,
    updateProxyGroup,
} from "@/actions/proxy-groups";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
    ChevronDown,
    ChevronUp,
    Globe,
    HardDriveDownload,
    HardDriveUpload,
    Plus,
    RotateCcw,
    Server,
    Shield,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type ProxyGroup = {
    id: number;
    name: string;
    proxies: string;
    monitorCount: number;
    bandwidthRxBytes: string;
    bandwidthTxBytes: string;
    bandwidthLimitBytes: string | null;
    bandwidthResetAt: string | null;
    created_at: string;
};

function formatBytes(value: bigint) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = Number(value);
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function formatLimitInput(value: string | null) {
    if (!value) {
        return "";
    }

    const limitGb = Number(value) / (1024 * 1024 * 1024);
    return Number.isInteger(limitGb) ? String(limitGb) : limitGb.toFixed(2);
}

export function ProxiesClient({
    initialGroups,
    userRole,
}: {
    initialGroups: ProxyGroup[];
    userRole: string;
}) {
    const [groups, setGroups] = useState<ProxyGroup[]>(initialGroups);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editProxies, setEditProxies] = useState("");
    const [editBandwidthLimitGb, setEditBandwidthLimitGb] = useState("");

    const handleCreate = async (formData: FormData) => {
        try {
            await createProxyGroup(formData);
            setIsCreateOpen(false);
            toast.success("Proxy group created");
            // Refresh page to get updated data
            window.location.reload();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to create proxy group"));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteProxyGroup(id);
            setGroups((prev) => prev.filter((g) => g.id !== id));
            if (result.pausedMonitorCount > 0) {
                toast.success(
                    `Proxy group deleted. ${result.pausedMonitorCount} monitor${
                        result.pausedMonitorCount === 1 ? "" : "s"
                    } paused until a new proxy group is selected.`,
                );
            } else if (result.affectedMonitorCount > 0) {
                toast.success(
                    `Proxy group deleted. ${result.affectedMonitorCount} monitor${
                        result.affectedMonitorCount === 1 ? "" : "s"
                    } switched to server proxies.`,
                );
            } else {
                toast.success("Proxy group deleted");
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to delete proxy group"));
        }
    };

    const handleUpdate = async (id: number) => {
        try {
            const formData = new FormData();
            formData.set("name", editName);
            formData.set("proxies", editProxies);
            formData.set("bandwidth_limit_gb", editBandwidthLimitGb);
            await updateProxyGroup(id, formData);
            setGroups((prev) =>
                prev.map((g) =>
                    g.id === id
                        ? {
                              ...g,
                              name: editName,
                              proxies: editProxies,
                              bandwidthLimitBytes:
                                  editBandwidthLimitGb.trim().length > 0
                                      ? BigInt(
                                            Math.round(
                                                Number(editBandwidthLimitGb) *
                                                    1024 *
                                                    1024 *
                                                    1024,
                                            ),
                                        ).toString()
                                      : null,
                          }
                        : g,
                ),
            );
            setEditingId(null);
            toast.success("Proxy group updated");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to update proxy group"));
        }
    };

    const handleResetBandwidth = async (id: number) => {
        try {
            await resetProxyGroupBandwidth(id);
            setGroups((prev) =>
                prev.map((g) =>
                    g.id === id
                        ? {
                              ...g,
                              bandwidthRxBytes: "0",
                              bandwidthTxBytes: "0",
                              bandwidthResetAt: new Date().toISOString(),
                          }
                        : g,
                ),
            );
            toast.success("Bandwidth reset");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to reset bandwidth"));
        }
    };

    const getProxyCount = (proxies: string) =>
        proxies.split("\n").filter((l) => l.trim().length > 0).length;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Proxy Groups
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        Manage your proxy lists for monitors.
                    </p>
                </div>
                <Button
                    onClick={() => setIsCreateOpen(true)}
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                >
                    <Plus className="h-4 w-4" /> New Group
                </Button>
            </div>

            {userRole === "premium" && (
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <CardContent className="flex items-center gap-3 p-4">
                        <Shield className="h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                            <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
                                Premium Account
                            </p>
                            <p className="text-[12px] text-amber-700 dark:text-amber-300">
                                You can use server proxies when creating
                                monitors, or use your own proxy groups.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {groups.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                        <Globe className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
                        <p className="text-muted-foreground text-[15px] font-medium">
                            No proxy groups yet
                        </p>
                        <p className="text-muted-foreground mt-1 text-[13px]">
                            Create a proxy group to start monitoring. Each
                            monitor needs a proxy group to scrape Vinted.
                        </p>
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            size="sm"
                            className="mt-4 gap-1.5"
                            variant="outline"
                        >
                            <Plus className="h-4 w-4" /> Create your first group
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => {
                        const rxBytes = BigInt(group.bandwidthRxBytes);
                        const txBytes = BigInt(group.bandwidthTxBytes);
                        const totalBytes = rxBytes + txBytes;
                        const limitBytes = group.bandwidthLimitBytes
                            ? BigInt(group.bandwidthLimitBytes)
                            : null;
                        const usagePercent =
                            limitBytes && limitBytes > BigInt(0)
                                ? Math.min(
                                      100,
                                      Number(
                                          (totalBytes * BigInt(100)) /
                                              limitBytes,
                                      ),
                                  )
                                : null;

                        return (
                            <Card key={group.id} className="border-input/60">
                                <CardContent className="p-0">
                                    <div
                                        className="hover:bg-muted/50 flex cursor-pointer items-center justify-between px-5 py-4 transition-colors"
                                        onClick={() =>
                                            setExpandedId(
                                                expandedId === group.id
                                                    ? null
                                                    : group.id,
                                            )
                                        }
                                    >
                                        <div className="flex items-center gap-3">
                                            <Server className="text-muted-foreground h-4 w-4" />
                                            <div>
                                                <p className="text-foreground text-[14px] font-medium">
                                                    {group.name}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-2">
                                                    <span className="text-muted-foreground text-[12px]">
                                                        {getProxyCount(
                                                            group.proxies,
                                                        )}{" "}
                                                        proxies
                                                    </span>
                                                    <span className="text-muted-foreground/40">
                                                        ·
                                                    </span>
                                                    <span className="text-muted-foreground text-[12px]">
                                                        {group.monitorCount}{" "}
                                                        monitor
                                                        {group.monitorCount !==
                                                        1
                                                            ? "s"
                                                            : ""}
                                                    </span>
                                                    <span className="text-muted-foreground/40">
                                                        ·
                                                    </span>
                                                    <span className="text-muted-foreground text-[12px]">
                                                        {formatBytes(
                                                            totalBytes,
                                                        )}{" "}
                                                        traffic
                                                    </span>
                                                </div>
                                                {limitBytes &&
                                                    limitBytes > BigInt(0) && (
                                                        <div className="mt-2 w-full max-w-xs">
                                                            <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                                                                <span>
                                                                    {formatBytes(
                                                                        totalBytes,
                                                                    )}{" "}
                                                                    /{" "}
                                                                    {formatBytes(
                                                                        limitBytes,
                                                                    )}
                                                                </span>
                                                                <span>
                                                                    {
                                                                        usagePercent
                                                                    }
                                                                    %
                                                                </span>
                                                            </div>
                                                            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                                                <div
                                                                    className="bg-foreground h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${usagePercent}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground h-8 w-8 hover:text-red-500"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(group.id);
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                            {expandedId === group.id ? (
                                                <ChevronUp className="text-muted-foreground h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="text-muted-foreground h-4 w-4" />
                                            )}
                                        </div>
                                    </div>

                                    {expandedId === group.id && (
                                        <div className="border-border space-y-3 border-t px-5 py-4">
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="border-border bg-muted/40 rounded-lg border p-3">
                                                    <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
                                                        <Server className="h-3.5 w-3.5" />
                                                        Total
                                                    </div>
                                                    <p className="text-foreground mt-1 text-sm font-medium">
                                                        {formatBytes(
                                                            BigInt(
                                                                group.bandwidthRxBytes,
                                                            ) +
                                                                BigInt(
                                                                    group.bandwidthTxBytes,
                                                                ),
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="border-border bg-muted/40 rounded-lg border p-3">
                                                    <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
                                                        <HardDriveDownload className="h-3.5 w-3.5" />
                                                        Download
                                                    </div>
                                                    <p className="text-foreground mt-1 text-sm font-medium">
                                                        {formatBytes(
                                                            BigInt(
                                                                group.bandwidthRxBytes,
                                                            ),
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="border-border bg-muted/40 rounded-lg border p-3">
                                                    <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
                                                        <HardDriveUpload className="h-3.5 w-3.5" />
                                                        Upload
                                                    </div>
                                                    <p className="text-foreground mt-1 text-sm font-medium">
                                                        {formatBytes(
                                                            BigInt(
                                                                group.bandwidthTxBytes,
                                                            ),
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="border-border bg-muted/30 rounded-lg border p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-muted-foreground text-[12px]">
                                                            Bandwidth limit
                                                        </p>
                                                        <p className="text-foreground mt-1 text-sm font-medium">
                                                            {limitBytes &&
                                                            limitBytes >
                                                                BigInt(0)
                                                                ? formatBytes(
                                                                      limitBytes,
                                                                  )
                                                                : "No limit"}
                                                        </p>
                                                    </div>
                                                    {limitBytes &&
                                                        limitBytes >
                                                            BigInt(0) && (
                                                            <p className="text-muted-foreground text-[12px]">
                                                                Remaining:{" "}
                                                                {formatBytes(
                                                                    limitBytes -
                                                                        totalBytes >
                                                                        BigInt(
                                                                            0,
                                                                        )
                                                                        ? limitBytes -
                                                                              totalBytes
                                                                        : BigInt(
                                                                              0,
                                                                          ),
                                                                )}
                                                            </p>
                                                        )}
                                                </div>
                                            </div>
                                            <div className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                                                <p className="text-muted-foreground text-[12px]">
                                                    {group.bandwidthResetAt
                                                        ? `Last reset: ${new Date(group.bandwidthResetAt).toLocaleString()}`
                                                        : "No reset yet"}
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5"
                                                    onClick={() =>
                                                        handleResetBandwidth(
                                                            group.id,
                                                        )
                                                    }
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Reset traffic
                                                </Button>
                                            </div>
                                            {editingId === group.id ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label className="text-[12px]">
                                                            Name
                                                        </Label>
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) =>
                                                                setEditName(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="text-[13px]"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[12px]">
                                                            Proxies (one per
                                                            line)
                                                        </Label>
                                                        <textarea
                                                            value={editProxies}
                                                            onChange={(e) =>
                                                                setEditProxies(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            rows={6}
                                                            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-[12px] focus:ring-2 focus:ring-offset-1 focus:outline-none"
                                                            placeholder="http://user:pass@host:port"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[12px]">
                                                            Bandwidth Limit (GB)
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.1"
                                                            value={
                                                                editBandwidthLimitGb
                                                            }
                                                            onChange={(e) =>
                                                                setEditBandwidthLimitGb(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            className="text-[13px]"
                                                            placeholder="Leave empty for no limit"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                handleUpdate(
                                                                    group.id,
                                                                )
                                                            }
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                setEditingId(
                                                                    null,
                                                                )
                                                            }
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="bg-muted rounded-lg p-3">
                                                        <pre className="text-muted-foreground max-h-40 overflow-y-auto font-mono text-[11px] break-all whitespace-pre-wrap">
                                                            {group.proxies
                                                                .split("\n")
                                                                .filter((l) =>
                                                                    l.trim(),
                                                                )
                                                                .map((line) => {
                                                                    // Mask proxy credentials
                                                                    try {
                                                                        const url =
                                                                            new URL(
                                                                                line.trim(),
                                                                            );
                                                                        if (
                                                                            url.username
                                                                        ) {
                                                                            return `${url.protocol}//${url.username}:****@${url.host}`;
                                                                        }
                                                                    } catch {}
                                                                    return line.replace(
                                                                        /:[^:@]+@/,
                                                                        ":****@",
                                                                    );
                                                                })
                                                                .join("\n")}
                                                        </pre>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setEditingId(
                                                                group.id,
                                                            );
                                                            setEditName(
                                                                group.name,
                                                            );
                                                            setEditProxies(
                                                                group.proxies,
                                                            );
                                                            setEditBandwidthLimitGb(
                                                                formatLimitInput(
                                                                    group.bandwidthLimitBytes,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Proxy Group</DialogTitle>
                        <DialogDescription>
                            Add a group of proxies to use with your monitors.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={handleCreate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-[13px]">
                                Group Name
                            </Label>
                            <Input
                                name="name"
                                id="name"
                                placeholder="e.g. Residential EU"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="proxies" className="text-[13px]">
                                Proxies
                            </Label>
                            <textarea
                                name="proxies"
                                id="proxies"
                                rows={8}
                                required
                                className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-[13px] focus:ring-2 focus:ring-offset-1 focus:outline-none"
                                placeholder={
                                    "http://user:pass@host:port\nhttp://user:pass@host:port\n\nSupported formats:\nhttp://user:pass@host:port\nsocks5://user:pass@host:port\nhost:port:user:pass"
                                }
                            />
                            <p className="text-muted-foreground text-[12px]">
                                One proxy per line. Supports HTTP, HTTPS, and
                                SOCKS5.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="bandwidth_limit_gb"
                                className="text-[13px]"
                            >
                                Bandwidth Limit (GB)
                            </Label>
                            <Input
                                name="bandwidth_limit_gb"
                                id="bandwidth_limit_gb"
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="Optional"
                            />
                            <p className="text-muted-foreground text-[12px]">
                                Optional. Monitors using this group will pause
                                automatically once the limit is reached.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Create Group</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
