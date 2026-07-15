"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Shield,
    Crown,
    User,
    Monitor,
    Globe,
    Server,
    Search,
    ScrollText,
    Settings2,
    Users,
    Sparkles,
    PauseCircle,
    Clock3,
    Boxes,
    Webhook,
    Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    setGlobalActiveMonitorLimit,
    setRoleActiveMonitorLimit,
    setUserRole,
    setUserActiveMonitorLimit,
    getAdminLogs,
    getAdminUserDetails,
    updateServerProxies,
    stopSingleUserMonitor,
    stopUserActiveMonitors,
} from "@/actions/admin";
import { getRegionLabel } from "@/lib/regions";

type UserMonitor = {
    id: number;
    name: string;
    query: string;
    query_delay_ms: number;
    status: string | null;
    region: string;
    created_at: Date | null;
    price_min: number | null;
    price_max: number | null;
    discord_webhook: string | null;
    webhook_active: boolean;
    telegram_active: boolean;
    proxy_group: { name: string } | null;
    _count: { items: number };
};

type AdminUserMetrics = {
    runningMonitors: number;
    pausedMonitors: number;
    totalItems: number;
    newItems24h: number;
    checks24h: number;
    successfulChecks24h: number;
    failedChecks24h: number;
    successRate24h: number | null;
    avgDurationMs24h: number | null;
    lastCheckAt: Date | null;
    latestError24h: string | null;
};

type UserRow = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    _count: { monitors: number; proxy_groups: number };
    monitors: UserMonitor[];
    metrics: AdminUserMetrics;
};

type AdminTab = "overview" | "users" | "roles" | "logs" | "settings";

type AdminLogRow = {
    id: string;
    type: "audit" | "monitor" | "alert";
    title: string;
    detail: string | null;
    status: string;
    subject: string | null;
    actor: string | null;
    createdAt: Date;
};

type MonitorLimits = {
    global: number | null;
    roles: Record<string, number | null>;
    users: Record<string, number | null>;
};

const ROLES = [
    {
        value: "free",
        label: "Free",
        icon: User,
        color: "bg-muted text-muted-foreground",
    },
    {
        value: "premium",
        label: "Premium",
        icon: Crown,
        color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
    },
    {
        value: "admin",
        label: "Admin",
        icon: Shield,
        color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
    },
] as const;

const LIMIT_ROLES = ROLES.filter((role) => role.value !== "admin");
const USER_PAGE_SIZES = [25, 50, 100] as const;
const ADMIN_TABS: {
    value: AdminTab;
    label: string;
    icon: typeof BarChart3;
}[] = [
    { value: "overview", label: "Overview", icon: BarChart3 },
    { value: "users", label: "Users", icon: Users },
    { value: "roles", label: "Roles", icon: Shield },
    { value: "logs", label: "Logs", icon: ScrollText },
    { value: "settings", label: "Settings", icon: Settings2 },
];

function getRoleBadge(role: string) {
    const r = ROLES.find((r) => r.value === role) ?? ROLES[0];
    return (
        <Badge
            className={`${r.color} gap-1 text-[10px] font-semibold tracking-wide uppercase`}
        >
            <r.icon className="h-3 w-3" />
            {r.label}
        </Badge>
    );
}

