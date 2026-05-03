import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCategoryLabelsForRegion } from "@/lib/categories.server";
import { redirect } from "next/navigation";
import { DashboardClient, type Monitor } from "./client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const rawMonitors = await db.monitors.findMany({
        where: { userId: session.user.id },
        orderBy: { created_at: "desc" },
        include: {
            _count: { select: { items: true } },
            proxy_group: { select: { name: true } },
        },
    });
    const userSettings = await db.user.findUnique({
        where: { id: session.user.id },
        select: { dedupe_monitor_alerts: true },
    });

    const monitors: Monitor[] = await Promise.all(
        rawMonitors.map(async (m) => ({
            id: m.id,
            name: m.name,
            query: m.query,
            query_delay_ms: m.query_delay_ms,
            status: m.status ?? "paused",
            price_max: m.price_max,
            catalog_ids: m.catalog_ids ?? null,
            category_labels: await getCategoryLabelsForRegion(
                m.catalog_ids,
                m.region ?? "de",
            ),
            brand_ids: m.brand_ids ?? null,
            color_ids: m.color_ids ?? null,
            status_ids: m.status_ids ?? null,
            size_id: m.size_id ?? null,
            region: m.region ?? "de",
            allowed_countries: m.allowed_countries ?? null,
            discord_webhook: m.discord_webhook ?? null,
            webhook_active: m.webhook_active ?? true,
            telegram_active: m.telegram_active ?? false,
            proxy_group_name: m.proxy_group?.name ?? null,
            _count: m._count,
            created_at: m.created_at
                ? m.created_at.toISOString()
                : new Date().toISOString(),
        })),
    );

    return (
        <DashboardClient
            initialMonitors={monitors}
            userName={session.user.name || "User"}
            initialDedupeMonitorAlerts={
                userSettings?.dedupe_monitor_alerts ?? false
            }
        />
    );
}
