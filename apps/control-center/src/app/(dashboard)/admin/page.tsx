import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminClient } from "./client";
import {
    GLOBAL_MONITOR_LIMIT_SCOPE,
    getMonitorLimits,
    roleLimitScope,
    userLimitScope,
} from "@/lib/monitor-limits";

export const dynamic = "force-dynamic";

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
                    status: true,
                    region: true,
                    created_at: true,
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

    const roles = ["free", "premium"];
    const limitScopes = [
        GLOBAL_MONITOR_LIMIT_SCOPE,
        ...roles.map(roleLimitScope),
        ...users.map((user) => userLimitScope(user.id)),
    ];
    const limits = await getMonitorLimits(limitScopes);

    return (
        <AdminClient
            users={users}
            currentUserId={session.user.id}
            monitorLimits={{
                global: limits.get(GLOBAL_MONITOR_LIMIT_SCOPE) ?? null,
                roles: Object.fromEntries(
                    roles.map((role) => [
                        role,
                        limits.get(roleLimitScope(role)) ?? null,
                    ]),
                ),
                users: Object.fromEntries(
                    users.map((user) => [
                        user.id,
                        limits.get(userLimitScope(user.id)) ?? null,
                    ]),
                ),
            }}
        />
    );
}
