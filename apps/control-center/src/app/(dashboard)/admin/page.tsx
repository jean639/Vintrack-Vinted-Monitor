import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminClient } from "./client";
import { getFreeProxyAdminState } from "@/actions/admin";
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
    running_monitors?: bigint;
    paused_monitors?: bigint;
    total_items?: bigint;
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

    const [monitorRows, itemRows, runRows, errorRows] = await Promise.all([
        db.$queryRaw<CountRow[]>`
            SELECT
                "userId",
                COUNT(*) FILTER (WHERE status = 'active')::bigint AS running_monitors,
                COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'active')::bigint AS paused_monitors
            FROM monitors
            WHERE "userId" IN (${Prisma.join(userIds)})
            GROUP BY "userId"
        `.catch((error) => {
            console.error("[admin] failed to load monitor totals", error);
            return [];
        }),
        db.$queryRaw<CountRow[]>`
            SELECT
                m."userId",
                COUNT(i.id)::bigint AS total_items,
                COUNT(i.id) FILTER (
                    WHERE i.found_at >= NOW() - INTERVAL '24 hours'
                )::bigint AS new_items_24h
            FROM monitors m
            LEFT JOIN items i ON i.monitor_id = m.id
            WHERE m."userId" IN (${Prisma.join(userIds)})
            GROUP BY m."userId"
        `.catch((error) => {
            console.error("[admin] failed to load 24h item metrics", error);
            return [];
        }),
        db.$queryRaw<CountRow[]>`
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
        `.catch((error) => {
            console.error("[admin] failed to load 24h run metrics", error);
            return [];
        }),
        db.$queryRaw<LatestErrorRow[]>`
            SELECT DISTINCT ON (m."userId")
                m."userId",
                r.error_message AS latest_error_24h
            FROM monitors m
            INNER JOIN monitor_runs r ON r.monitor_id = m.id
            WHERE m."userId" IN (${Prisma.join(userIds)})
              AND r.checked_at >= NOW() - INTERVAL '24 hours'
              AND r.error_message IS NOT NULL
            ORDER BY m."userId", r.checked_at DESC
        `.catch((error) => {
            console.error(
                "[admin] failed to load latest monitor errors",
                error,
            );
            return [];
        }),
    ]);

    for (const row of monitorRows) {
        const current = metrics.get(row.userId) ?? emptyMetrics();
        current.runningMonitors = Number(row.running_monitors ?? 0);
        current.pausedMonitors = Number(row.paused_monitors ?? 0);
        metrics.set(row.userId, current);
    }

    for (const row of itemRows) {
        const current = metrics.get(row.userId) ?? emptyMetrics();
        current.totalItems = Number(row.total_items ?? 0);
        current.newItems24h = Number(row.new_items_24h ?? 0);
        metrics.set(row.userId, current);
    }

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

    for (const row of errorRows) {
        const current = metrics.get(row.userId) ?? emptyMetrics();
        current.latestError24h = row.latest_error_24h;
        metrics.set(row.userId, current);
    }

    return metrics;
}

export default async function AdminPage({
    searchParams,
}: {
    searchParams?: Promise<{ tab?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    if (session.user.role !== "admin") redirect("/dashboard");

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
        },
    });
    const roles = ["free", "premium"];
    const limitScopes = [
        GLOBAL_MONITOR_LIMIT_SCOPE,
        ...roles.map(roleLimitScope),
        ...users.map((user) => userLimitScope(user.id)),
    ];
    const [adminMetrics, limits, freeProxyState, serverProxyRows, params] =
        await Promise.all([
            getAdminUserMetrics(users.map((user) => user.id)),
            getMonitorLimits(limitScopes),
            getFreeProxyAdminState(),
            db.$queryRaw<{ value: string }[]>`
                SELECT value FROM app_settings WHERE key = ${"server_proxies"}
            `.catch((error) => {
                console.error("[admin] failed to load server proxies", error);
                return [];
            }),
            searchParams,
        ]);
    const usersWithMetrics = users.map((user) => {
        const metrics = adminMetrics.get(user.id) ?? emptyMetrics();

        return {
            ...user,
            monitors: [],
            metrics: {
                ...metrics,
            },
        };
    });

    const serverProxies = serverProxyRows[0]?.value ?? "";
    const initialTab = params?.tab;

    return (
        <AdminClient
            users={usersWithMetrics}
            logs={[]}
            initialTab={initialTab}
            currentUserId={session.user.id}
            serverProxies={serverProxies}
            freeProxyState={freeProxyState}
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