function formatCreatedAt(value: Date | null) {
    if (!value) return "Unknown";

    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatMetricDate(value: Date | null) {
    if (!value) return "No checks";

    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatSuccessRate(value: number | null) {
    return value === null ? "n/a" : `${value}%`;
}

function formatDuration(value: number | null) {
    return value === null ? "n/a" : `${value} ms`;
}

function limitInputValue(value: number | null | undefined) {
    return value === null || value === undefined ? "" : String(value);
}

function formatLimit(value: number | null) {
    return value === null ? "Unlimited" : `${value} active`;
}

function normalizeTab(value: string | null | undefined): AdminTab {
    return ADMIN_TABS.some((tab) => tab.value === value)
        ? (value as AdminTab)
        : "overview";
}

export function AdminClient({
    users: initialUsers,
    logs,
    initialTab,
    currentUserId,
    serverProxies: initialServerProxies,
    monitorLimits: initialMonitorLimits,
}: {
    users: UserRow[];
    logs: AdminLogRow[];
    initialTab?: string;
    currentUserId: string;
    serverProxies: string;
    monitorLimits: MonitorLimits;
}) {
    const [users, setUsers] = useState<UserRow[]>(initialUsers);
    const [adminLogs, setAdminLogs] = useState<AdminLogRow[]>(logs);
    const [logsLoaded, setLogsLoaded] = useState(logs.length > 0);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [activeTab, setActiveTab] = useState<AdminTab>(
        normalizeTab(initialTab),
    );
    const [selected, setSelected] = useState<UserRow | null>(null);
    const [loadingUserDetailsId, setLoadingUserDetailsId] = useState<
        string | null
    >(null);
    const [pendingRole, setPendingRole] = useState<string>("");
    const [isOpen, setIsOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isProxyDialogOpen, setIsProxyDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userPage, setUserPage] = useState(1);
    const [usersPerPage, setUsersPerPage] =
        useState<(typeof USER_PAGE_SIZES)[number]>(25);
    const [isStoppingMonitors, setIsStoppingMonitors] = useState(false);
    const [stoppingMonitorId, setStoppingMonitorId] = useState<number | null>(
        null,
    );
    const [monitorLimits, setMonitorLimits] = useState<MonitorLimits>(
        initialMonitorLimits,
    );
    const [globalLimitInput, setGlobalLimitInput] = useState(
        limitInputValue(initialMonitorLimits.global),
    );
    const [roleLimitInputs, setRoleLimitInputs] = useState<
        Record<string, string>
    >(
        Object.fromEntries(
            LIMIT_ROLES.map((role) => [
                role.value,
                limitInputValue(initialMonitorLimits.roles[role.value]),
            ]),
        ),
    );
    const [userLimitInput, setUserLimitInput] = useState("");
    const [serverProxies, setServerProxies] = useState(initialServerProxies);
    const [isSavingServerProxies, setIsSavingServerProxies] = useState(false);

    const loadAdminLogs = () => {
        if (logsLoaded || isLoadingLogs) return;

        setIsLoadingLogs(true);
        getAdminLogs()
            .then((nextLogs) => {
                setAdminLogs(nextLogs);
                setLogsLoaded(true);
            })
            .catch(() => {
                toast.error("Failed to load admin logs");
            })
            .finally(() => setIsLoadingLogs(false));
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = normalizeTab(params.get("tab"));
        setActiveTab(tab);
        if (tab === "logs") loadAdminLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const switchTab = (tab: AdminTab) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url.toString());

        if (tab === "logs") loadAdminLogs();
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredUsers = users.filter((user) => {
        if (!normalizedQuery) return true;

        const searchable = [user.name ?? "", user.email ?? "", user.role]
            .join(" ")
            .toLowerCase();

        return searchable.includes(normalizedQuery);
    });
    const totalUserPages = Math.max(
        1,
        Math.ceil(filteredUsers.length / usersPerPage),
    );
    const currentUserPage = Math.min(userPage, totalUserPages);
    const userPageStart = (currentUserPage - 1) * usersPerPage;
    const paginatedUsers = filteredUsers.slice(
        userPageStart,
        userPageStart + usersPerPage,
    );
    const shownUserStart =
        filteredUsers.length === 0 ? 0 : userPageStart + 1;
    const shownUserEnd = Math.min(
        userPageStart + usersPerPage,
        filteredUsers.length,
    );

    const totalUsers = users.length;
    const freeUsers = users.filter((u) => u.role === "free").length;
    const premiumUsers = users.filter((u) => u.role === "premium").length;
    const adminUsers = users.filter((u) => u.role === "admin").length;
    const runningMonitors = users.reduce(
        (sum, user) => sum + user.metrics.runningMonitors,
        0,
    );
    const newItems24h = users.reduce(
        (sum, user) => sum + user.metrics.newItems24h,
        0,
    );
    const failedChecks24h = users.reduce(
        (sum, user) => sum + user.metrics.failedChecks24h,
        0,
    );
    const totalMonitors = users.reduce(
        (sum, user) => sum + user._count.monitors,
        0,
    );
    const pausedMonitors = users.reduce(
        (sum, user) => sum + user.metrics.pausedMonitors,
        0,
    );
    const totalItems = users.reduce(
        (sum, user) => sum + user.metrics.totalItems,
        0,
    );
    const checks24h = users.reduce(
        (sum, user) => sum + user.metrics.checks24h,
        0,
    );
    const successfulChecks24h = users.reduce(
        (sum, user) => sum + user.metrics.successfulChecks24h,
        0,
    );
    const successRate24h =
        checks24h > 0 ? Math.round((successfulChecks24h / checks24h) * 100) : null;
    const topUsers = [...users]
        .sort(
            (a, b) =>
                b.metrics.runningMonitors - a.metrics.runningMonitors ||
                b.metrics.newItems24h - a.metrics.newItems24h ||
                b._count.monitors - a._count.monitors,
        )
        .slice(0, 5);
    const importantLogs = adminLogs
        .filter(
            (log) =>
                log.status !== "success" ||
                log.type === "monitor" ||
                log.detail,
        )
        .slice(0, 6);
    const serverProxyLineCount = serverProxies
        .split("\n")
        .filter((line) => line.trim().length > 0).length;

    const getEffectiveLimit = (user: UserRow) => {
        if (user.role === "admin") {
            return { value: null, source: "Admin" };
        }

        const userLimit = monitorLimits.users[user.id];
        if (userLimit !== null && userLimit !== undefined) {
            return { value: userLimit, source: "User" };
        }

        const roleLimit = monitorLimits.roles[user.role];
        if (roleLimit !== null && roleLimit !== undefined) {
            return { value: roleLimit, source: "Role" };
        }

        if (monitorLimits.global !== null) {
            return { value: monitorLimits.global, source: "Global" };
        }

        return { value: null, source: "Unlimited" };
    };
    const limitedUsers = users.filter((user) => {
        const limit = getEffectiveLimit(user);
        return limit.value !== null && user.metrics.runningMonitors >= limit.value;
    });
    const userOverrides = users.filter(
        (user) =>
            monitorLimits.users[user.id] !== null &&
            monitorLimits.users[user.id] !== undefined,
    ).length;
    const roleLimitsConfigured = Object.values(monitorLimits.roles).filter(
        (value) => value !== null && value !== undefined,
    ).length;
    const activeMonitorShare =
        totalMonitors > 0 ? Math.round((runningMonitors / totalMonitors) * 100) : 0;

    const hydrateUserDetails = async (user: UserRow) => {
        if (user.monitors.length > 0 || user._count.monitors === 0) {
            return user;
        }

        setLoadingUserDetailsId(user.id);
        const monitors = await getAdminUserDetails(user.id);
        const hydratedUser = { ...user, monitors };

        setUsers((prev) =>
            prev.map((current) =>
                current.id === user.id ? hydratedUser : current,
            ),
        );

        return hydratedUser;
    };

    const openUserDetails = (user: UserRow) => {
        setSelected(user);
        setPendingRole(user.role);
        setUserLimitInput(limitInputValue(monitorLimits.users[user.id]));
        setIsDetailsOpen(true);

        hydrateUserDetails(user)
            .then((hydratedUser) => {
                setSelected((current) =>
                    current?.id === hydratedUser.id ? hydratedUser : current,
                );
            })
            .catch(() => {
                toast.error("Failed to load user monitor details");
            })
            .finally(() => setLoadingUserDetailsId(null));
    };

    const openRoleDialog = (user: UserRow) => {
        setSelected(user);
        setPendingRole(user.role);
        setIsOpen(true);
    };

    const markUserMonitorsStopped = (
        user: UserRow,
        monitorId: number | null = null,
    ): UserRow => {
        const stoppedCount =
            monitorId === null && user.monitors.length === 0
                ? user.metrics.runningMonitors
                : user.monitors.filter(
                      (monitor) =>
                          monitor.status === "active" &&
                          (monitorId === null || monitor.id === monitorId),
                  ).length;

        if (stoppedCount === 0) return user;

        return {
            ...user,
            monitors: user.monitors.map((monitor) =>
                monitor.status === "active" &&
                (monitorId === null || monitor.id === monitorId)
                    ? { ...monitor, status: "paused" }
                    : monitor,
            ),
            metrics: {
                ...user.metrics,
                runningMonitors: Math.max(
                    0,
                    user.metrics.runningMonitors - stoppedCount,
                ),
                pausedMonitors: user.metrics.pausedMonitors + stoppedCount,
            },
        };
    };

    const handleSave = async () => {
        if (!selected || pendingRole === selected.role) {
            setIsOpen(false);
            return;
        }

        const prevRole = selected.role;
        setUsers((prev) =>
            prev.map((u) =>
                u.id === selected.id ? { ...u, role: pendingRole } : u,
            ),
        );
        setSelected((prev) =>
            prev?.id === selected.id ? { ...prev, role: pendingRole } : prev,
        );
        setIsOpen(false);

        toast.promise(setUserRole(selected.id, pendingRole), {
            loading: "Updating role...",
            success: `${selected.name ?? "User"} is now ${pendingRole}`,
            error: () => {
                setUsers((prev) =>
                    prev.map((u) =>
                        u.id === selected.id ? { ...u, role: prevRole } : u,
                    ),
                );
                setSelected((prev) =>
                    prev?.id === selected.id
                        ? { ...prev, role: prevRole }
                        : prev,
                );
                return "Failed to update role";
            },
        });
    };

    const handleSaveGlobalLimit = async () => {
        const previous = monitorLimits.global;
        const next = globalLimitInput.trim()
            ? Number(globalLimitInput.trim())
            : null;

        setMonitorLimits((prev) => ({ ...prev, global: next }));
        try {
            await setGlobalActiveMonitorLimit(globalLimitInput);
            toast.success("Global monitor limit saved");
        } catch (error) {
            setMonitorLimits((prev) => ({ ...prev, global: previous }));
            setGlobalLimitInput(limitInputValue(previous));
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to save global monitor limit",
            );
        }
    };

    const handleSaveRoleLimit = async (role: string) => {
        const previous = monitorLimits.roles[role] ?? null;
        const input = roleLimitInputs[role] ?? "";
        const next = input.trim() ? Number(input.trim()) : null;

        setMonitorLimits((prev) => ({
            ...prev,
            roles: { ...prev.roles, [role]: next },
        }));
        try {
            await setRoleActiveMonitorLimit(role, input);
            toast.success(`${role} monitor limit saved`);
        } catch (error) {
            setMonitorLimits((prev) => ({
                ...prev,
                roles: { ...prev.roles, [role]: previous },
            }));
            setRoleLimitInputs((prev) => ({
                ...prev,
                [role]: limitInputValue(previous),
            }));
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to save role monitor limit",
            );
        }
    };

    const handleSaveUserLimit = async () => {
        if (!selected) return;

        const previous = monitorLimits.users[selected.id] ?? null;
        const next = userLimitInput.trim() ? Number(userLimitInput.trim()) : null;

        setMonitorLimits((prev) => ({
            ...prev,
            users: { ...prev.users, [selected.id]: next },
        }));
        try {
            await setUserActiveMonitorLimit(selected.id, userLimitInput);
            toast.success("User monitor limit saved");
        } catch (error) {
            setMonitorLimits((prev) => ({
                ...prev,
                users: { ...prev.users, [selected.id]: previous },
            }));
            setUserLimitInput(limitInputValue(previous));
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to save user monitor limit",
            );
        }
    };

    const handleStopUserMonitors = async () => {
        if (!selected) return;

        setIsStoppingMonitors(true);

        try {
            const result = await stopUserActiveMonitors(selected.id);

            setUsers((prev) =>
                prev.map((user) =>
                    user.id === selected.id
                        ? markUserMonitorsStopped(user)
                        : user,
                ),
            );

            setSelected((prev) =>
                prev ? markUserMonitorsStopped(prev) : prev,
            );

            toast.success(
                result.stoppedCount > 0
                    ? `${result.stoppedCount} monitor${result.stoppedCount === 1 ? "" : "s"} stopped`
                    : "No running monitors for this user",
            );
        } catch {
            toast.error("Failed to stop user monitors");
        } finally {
            setIsStoppingMonitors(false);
        }
    };

    const handleStopSingleMonitor = async (monitorId: number) => {
        if (!selected) return;

        setStoppingMonitorId(monitorId);

        try {
            const result = await stopSingleUserMonitor(selected.id, monitorId);

            if (result.stopped) {
                setUsers((prev) =>
                    prev.map((user) =>
                        user.id === selected.id
                            ? markUserMonitorsStopped(user, monitorId)
                            : user,
                    ),
                );

                setSelected((prev) =>
                    prev ? markUserMonitorsStopped(prev, monitorId) : prev,
                );

                toast.success("Monitor stopped");
            } else {
                toast.success("Monitor is already stopped");
            }
        } catch {
            toast.error("Failed to stop monitor");
        } finally {
            setStoppingMonitorId(null);
        }
    };

    const handleSaveServerProxies = async () => {
        const previous = serverProxies;
        const formData = new FormData();
        formData.set("proxies", serverProxies);
        setIsSavingServerProxies(true);

        try {
            const result = await updateServerProxies(formData);
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            const skippedCount = result.skippedCount ?? 0;
            toast.success(
                `Server proxies saved (${result.proxyCount} active${
                    skippedCount > 0 ? `, ${skippedCount} skipped` : ""
                })`,
            );
            setServerProxies(
                serverProxies
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .join("\n"),
            );
        } catch (error) {
            setServerProxies(previous);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to save server proxies",
            );
        } finally {
            setIsSavingServerProxies(false);
        }
    };

    const selectedActiveMonitors =
        selected?.monitors.filter((monitor) => monitor.status === "active") ??
        [];
    const selectedPausedMonitors =
        selected?.monitors.filter((monitor) => monitor.status !== "active") ??
        [];
    const selectedRunningMonitors =
        selected && selected.monitors.length > 0
            ? selectedActiveMonitors.length
            : (selected?.metrics.runningMonitors ?? 0);
    const selectedItems = selected?.metrics.totalItems ?? 0;
    const selectedEffectiveLimit = selected
        ? getEffectiveLimit(selected)
        : { value: null, source: "Unlimited" };
    const isLoadingSelectedDetails =
        selected !== null && loadingUserDetailsId === selected.id;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight">
                        Admin Panel
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Overview, users, roles, logs, and operational settings
                        in separate workspaces.
                    </p>
                </div>
            </div>

            <div
                role="tablist"
                aria-label="Admin sections"
                className="border-border/60 bg-card flex flex-wrap gap-1 rounded-xl border p-1 shadow-sm"
            >
                {ADMIN_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.value;

                    return (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            onClick={() => switchTab(tab.value)}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === "overview" ? (
                <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="border-border/60 from-card to-muted/30 bg-linear-to-br py-0">
                    <CardHeader className="pt-3 pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Total Users</CardDescription>
                            <div className="bg-primary/10 text-primary rounded-lg p-2">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl">{totalUsers}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground pb-6 text-xs">
                        Active accounts visible in this workspace.
                    </CardContent>
                </Card>

                <Card className="to-card border-amber-200/70 bg-linear-to-br from-amber-50 py-0 dark:border-amber-500/20 dark:from-amber-500/10">
                    <CardHeader className="pt-3 pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Premium</CardDescription>
                            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                                <Crown className="h-4 w-4" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">
                            {premiumUsers}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground pb-6 text-xs">
                        Users with access to server proxy features.
                    </CardContent>
                </Card>

                <Card className="to-card border-red-200/70 bg-linear-to-br from-red-50 py-0 dark:border-red-500/20 dark:from-red-500/10">
                    <CardHeader className="pt-3 pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Admins</CardDescription>
                            <div className="rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-400">
                                <Sparkles className="h-4 w-4" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl text-red-600 dark:text-red-400">
                            {adminUsers}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground pb-6 text-xs">
                        Full dashboard access including role management.
                    </CardContent>
                </Card>

                <Card className="to-card border-emerald-200/70 bg-linear-to-br from-emerald-50 py-0 dark:border-emerald-500/20 dark:from-emerald-500/10">
                    <CardHeader className="pt-3 pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Running</CardDescription>
                            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">
                            {runningMonitors}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground pb-6 text-xs">
                        Monitors currently marked active.
                    </CardContent>
                </Card>

                <Card className="to-card border-sky-200/70 bg-linear-to-br from-sky-50 py-0 dark:border-sky-500/20 dark:from-sky-500/10">
                    <CardHeader className="pt-3 pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>24h Items</CardDescription>
                            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                                <Boxes className="h-4 w-4" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl text-sky-600 dark:text-sky-400">
                            {newItems24h}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground pb-6 text-xs">
                        {failedChecks24h} failed checks in the same window.
                    </CardContent>
                </Card>
            </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="border-border/60 bg-card flex h-full flex-col rounded-2xl border p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-foreground text-sm font-semibold">
                                        Monitor Health
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Current monitor mix and 24h worker
                                        activity.
                                    </p>
                                </div>
                                <Badge
                                    variant={
                                        failedChecks24h > 0
                                            ? "outline"
                                            : "secondary"
                                    }
                                    className="rounded-md text-[10px] uppercase"
                                >
                                    {failedChecks24h > 0
                                        ? `${failedChecks24h} failures`
                                        : "Healthy"}
                                </Badge>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="border-border/60 rounded-xl border px-4 py-3">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                        Total monitors
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold">
                                        {totalMonitors}
                                    </p>
                                </div>
                                <div className="border-border/60 rounded-xl border px-4 py-3">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                        Paused
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold">
                                        {pausedMonitors}
                                    </p>
                                </div>
                                <div className="border-border/60 rounded-xl border px-4 py-3">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                        Checks 24h
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold">
                                        {checks24h}
                                    </p>
                                </div>
                                <div className="border-border/60 rounded-xl border px-4 py-3">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                        Success rate
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold">
                                        {formatSuccessRate(successRate24h)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="bg-muted/30 rounded-xl px-4 py-3">
                                    <p className="text-muted-foreground text-xs">
                                        Lifetime items
                                    </p>
                                    <p className="mt-1 text-xl font-semibold">
                                        {totalItems}
                                    </p>
                                </div>
                                <div className="bg-muted/30 rounded-xl px-4 py-3">
                                    <p className="text-muted-foreground text-xs">
                                        New items 24h
                                    </p>
                                    <p className="mt-1 text-xl font-semibold">
                                        {newItems24h}
                                    </p>
                                </div>
                                <div className="bg-muted/30 rounded-xl px-4 py-3">
                                    <p className="text-muted-foreground text-xs">
                                        Server proxies
                                    </p>
                                    <p className="mt-1 text-xl font-semibold">
                                        {serverProxyLineCount}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex-1 rounded-xl border px-4 py-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-muted-foreground text-xs font-medium">
                                        Running capacity
                                    </p>
                                    <p className="text-foreground text-sm font-semibold">
                                        {activeMonitorShare}%
                                    </p>
                                </div>
                                <div className="bg-muted h-2 overflow-hidden rounded-full">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{
                                            width: `${activeMonitorShare}%`,
                                        }}
                                    />
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-500/10">
                                        <span className="text-emerald-700 dark:text-emerald-300">
                                            Running
                                        </span>
                                        <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                                            {runningMonitors}
                                        </span>
                                    </div>
                                    <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs">
                                        <span className="text-muted-foreground">
                                            Paused
                                        </span>
                                        <span className="font-semibold">
                                            {pausedMonitors}
                                        </span>
                                    </div>
                                    <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs">
                                        <span className="text-muted-foreground">
                                            Failed checks
                                        </span>
                                        <span className="font-semibold">
                                            {failedChecks24h}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-border/60 bg-card rounded-2xl border p-5 shadow-sm">
                            <div className="mb-4">
                                <p className="text-foreground text-sm font-semibold">
                                    Limits & Capacity
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    Active monitor limits that need admin
                                    attention.
                                </p>
                            </div>
                            <div className="space-y-3">
                                {[
                                    ["Users at limit", limitedUsers.length],
                                    ["User overrides", userOverrides],
                                    ["Role limits", roleLimitsConfigured],
                                ].map(([label, count]) => (
                                    <div
                                        key={label}
                                        className="flex items-center justify-between rounded-xl border px-4 py-3"
                                    >
                                        <span className="text-sm font-medium">
                                            {label}
                                        </span>
                                        <span className="text-muted-foreground text-sm">
                                            {count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {limitedUsers.length > 0 ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                        {limitedUsers.length} user
                                        {limitedUsers.length === 1 ? "" : "s"} at
                                        active monitor capacity
                                    </p>
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                        Review role or user overrides in the
                                        Roles tab.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-muted-foreground mt-4 rounded-xl border px-4 py-3 text-xs">
                                    No users are currently blocked by active
                                    monitor limits.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm">
                            <div className="border-border/60 border-b px-5 py-4">
                                <p className="text-foreground text-sm font-semibold">
                                    Top Active Users
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    Sorted by running monitors and 24h item
                                    output.
                                </p>
                            </div>
                            <div className="divide-border/50 divide-y">
                                {topUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        className="hover:bg-muted/40 flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors"
                                        onClick={() => openUserDetails(user)}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-foreground truncate text-sm font-medium">
                                                {user.name ?? "Unknown"}
                                            </p>
                                            <p className="text-muted-foreground truncate text-xs">
                                                {user.email ?? "No email"}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs">
                                            <p className="text-foreground font-semibold">
                                                {user.metrics.runningMonitors}{" "}
                                                running
                                            </p>
                                            <p className="text-muted-foreground">
                                                {user.metrics.newItems24h} items
                                                / 24h
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm">
                            <div className="border-border/60 border-b px-5 py-4">
                                <p className="text-foreground text-sm font-semibold">
                                    Recent Important Events
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    Failures and monitor events without the
                                    successful alert noise.
                                </p>
                            </div>
                            {importantLogs.length > 0 ? (
                                <div className="divide-border/50 divide-y">
                                    {importantLogs.map((log) => (
                                        <div key={log.id} className="px-5 py-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-md text-[10px] uppercase"
                                                >
                                                    {log.type}
                                                </Badge>
                                                <span className="text-foreground text-sm font-medium">
                                                    {log.title}
                                                </span>
                                                <span className="text-muted-foreground ml-auto text-xs">
                                                    {formatMetricDate(
                                                        log.createdAt,
                                                    )}
                                                </span>
                                            </div>
                                            <p className="text-muted-foreground mt-1 truncate text-xs">
                                                {log.detail ??
                                                    log.subject ??
                                                    log.actor ??
                                                    "No detail"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted-foreground px-5 py-8 text-center text-sm">
                                    No important events right now.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : null}

            {activeTab === "users" ? (
            <div className="border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm">
                <div className="border-border/60 flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-foreground text-sm font-semibold">
                            Team Members
                        </p>
                        <p className="text-muted-foreground text-xs">
                            {filteredUsers.length} of {totalUsers} users shown
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
                        <div className="relative flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setUserPage(1);
                                }}
                                placeholder="Search by name, email or role..."
                                className="h-10 pl-9"
                            />
                        </div>
                        {normalizedQuery ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 self-start px-3 text-xs sm:self-auto"
                                onClick={() => setSearchQuery("")}
                            >
                                Clear search
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/30">
                            <tr className="border-border border-b">
                                <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                    User
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                    Role
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-center text-[11px] font-medium tracking-wider uppercase">
                                    Monitors
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-center text-[11px] font-medium tracking-wider uppercase">
                                    24h Activity
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-center text-[11px] font-medium tracking-wider uppercase">
                                    Limit
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-center text-[11px] font-medium tracking-wider uppercase">
                                    Proxy Groups
                                </th>
                                <th className="text-muted-foreground px-5 py-3 text-right text-[11px] font-medium tracking-wider uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-border/50 divide-y">
                            {paginatedUsers.map((user) => {
                                const effectiveLimit = getEffectiveLimit(user);
                                return (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                                        onClick={() => openUserDetails(user)}
                                    >
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            {user.image ? (
                                                <img
                                                    src={user.image}
                                                    alt=""
                                                    className="h-10 w-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold">
                                                    {user.name?.[0]?.toUpperCase() ??
                                                        "?"}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-foreground truncate text-sm font-medium">
                                                    {user.name ?? "Unknown"}
                                                </p>
                                                <p className="text-muted-foreground truncate text-xs">
                                                    {user.email ?? "—"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-foreground inline-flex items-center gap-1 text-sm">
                                                <Monitor className="text-muted-foreground h-3.5 w-3.5" />
                                                {user._count.monitors}
                                            </span>
                                            <span className="text-muted-foreground text-[10px] uppercase">
                                                {user.metrics.runningMonitors}{" "}
                                                running
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-foreground inline-flex items-center gap-1 text-sm">
                                                <Activity className="text-muted-foreground h-3.5 w-3.5" />
                                                {user.metrics.checks24h} checks
                                            </span>
                                            <span
                                                className={`text-[10px] uppercase ${
                                                    user.metrics
                                                        .failedChecks24h > 0
                                                        ? "text-amber-600 dark:text-amber-400"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {user.metrics.newItems24h} items
                                                /{" "}
                                                {
                                                    user.metrics
                                                        .failedChecks24h
                                                }{" "}
                                                failed
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-foreground text-sm">
                                                {formatLimit(
                                                    effectiveLimit.value,
                                                )}
                                            </span>
                                            <span className="text-muted-foreground text-[10px] uppercase">
                                                {effectiveLimit.source}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <span className="text-foreground inline-flex items-center gap-1 text-sm">
                                            <Globe className="text-muted-foreground h-3.5 w-3.5" />
                                            {user._count.proxy_groups}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {user.id === currentUserId ? (
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full text-[10px] tracking-wide uppercase"
                                                >
                                                    You
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-lg text-xs"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openRoleDialog(user);
                                                    }}
                                                >
                                                    Change Role
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground h-8 rounded-lg px-2 text-xs"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openUserDetails(user);
                                                }}
                                            >
                                                Details
                                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                    </tr>
                                );
                            })}
                            {paginatedUsers.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-12 text-center"
                                    >
                                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                                            <div className="bg-muted text-muted-foreground rounded-full p-3">
                                                <Search className="h-5 w-5" />
                                            </div>
                                            <p className="text-foreground text-sm font-medium">
                                                No users match your search
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                Try a different name, email
                                                address, or role.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
                <div className="border-border/60 flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-muted-foreground text-xs">
                        Showing {shownUserStart}-{shownUserEnd} of{" "}
                        {filteredUsers.length} users
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-muted-foreground flex items-center gap-2 text-xs">
                            Rows
                            <select
                                value={usersPerPage}
                                onChange={(event) => {
                                    setUsersPerPage(
                                        Number(
                                            event.target.value,
                                        ) as (typeof USER_PAGE_SIZES)[number],
                                    );
                                    setUserPage(1);
                                }}
                                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                            >
                                {USER_PAGE_SIZES.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() =>
                                setUserPage((page) => Math.max(1, page - 1))
                            }
                            disabled={currentUserPage === 1}
                            aria-label="Previous user page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-muted-foreground min-w-20 text-center text-xs">
                            Page {currentUserPage} / {totalUserPages}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() =>
                                setUserPage((page) =>
                                    Math.min(totalUserPages, page + 1),
                                )
                            }
                            disabled={currentUserPage === totalUserPages}
                            aria-label="Next user page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            ) : null}

            {activeTab === "roles" ? (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        {ROLES.map((role) => {
                            const count =
                                role.value === "free"
                                    ? freeUsers
                                    : role.value === "premium"
                                      ? premiumUsers
                                      : adminUsers;
                            const Icon = role.icon;

                            return (
                                <Card key={role.value} className="py-0">
                                    <CardHeader className="pt-3 pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardDescription>
                                                {role.label}
                                            </CardDescription>
                                            <div className="bg-muted text-muted-foreground rounded-lg p-2">
                                                <Icon className="h-4 w-4" />
                                            </div>
                                        </div>
                                        <CardTitle className="text-3xl">
                                            {count}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground pb-6 text-xs">
                                        {role.value === "free" &&
                                            "Standard accounts with personal proxy requirements."}
                                        {role.value === "premium" &&
                                            "Accounts with shared server proxy access."}
                                        {role.value === "admin" &&
                                            "Accounts with full dashboard and admin access."}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="border-border/60 bg-card rounded-2xl border p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-foreground text-sm font-semibold">
                            Active Monitor Limits
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Empty values mean unlimited. Existing running
                            monitors are not paused automatically.
                        </p>
                    </div>
                    <div className="bg-primary/10 text-primary rounded-lg p-2">
                        <Gauge className="h-4 w-4" />
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                    <div className="space-y-2">
                        <Label htmlFor="global-monitor-limit">
                            Global default
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="global-monitor-limit"
                                type="number"
                                min={0}
                                value={globalLimitInput}
                                onChange={(event) =>
                                    setGlobalLimitInput(event.target.value)
                                }
                                placeholder="Unlimited"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSaveGlobalLimit}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    {LIMIT_ROLES.map((role) => (
                        <div key={role.value} className="space-y-2">
                            <Label htmlFor={`role-monitor-limit-${role.value}`}>
                                {role.label}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id={`role-monitor-limit-${role.value}`}
                                    type="number"
                                    min={0}
                                    value={roleLimitInputs[role.value] ?? ""}
                                    onChange={(event) =>
                                        setRoleLimitInputs((prev) => ({
                                            ...prev,
                                            [role.value]: event.target.value,
                                        }))
                                    }
                                    placeholder="Global"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        handleSaveRoleLimit(role.value)
                                    }
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
                </>
            ) : null}

            {activeTab === "logs" ? (
                <div className="border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm">
                    <div className="border-border/60 flex flex-col gap-1 border-b px-5 py-4">
                        <p className="text-foreground text-sm font-semibold">
                            Admin Logs
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Latest audit, monitor, and alert events.
                        </p>
                    </div>
                    {isLoadingLogs ? (
                        <div className="text-muted-foreground px-5 py-12 text-center text-sm">
                            Loading admin logs...
                        </div>
                    ) : adminLogs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/30">
                                    <tr className="border-border border-b">
                                        <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                            Event
                                        </th>
                                        <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                            Subject
                                        </th>
                                        <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                            Actor
                                        </th>
                                        <th className="text-muted-foreground px-5 py-3 text-left text-[11px] font-medium tracking-wider uppercase">
                                            Status
                                        </th>
                                        <th className="text-muted-foreground px-5 py-3 text-right text-[11px] font-medium tracking-wider uppercase">
                                            Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border/50 divide-y">
                                    {adminLogs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="px-5 py-3.5">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className="rounded-md text-[10px] uppercase"
                                                        >
                                                            {log.type}
                                                        </Badge>
                                                        <p className="text-foreground text-sm font-medium">
                                                            {log.title}
                                                        </p>
                                                    </div>
                                                    {log.detail ? (
                                                        <p className="text-muted-foreground max-w-xl truncate text-xs">
                                                            {log.detail}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="text-muted-foreground px-5 py-3.5 text-sm">
                                                {log.subject ?? "-"}
                                            </td>
                                            <td className="text-muted-foreground px-5 py-3.5 text-sm">
                                                {log.actor ?? "-"}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge
                                                    variant="secondary"
                                                    className="rounded-md text-[10px] uppercase"
                                                >
                                                    {log.status}
                                                </Badge>
                                            </td>
                                            <td className="text-muted-foreground px-5 py-3.5 text-right text-xs">
                                                {formatMetricDate(log.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-muted-foreground px-5 py-12 text-center text-sm">
                            No admin logs found yet.
                        </div>
                    )}
                </div>
            ) : null}

            {activeTab === "settings" ? (
                <div className="border-border/60 bg-card rounded-2xl border p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <p className="text-foreground text-sm font-semibold">
                                Server Proxies
                            </p>
                            <p className="text-muted-foreground text-xs">
                                Premium and admin monitors use this shared proxy
                                pool when Server Proxies is selected.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 self-start rounded-xl"
                            onClick={() => setIsProxyDialogOpen(true)}
                        >
                            <Server className="mr-2 h-4 w-4" />
                            Manage Proxies
                        </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="border-border/60 rounded-xl border px-4 py-3">
                            <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                Active lines
                            </p>
                            <p className="mt-1 text-2xl font-semibold">
                                {serverProxyLineCount}
                            </p>
                        </div>
                        <div className="border-border/60 rounded-xl border px-4 py-3">
                            <p className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
                                Sync
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Worker refreshes this setting every sync cycle.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change Role</DialogTitle>
                        <DialogDescription>
                            Update role for{" "}
                            <strong>{selected?.name ?? "User"}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        {ROLES.map((role) => (
                            <button
                                key={role.value}
                                onClick={() => setPendingRole(role.value)}
                                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                    pendingRole === role.value
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/50 hover:bg-muted"
                                }`}
                            >
                                <role.icon
                                    className={`h-5 w-5 ${
                                        pendingRole === role.value
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    }`}
                                />
                                <div>
                                    <p className="text-foreground text-sm font-medium">
                                        {role.label}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {role.value === "free" &&
                                            "Standard access, must use own proxies"}
                                        {role.value === "premium" &&
                                            "Can use server proxies"}
                                        {role.value === "admin" &&
                                            "Full access + user management"}
                                    </p>
                                </div>
                                {pendingRole === role.value && (
                                    <div className="bg-primary ml-auto h-2 w-2 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isProxyDialogOpen}
                onOpenChange={setIsProxyDialogOpen}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Server Proxies</DialogTitle>
                        <DialogDescription>
                            Used by premium and admin monitors when they select
                            Server Proxies. One proxy per line.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <textarea
                            value={serverProxies}
                            onChange={(event) =>
                                setServerProxies(event.target.value)
                            }
                            spellCheck={false}
                            placeholder="http://user:pass@host:port&#10;host:port:user:pass"
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-72 w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-muted-foreground text-xs">
                            Current input contains {serverProxyLineCount}{" "}
                            non-empty lines. The worker refreshes this setting
                            every sync cycle.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsProxyDialogOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveServerProxies}
                            disabled={isSavingServerProxies}
                        >
                            {isSavingServerProxies
                                ? "Saving..."
                                : "Save Proxies"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>User Details</DialogTitle>
                        <DialogDescription>
                            Overview, monitor activity, and quick admin actions
                            for <strong>{selected?.name ?? "User"}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {selected ? (
                        <div className="space-y-6">
                            <div className="border-border/60 bg-muted/20 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-center gap-3">
                                    {selected.image ? (
                                        <img
                                            src={selected.image}
                                            alt=""
                                            className="h-14 w-14 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-full text-base font-bold">
                                            {selected.name?.[0]?.toUpperCase() ??
                                                "?"}
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-foreground text-lg font-semibold">
                                                {selected.name ?? "Unknown"}
                                            </p>
                                            {getRoleBadge(selected.role)}
                                            {selected.id === currentUserId ? (
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full text-[10px] tracking-wide uppercase"
                                                >
                                                    You
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="text-muted-foreground text-sm">
                                            {selected.email ?? "No email"}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            User ID: {selected.id}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {selected.id !== currentUserId ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 rounded-lg text-xs"
                                            onClick={() =>
                                                openRoleDialog(selected)
                                            }
                                        >
                                            Change Role
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 rounded-lg text-xs text-amber-700 hover:text-amber-800"
                                        onClick={handleStopUserMonitors}
                                        disabled={
                                            isLoadingSelectedDetails ||
                                            selectedRunningMonitors === 0 ||
                                            isStoppingMonitors
                                        }
                                    >
                                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Stop Running Monitors
                                    </Button>
                                </div>
                            </div>

                            <div className="border-border/60 bg-card rounded-xl border px-4 py-4 sm:px-5">
                                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-center">
                                    <div className="min-w-0 space-y-3">
                                        <div>
                                            <p className="text-foreground text-sm font-semibold">
                                                Active Monitor Limit
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                Empty override uses the role or
                                                global fallback.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge
                                                variant="outline"
                                                className="rounded-md px-2 py-1 text-[11px]"
                                            >
                                                Effective:{" "}
                                                {formatLimit(
                                                    selectedEffectiveLimit.value,
                                                )}
                                            </Badge>
                                            <Badge
                                                variant="secondary"
                                                className="rounded-md px-2 py-1 text-[11px]"
                                            >
                                                Source:{" "}
                                                {selectedEffectiveLimit.source}
                                            </Badge>
                                            <Badge
                                                variant="secondary"
                                                className="rounded-md px-2 py-1 text-[11px]"
                                            >
                                                Running:{" "}
                                                {
                                                    selectedRunningMonitors
                                                }
                                            </Badge>
                                        </div>
                                    </div>
                                    {selected.role === "admin" ? (
                                        <div className="border-border/60 bg-muted/30 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
                                            Admin accounts are always unlimited.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="user-monitor-limit"
                                                className="text-xs"
                                            >
                                                User override
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="user-monitor-limit"
                                                    type="number"
                                                    min={0}
                                                    className="h-10"
                                                    value={userLimitInput}
                                                    onChange={(event) =>
                                                        setUserLimitInput(
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder="Role/global"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 shrink-0 px-4"
                                                    onClick={
                                                        handleSaveUserLimit
                                                    }
                                                >
                                                    Save
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Total Monitors
                                        </CardDescription>
                                        <CardTitle className="text-2xl">
                                            {selected._count.monitors}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Running Now
                                        </CardDescription>
                                        <CardTitle className="text-2xl text-emerald-600">
                                            {selectedRunningMonitors}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Paused Monitors
                                        </CardDescription>
                                        <CardTitle className="text-2xl">
                                            {selected.metrics.pausedMonitors}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Found Items
                                        </CardDescription>
                                        <CardTitle className="text-2xl">
                                            {selectedItems}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            New Items 24h
                                        </CardDescription>
                                        <CardTitle className="text-2xl text-sky-600">
                                            {selected.metrics.newItems24h}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Checks 24h
                                        </CardDescription>
                                        <CardTitle className="text-2xl">
                                            {selected.metrics.checks24h}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Success Rate
                                        </CardDescription>
                                        <CardTitle className="flex items-center gap-2 text-2xl">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                            {formatSuccessRate(
                                                selected.metrics.successRate24h,
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Failed Checks
                                        </CardDescription>
                                        <CardTitle className="flex items-center gap-2 text-2xl">
                                            <AlertTriangle
                                                className={`h-5 w-5 ${
                                                    selected.metrics
                                                        .failedChecks24h > 0
                                                        ? "text-amber-600"
                                                        : "text-muted-foreground"
                                                }`}
                                            />
                                            {selected.metrics.failedChecks24h}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="py-0">
                                    <CardHeader className="pt-3 pb-2">
                                        <CardDescription>
                                            Avg Duration
                                        </CardDescription>
                                        <CardTitle className="text-2xl">
                                            {formatDuration(
                                                selected.metrics
                                                    .avgDurationMs24h,
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            <div className="border-border/60 bg-card rounded-xl border px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">
                                            24h Monitor Health
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Last check:{" "}
                                            {formatMetricDate(
                                                selected.metrics.lastCheckAt,
                                            )}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            selected.metrics.failedChecks24h > 0
                                                ? "outline"
                                                : "secondary"
                                        }
                                        className="self-start sm:self-auto"
                                    >
                                        {selected.metrics.failedChecks24h > 0
                                            ? `${selected.metrics.failedChecks24h} failures`
                                            : "No recent failures"}
                                    </Badge>
                                </div>
                                {selected.metrics.latestError24h ? (
                                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                        {selected.metrics.latestError24h}
                                    </p>
                                ) : null}
                            </div>

                            <div className="border-border/60 bg-card rounded-2xl border">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <div>
                                        <p className="text-foreground text-sm font-semibold">
                                            Running Monitors
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {selectedRunningMonitors}{" "}
                                            currently active
                                        </p>
                                    </div>
                                </div>
                                <Separator />
                                {isLoadingSelectedDetails ? (
                                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                                        Loading monitor details...
                                    </div>
                                ) : selectedActiveMonitors.length > 0 ? (
                                    <div className="divide-border/50 divide-y">
                                        {selectedActiveMonitors.map(
                                            (monitor) => (
                                                <div
                                                    key={monitor.id}
                                                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-foreground text-sm font-medium">
                                                                {monitor.name}
                                                            </p>
                                                            <Badge className="bg-emerald-50 text-emerald-700">
                                                                Running
                                                            </Badge>
                                                            <Badge variant="outline">
                                                                #{monitor.id}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                            <span>
                                                                Query:{" "}
                                                                {monitor.query}
                                                            </span>
                                                            <span>
                                                                {getRegionLabel(
                                                                    monitor.region,
                                                                )}
                                                            </span>
                                                            <span>
                                                                {
                                                                    monitor.query_delay_ms
                                                                }{" "}
                                                                ms delay
                                                            </span>
                                                            <span>
                                                                {
                                                                    monitor
                                                                        ._count
                                                                        .items
                                                                }{" "}
                                                                items
                                                            </span>
                                                            <span>
                                                                {monitor
                                                                    .proxy_group
                                                                    ?.name ??
                                                                    "Server Proxies"}
                                                            </span>
                                                            {monitor.price_max ? (
                                                                <span>
                                                                    Max{" "}
                                                                    {
                                                                        monitor.price_max
                                                                    }{" "}
                                                                    EUR
                                                                </span>
                                                            ) : null}
                                                            <span>
                                                                {[
                                                                    monitor.discord_webhook &&
                                                                    monitor.webhook_active
                                                                        ? "Discord"
                                                                        : null,
                                                                    monitor.telegram_active
                                                                        ? "Telegram"
                                                                        : null,
                                                                ]
                                                                    .filter(
                                                                        Boolean,
                                                                    )
                                                                    .join(
                                                                        " + ",
                                                                    ) ||
                                                                    "Notifications off"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 shrink-0 text-xs text-amber-700 hover:text-amber-800"
                                                        onClick={() =>
                                                            handleStopSingleMonitor(
                                                                monitor.id,
                                                            )
                                                        }
                                                        disabled={
                                                            stoppingMonitorId ===
                                                            monitor.id
                                                        }
                                                    >
                                                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                                                        Stop Monitor
                                                    </Button>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                                        This user has no running monitors.
                                    </div>
                                )}
                            </div>

                            <div className="border-border/60 bg-card rounded-2xl border">
                                <div className="px-4 py-3">
                                    <p className="text-foreground text-sm font-semibold">
                                        All Monitors
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Running and paused monitors with key
                                        details.
                                    </p>
                                </div>
                                <Separator />
                                {isLoadingSelectedDetails ? (
                                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                                        Loading monitor details...
                                    </div>
                                ) : selected.monitors.length > 0 ? (
                                    <div className="divide-border/50 divide-y">
                                        {[
                                            ...selectedActiveMonitors,
                                            ...selectedPausedMonitors,
                                        ].map((monitor) => (
                                            <div
                                                key={monitor.id}
                                                className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                                            >
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-foreground text-sm font-medium">
                                                            {monitor.name}
                                                        </p>
                                                        <Badge
                                                            variant={
                                                                monitor.status ===
                                                                "active"
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                            className={
                                                                monitor.status ===
                                                                "active"
                                                                    ? "bg-emerald-50 text-emerald-700"
                                                                    : ""
                                                            }
                                                        >
                                                            {monitor.status ===
                                                            "active"
                                                                ? "Running"
                                                                : "Paused"}
                                                        </Badge>
                                                        <Badge variant="outline">
                                                            #{monitor.id}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                        <span>
                                                            Query:{" "}
                                                            {monitor.query}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock3 className="h-3.5 w-3.5" />
                                                            {formatCreatedAt(
                                                                monitor.created_at,
                                                            )}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Boxes className="h-3.5 w-3.5" />
                                                            {
                                                                monitor._count
                                                                    .items
                                                            }{" "}
                                                            items
                                                        </span>
                                                        <span>
                                                            {getRegionLabel(
                                                                monitor.region,
                                                            )}
                                                        </span>
                                                        <span>
                                                            {
                                                                monitor.query_delay_ms
                                                            }{" "}
                                                            ms delay
                                                        </span>
                                                        <span>
                                                            {monitor.proxy_group
                                                                ?.name ??
                                                                "Server Proxies"}
                                                        </span>
                                                        {monitor.price_min ||
                                                        monitor.price_max ? (
                                                            <span>
                                                                Price{" "}
                                                                {monitor.price_min ??
                                                                    0}
                                                                -
                                                                {monitor.price_max ??
                                                                    "any"}{" "}
                                                                EUR
                                                            </span>
                                                        ) : null}
                                                        <span className="inline-flex items-center gap-1">
                                                            <Webhook className="h-3.5 w-3.5" />
                                                            {[
                                                                monitor.discord_webhook
                                                                    ? monitor.webhook_active
                                                                        ? "Discord active"
                                                                        : "Discord paused"
                                                                    : null,
                                                                monitor.telegram_active
                                                                    ? "Telegram active"
                                                                    : null,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(" / ") ||
                                                                "No notifications"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0"
                                                >
                                                    {monitor.status === "active"
                                                        ? "Running"
                                                        : "Paused"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                                        This user has not created any monitors
                                        yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDetailsOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
