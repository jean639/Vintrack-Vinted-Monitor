"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    LinkIcon,
    Unlink,
    RefreshCw,
    ShieldCheck,
    Bot,
    Download,
    Eye,
    EyeOff,
} from "lucide-react";
import { REGIONS } from "@/lib/regions";
import { cn } from "@/lib/utils";
import {
    linkVintedAccount,
    unlinkVintedAccount,
    getAccountStatus,
    refreshVintedSession,
    updateVintedPhoneNumber,
    updateVintedDomain,
} from "@/actions/account";
import { toast } from "sonner";

export interface AccountStatus {
    linked: boolean;
    status?: string;
    vinted_name?: string;
    vinted_id?: number;
    domain?: string;
    linked_at?: string;
    last_check?: string;
    has_browser_session?: boolean;
    browser_linked?: boolean;
    last_browser_sync?: string;
    has_phone_number?: boolean;
}

type BrowserSyncState = {
    token: string;
    installed?: boolean;
    configured?: boolean;
    created_at: string;
    expires_at: string;
    last_used_at?: string;
    syncedDomains?: string[];
    error?: string;
};

const EXTENSION_DOWNLOAD_URL =
    "https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip";

export function AccountClient({
    initialStatus,
}: {
    initialStatus: AccountStatus;
}) {
    const [status, setStatus] = useState<AccountStatus>(initialStatus);
    const [accessToken, setAccessToken] = useState("");
    const [refreshToken, setRefreshToken] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [linkedPhoneNumber, setLinkedPhoneNumber] = useState("");
    const [browserSync, setBrowserSync] = useState<BrowserSyncState | null>(
        null,
    );
    const [extensionInstalled, setExtensionInstalled] = useState(false);
    const [extensionConfigured, setExtensionConfigured] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState(() => {
        const matchingRegion = REGIONS.find(
            (region) =>
                initialStatus.domain === region.domain ||
                initialStatus.domain === `www.${region.domain}`,
        );
        return matchingRegion?.code || "de";
    });
    const [isVintedIdVisible, setIsVintedIdVisible] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isBrowserSyncStarting, setIsBrowserSyncStarting] = useState(false);

    const selectedDomain =
        REGIONS.find((r) => r.code === selectedRegion)?.domain || "vinted.de";
    const targetDomain = `www.${selectedDomain}`;

    useEffect(() => {
        if (!status.domain) {
            return;
        }

        const matchingRegion = REGIONS.find(
            (region) =>
                status.domain === region.domain ||
                status.domain === `www.${region.domain}`,
        );
        if (matchingRegion) {
            setSelectedRegion(matchingRegion.code);
        }
    }, [status.domain]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== window || !event.data?.type) {
                return;
            }

            if (event.data.type === "VINTRACK_EXTENSION_READY") {
                setExtensionInstalled(
                    Boolean(event.data.payload?.installed ?? true),
                );
                setExtensionConfigured(Boolean(event.data.payload?.configured));
                return;
            }

            if (event.data.type === "VINTRACK_EXTENSION_CONNECT_RESULT") {
                setIsBrowserSyncStarting(false);

                const payload = event.data.payload as {
                    ok?: boolean;
                    error?: string;
                    syncedDomains?: string[];
                    configured?: boolean;
                };

                if (!payload?.ok) {
                    toast.error(
                        payload?.error || "Failed to connect browser extension",
                    );
                    return;
                }

                setExtensionInstalled(true);
                setExtensionConfigured(Boolean(payload.configured ?? true));
                setBrowserSync((current) =>
                    current
                        ? {
                              ...current,
                              configured: true,
                              syncedDomains: payload.syncedDomains || [],
                          }
                        : current,
                );

                toast.success(
                    payload.syncedDomains?.length
                        ? `Extension connected and synced ${payload.syncedDomains.length} Vinted session(s)`
                        : "Extension connected",
                );

                void getAccountStatus().then((updated) => {
                    setStatus(updated);
                });
                return;
            }

            if (event.data.type === "VINTRACK_EXTENSION_MANUAL_SYNC_RESULT") {
                const payload = event.data.payload as {
                    ok?: boolean;
                    error?: string;
                    results?: Array<{ ok?: boolean }>;
                };

                if (!payload?.ok) {
                    toast.error(payload?.error || "Extension sync failed");
                    return;
                }

                const syncedCount = (payload.results || []).filter(
                    (result) => result.ok,
                ).length;
                toast.success(
                    syncedCount > 0
                        ? `Synced ${syncedCount} Vinted session(s)`
                        : "No active Vinted session found",
                );
                void getAccountStatus().then((updated) => {
                    setStatus(updated);
                });
            }
        };

        window.addEventListener("message", handleMessage);
        window.postMessage(
            { type: "VINTRACK_EXTENSION_PING" },
            window.location.origin,
        );

        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const handleLink = () => {
        if (!accessToken.trim()) {
            toast.error("Access token is required");
            return;
        }

        const wasLinked = status.linked;
        startTransition(async () => {
            const result = await linkVintedAccount(
                accessToken.trim(),
                targetDomain,
                refreshToken.trim() || undefined,
                phoneNumber.trim() || undefined,
            );
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            setAccessToken("");
            setRefreshToken("");
            setPhoneNumber("");
            setStatus({
                linked: true,
                status: "active",
                vinted_name: result.vinted_name,
                vinted_id: result.vinted_id,
                domain: result.domain,
                has_browser_session: result.has_browser_session,
                browser_linked: result.browser_linked,
                last_browser_sync: result.last_browser_sync,
                has_phone_number: result.has_phone_number,
                linked_at: new Date().toISOString(),
                last_check: new Date().toISOString(),
            });
            toast.success(
                wasLinked
                    ? `Session updated for @${result.vinted_name}`
                    : `Linked to @${result.vinted_name}`,
            );
        });
    };

    const handleUnlink = () => {
        if (!confirm("Unlink your Vinted account?")) return;

        startTransition(async () => {
            const result = await unlinkVintedAccount();
            if (result.error) {
                toast.error(result.error);
                return;
            }
            setStatus({ linked: false });
            toast.success("Account unlinked");
        });
    };

    const handleRefresh = () => {
        startTransition(async () => {
            const result = await refreshVintedSession();
            if (result.error) {
                toast.error("Token refresh failed: " + result.error);
                // Still update status to show current state
                const updated = await getAccountStatus();
                setStatus(updated);
                return;
            }
            toast.success("Token refreshed successfully");
            const updated = await getAccountStatus();
            setStatus(updated);
        });
    };

    const handlePhoneUpdate = () => {
        startTransition(async () => {
            const result = await updateVintedPhoneNumber(
                linkedPhoneNumber.trim(),
            );
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            setStatus((current) => ({
                ...current,
                has_phone_number: result.has_phone_number,
                last_check: result.last_check,
            }));
            if (result.has_phone_number) {
                setLinkedPhoneNumber("");
                toast.success("Shipping phone number saved");
            } else {
                toast.success("Shipping phone number cleared");
            }
        });
    };

    const handleDomainUpdate = () => {
        startTransition(async () => {
            const result = await updateVintedDomain(targetDomain);
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            setStatus((current) => ({
                ...current,
                domain: result.domain,
                last_check: result.last_check,
            }));
            toast.success(`Primary Vinted region set to ${result.domain}`);

            if (extensionInstalled) {
                window.postMessage(
                    {
                        type: "VINTRACK_EXTENSION_MANUAL_SYNC",
                        payload: {
                            preferredDomain: result.domain,
                        },
                    },
                    window.location.origin,
                );
            }
        });
    };

    const handleBrowserSyncStart = async () => {
        setIsBrowserSyncStarting(true);

        try {
            const res = await fetch("/api/account/browser-link", {
                method: "POST",
                cache: "no-store",
            });
            const data = (await res.json()) as BrowserSyncState & {
                error?: string;
            };

            if (!res.ok) {
                throw new Error(data.error || `Request failed (${res.status})`);
            }

            setBrowserSync(data);
            if (!extensionInstalled) {
                setIsBrowserSyncStarting(false);
                toast.error(
                    "Browser extension not detected. Install it and try again.",
                );
                return;
            }

            window.postMessage(
                {
                    type: "VINTRACK_EXTENSION_CONNECT",
                    payload: {
                        token: data.token,
                        appOrigin: window.location.origin,
                        preferredDomain: targetDomain,
                    },
                },
                window.location.origin,
            );
        } catch (error) {
            setIsBrowserSyncStarting(false);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to connect extension",
            );
        }
    };

    const handleManualExtensionSync = () => {
        if (!extensionInstalled) {
            toast.error("Browser extension not detected");
            return;
        }

        window.postMessage(
            {
                type: "VINTRACK_EXTENSION_MANUAL_SYNC",
                payload: {
                    preferredDomain: targetDomain,
                },
            },
            window.location.origin,
        );
    };

    return (
        <div className="space-y-6 mx-auto max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Vinted Account
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Link your Vinted account to like items and more, directly
                    from the dashboard.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Browser Extension
                    </CardTitle>
                    <CardDescription>
                        {status.linked
                            ? "Keeps your Vinted session fresh in this browser."
                            : "Link from the browser where you are already signed in to Vinted."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2 py-3">
                        <Badge
                            variant={
                                extensionInstalled ? "default" : "destructive"
                            }
                        >
                            {extensionInstalled
                                ? "Extension detected"
                                : "Extension not detected"}
                        </Badge>
                        <Badge
                            variant={
                                extensionConfigured ? "default" : "outline"
                            }
                        >
                            {extensionConfigured
                                ? "Connected"
                                : "Not connected"}
                        </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Install the extension once, sign in to Vinted, then
                        connect it here. Future browser logins sync
                        automatically.
                    </p>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button asChild variant="outline" className="gap-2">
                            <a
                                href={EXTENSION_DOWNLOAD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Download className="h-4 w-4" />
                                Download Extension
                            </a>
                        </Button>
                        <Button
                            onClick={handleBrowserSyncStart}
                            disabled={isBrowserSyncStarting}
                            className="gap-2"
                        >
                            {isBrowserSyncStarting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Bot className="w-4 h-4" />
                            )}
                            {status.linked
                                ? "Connect Installed Extension"
                                : "Link With Installed Extension"}
                        </Button>
                        {extensionInstalled ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleManualExtensionSync}
                            >
                                Sync Now
                            </Button>
                        ) : null}
                    </div>

                    {browserSync?.syncedDomains?.length ? (
                        <p className="text-xs text-muted-foreground">
                            Last synced: {browserSync.syncedDomains.join(", ")}
                        </p>
                    ) : null}
                </CardContent>
            </Card>

            {status.linked ? (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        @{status.vinted_name}
                                    </CardTitle>
                                    <CardDescription>
                                        Linked to {status.domain}
                                    </CardDescription>
                                </div>
                            </div>
                            <Badge
                                variant={
                                    status.status === "active"
                                        ? "default"
                                        : "destructive"
                                }
                            >
                                {status.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                            <span>
                                Last sync:{" "}
                                <strong className="font-medium text-foreground">
                                    {status.last_browser_sync
                                        ? new Date(
                                              status.last_browser_sync,
                                          ).toLocaleString()
                                        : status.last_check
                                          ? new Date(
                                                status.last_check,
                                            ).toLocaleString()
                                          : "not yet"}
                                </strong>
                            </span>
                            <span>
                                Phone:{" "}
                                <strong className="font-medium text-foreground">
                                    {status.has_phone_number
                                        ? "saved"
                                        : "not set"}
                                </strong>
                            </span>
                            {status.vinted_id ? (
                                <span className="inline-flex items-center gap-1">
                                    ID:{" "}
                                    <strong className="font-medium text-foreground">
                                        {isVintedIdVisible
                                            ? status.vinted_id
                                            : "hidden"}
                                    </strong>
                                    <button
                                        onClick={() =>
                                            setIsVintedIdVisible(
                                                (prev) => !prev,
                                            )
                                        }
                                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                        type="button"
                                    >
                                        {isVintedIdVisible ? (
                                            <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                            <Eye className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </span>
                            ) : null}
                        </div>

                        <div className="rounded-md border border-border/80 bg-background/60 p-3 text-sm">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                                Primary Region
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Checkout starts here first. Other synced regions
                                no longer overwrite this setting.
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                                {REGIONS.slice(0, 12).map((region) => {
                                    const isSelected =
                                        selectedRegion === region.code;
                                    return (
                                        <button
                                            key={region.code}
                                            type="button"
                                            onClick={() =>
                                                setSelectedRegion(region.code)
                                            }
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                                                isSelected
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-background hover:bg-muted",
                                            )}
                                        >
                                            <span>{region.flag}</span>
                                            <span>
                                                {region.code.toUpperCase()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <p className="text-xs text-muted-foreground">
                                    Current: {status.domain || "—"} · Selected:{" "}
                                    {targetDomain}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDomainUpdate}
                                    disabled={
                                        isPending ||
                                        status.domain === targetDomain
                                    }
                                    className="sm:ml-auto"
                                >
                                    Save Region
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-md border border-border/80 bg-background/60 p-3 text-sm">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                                Shipping Contact
                            </span>
                            <p className="mt-1 font-medium">
                                {status.has_phone_number
                                    ? "Phone number stored for checkout"
                                    : "No phone number stored"}
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={linkedPhoneNumber}
                                    onChange={(e) =>
                                        setLinkedPhoneNumber(e.target.value)
                                    }
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="new-password"
                                    name="vintrack-shipping-phone"
                                    placeholder="Set or clear phone number, e.g. +491234567890"
                                    className="bg-background"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePhoneUpdate}
                                    disabled={isPending}
                                    className="sm:w-auto"
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col xs:flex-row gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isPending}
                                className="flex-1 sm:flex-none gap-1.5"
                            >
                                <RefreshCw
                                    className={cn(
                                        "w-3.5 h-3.5",
                                        isPending && "animate-spin",
                                    )}
                                />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleUnlink}
                                disabled={isPending}
                                className="flex-1 sm:flex-none gap-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 dark:bg-transparent"
                            >
                                <Unlink className="w-3.5 h-3.5" />
                                Unlink Account
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {status.linked ? (
                <Card className="py-0">
                    <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm font-medium">
                            Manual repair
                            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                                Optional
                            </span>
                        </summary>
                        <CardContent className="space-y-4 pb-6">
                            <p className="text-sm text-muted-foreground">
                                Use this only if the extension cannot sync the
                                current browser session.
                            </p>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="repair-access-token">
                                        Access Token
                                    </Label>
                                    <Input
                                        id="repair-access-token"
                                        type="password"
                                        placeholder="access_token_web"
                                        value={accessToken}
                                        onChange={(e) =>
                                            setAccessToken(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="repair-refresh-token">
                                        Refresh Token
                                    </Label>
                                    <Input
                                        id="repair-refresh-token"
                                        type="password"
                                        placeholder="refresh_token_web"
                                        value={refreshToken}
                                        onChange={(e) =>
                                            setRefreshToken(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleLink}
                                disabled={isPending}
                                className="gap-2"
                            >
                                {isPending ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LinkIcon className="w-4 h-4" />
                                )}
                                Update Session
                            </Button>
                        </CardContent>
                    </details>
                </Card>
            ) : (
                <Card className="py-0">
                    <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm font-medium">
                            Manual token link
                            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                                Fallback
                            </span>
                        </summary>
                        <CardContent className="space-y-5 pb-6">
                            <p className="text-sm text-muted-foreground">
                                Prefer the extension above. Use tokens only if
                                the extension is unavailable.
                            </p>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Region
                                </Label>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                                    {REGIONS.slice(0, 12).map((region) => {
                                        const isSelected =
                                            selectedRegion === region.code;
                                        return (
                                            <button
                                                key={region.code}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedRegion(
                                                        region.code,
                                                    )
                                                }
                                                className={cn(
                                                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                                                    isSelected
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                                )}
                                            >
                                                <span className="text-sm shrink-0">
                                                    {region.flag}
                                                </span>
                                                <span className="truncate">
                                                    {region.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="access-token">
                                        Access Token
                                    </Label>
                                    <Input
                                        id="access-token"
                                        type="password"
                                        placeholder="access_token_web"
                                        value={accessToken}
                                        onChange={(e) =>
                                            setAccessToken(e.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="refresh-token">
                                        Refresh Token
                                    </Label>
                                    <Input
                                        id="refresh-token"
                                        type="password"
                                        placeholder="refresh_token_web"
                                        value={refreshToken}
                                        onChange={(e) =>
                                            setRefreshToken(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone-number">
                                    Shipping Phone Number
                                </Label>
                                <Input
                                    id="phone-number"
                                    value={phoneNumber}
                                    onChange={(e) =>
                                        setPhoneNumber(e.target.value)
                                    }
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    name="vintrack-shipping-phone"
                                    placeholder="Optional, e.g. +491234567890"
                                />
                            </div>

                            <Button
                                onClick={handleLink}
                                disabled={!accessToken.trim() || isPending}
                                className="gap-2"
                            >
                                {isPending ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LinkIcon className="w-4 h-4" />
                                )}
                                Link Account
                            </Button>
                        </CardContent>
                    </details>
                </Card>
            )}
        </div>
    );
}
