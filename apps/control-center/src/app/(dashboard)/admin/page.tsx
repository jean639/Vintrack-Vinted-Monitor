import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminClient } from "./client";
import { Prisma } from "@prisma/client";
import {
    GLOBAL_MONITOR_LIMIT_SCOPE,
    getMonitorLimits,
    roleLimitScope,
    userLimitScope,
} from "@/lib/monitor-limits";

export const dynamic = "force-dynamic";

type CountRow = {
    userId: string;
    new_items_24h?: bigint;
    checks_24h?: bigint;
    successful_checks_24h?: bigint;
    failed_checks_24h?: bigint;
    avg_duration_ms_24h?: number | null;
    last_check_at?: Date | null;
};

type LatestErrorRow = {
    userId: string;
    latest_error_24h: string | null;
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

function emptyMetrics(): AdminUserMetrics {
    return {
        runningMonitors: 0,
        pausedMonitors: 0,
        totalItems: 0,
        newItems24h: 0,
        checks24h: 0,
        successfulChecks24h: 0,
        failedChecks24h: 0,
        successRate24h: null,
        avgDurationMs24h: null,
        lastCheckAt: null,
        latestError24h: null,
    };
}

async function getAdminUserMetrics(userIds: string[]) {
    const metrics = new Map<string, AdminUserMetrics>(
        userIds.map((userId) => [userId, emptyMetrics()]),
    );

    if (userIds.length === 0) return metrics;

    try {
        const itemRows = await db.$queryRaw<CountRow[]>`
            SELECT
                m."userId",
                COUNT(i.id) FILTER (
                    WHERE i.found_at >= NOW() - INTERVAL '24 hours'
                )::bigint AS new_items_24h
            FROM monitors m
            LEFT JOIN items i ON i.monitor_id = m.id
            WHERE m."userId" IN (${Prisma.join(userIds)})
            GROUP BY m."userId"
        `;

        for (const row of itemRows) {
            const current = metrics.get(row.userId) ?? emptyMetrics();
            current.newItems24h = Number(row.new_items_24h ?? 0);
            metrics.set(row.userId, current);
        }
    } catch (error) {
        console.error("[admin] failed to load 24h item metrics", error);
    }

    try {
        const runRows = await db.$queryRaw<CountRow[]>`
            SELECT
                m."userId",
                COUNT(r.id)::bigint AS checks_24h,
                COUNT(r.id) FILTER (WHERE r.status = 'success')::bigint AS successful_checks_24h,
                COUNT(r.id) FILTER (WHERE r.status = 'failed')::bigint AS failed_checks_24h,
                AVG(r.duration_ms)::float AS avg_duration_ms_24h,
                MAX(r.checked_at) AS last_check_at
            FROM monitors m
            LEFT JOIN monitor_runs r
                ON r.monitor_id = m.id
                AND r.checked_at >= NOW() - INTERVAL '24 hours'
            WHERE m."userId" IN (${Prisma.join(userIds)})
            GROUP BY m."userId"
        `;

        for (const row of runRows) {
            const current = metrics.get(row.userId) ?? emptyMetrics();
            const checks = Number(row.checks_24h ?? 0);
            const successful = Number(row.successful_checks_24h ?? 0);
            current.checks24h = checks;
            current.successfulChecks24h = successful;
            current.failedChecks24h = Number(row.failed_checks_24h ?? 0);
            current.successRate24h =
                checks > 0 ? Math.round((successful / checks) * 100) : null;
            current.avgDurationMs24h =
                row.avg_duration_ms_24h === null ||
                row.avg_duration_ms_24h === undefined
                    ? null
                    : Math.round(row.avg_duration_ms_24h);
            current.lastCheckAt = row.last_check_at ?? null;
            metrics.set(row.userId, current);
        }
    } catch (error) {
        console.error("[admin] failed to load 24h run metrics", error);
    }

    try {
        const errorRows = await db.$queryRaw<LatestErrorRow[]>`
            SELECT DISTINCT ON (m."userId")
                m."userId",
                r.error_message AS latest_error_24h
            FROM monitors m
            INNER JOIN monitor_runs r ON r.monitor_id = m.id
            WHERE m."userId" IN (${Prisma.join(userIds)})
              AND r.checked_at >= NOW() - INTERVAL '24 hours'
              AND r.error_message IS NOT NULL
            ORDER BY m."userId", r.checked_at DESC
        `;

        for (const row of errorRows) {
            const current = metrics.get(row.userId) ?? emptyMetrics();
            current.latestError24h = row.latest_error_24h;
            metrics.set(row.userId, current);
        }
    } catch (error) {
        console.error("[admin] failed to load latest monitor errors", error);
    }

    return metrics;
}

export default async function AdminPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    });

    if (dbUser?.role !== "admin") redirect("/dashboard");

    const users = await db.user.findMany({
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            _count: {
                select: {
                    monitors: true,
                    proxy_groups: true,
                },
            },
            monitors: {
                orderBy: [{ status: "asc" }, { created_at: "desc" }],
                select: {
                    id: true,
                    name: true,
                    query: true,
                    query_delay_ms: true,
                    status: true,
                    region: true,
                    created_at: true,
                    price_min: true,
                    price_max: true,
                    discord_webhook: true,
                    webhook_active: true,
                    telegram_active: true,
                    proxy_group: {
                        select: {
                            name: true,
                        },
                    },
                    _count: {
                        select: {
                            items: true,
                        },
                    },
                },
            },
        },
    });
    const adminMetrics = await getAdminUserMetrics(users.map((user) => user.id));
    const usersWithMetrics = users.map((user) => {
        const metrics = adminMetrics.get(user.id) ?? emptyMetrics();
        const runningMonitors = user.monitors.filter(
            (monitor) => monitor.status === "active",
        ).length;
        const totalItems = user.monitors.reduce(
            (sum, monitor) => sum + monitor._count.items,
            0,
        );

        return {
            ...user,
            metrics: {
                ...metrics,
                runningMonitors,
                pausedMonitors: user.monitors.length - runningMonitors,
                totalItems,
            },
        };
    });

    const roles = ["free", "premium"];
    const limitScopes = [
        GLOBAL_MONITOR_LIMIT_SCOPE,
        ...roles.map(roleLimitScope),
        ...usersWithMetrics.map((user) => userLimitScope(user.id)),
    ];
    const limits = await getMonitorLimits(limitScopes);
    let serverProxies = "";
    try {
        const serverProxyRows = await db.$queryRaw<{ value: string }[]>`
            SELECT value FROM app_settings WHERE key = ${"server_proxies"}
        `;
        serverProxies = serverProxyRows[0]?.value ?? "";
    } catch (error) {
        console.error("[admin] failed to load server proxies", error);
    }

    return (
        <AdminClient
            users={usersWithMetrics}
            currentUserId={session.user.id}
            serverProxies={serverProxies}
            monitorLimits={{
                global: limits.get(GLOBAL_MONITOR_LIMIT_SCOPE) ?? null,
                roles: Object.fromEntries(
                    roles.map((role) => [
                        role,
                        limits.get(roleLimitScope(role)) ?? null,
                    ]),
                ),
                users: Object.fromEntries(
                    usersWithMetrics.map((user) => [
                        user.id,
                        limits.get(userLimitScope(user.id)) ?? null,
                    ]),
                ),
            }}
        />
    );
}
