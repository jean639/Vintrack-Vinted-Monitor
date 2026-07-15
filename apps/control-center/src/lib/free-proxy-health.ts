import { db } from "@/lib/db";

const DEFAULT_STARTER_REGIONS = "de,fr,it,es,nl,be,at";

export type FreeProxyRegionHealth = {
    region: string;
    active: number;
    warming: number;
    usable: number;
    pending: number;
    cooldown: number;
    dead: number;
    successRate: number | null;
    medianLatencyMs: number | null;
    lastCheckedAt: Date | null;
    healthy: boolean;
};

export type FreeProxyPoolHealth = {
    enabled: boolean;
    minActivePerRegion: number;
    regions: Record<string, FreeProxyRegionHealth>;
    activeCount: number;
};

type FreeProxyHealthRow = {
    region: string;
    active_count: bigint;
    warming_count: bigint;
    pending_count: bigint;
    cooldown_count: bigint;
    dead_count: bigint;
    success_count: bigint;
    failure_count: bigint;
    median_latency_ms: number | null;
    last_checked_at: Date | null;
};

export async function getFreeProxyPoolHealth(): Promise<FreeProxyPoolHealth> {
    const [setting, minActiveSetting, starterRegionsSetting, rows] =
        await Promise.all([
            db.app_settings.findUnique({
                where: { key: "free_proxy_enabled" },
                select: { value: true },
            }),
            db.app_settings.findUnique({
                where: { key: "free_proxy_min_active_per_region" },
                select: { value: true },
            }),
            db.app_settings.findUnique({
                where: { key: "free_proxy_starter_regions" },
                select: { value: true },
            }),
            db.$queryRaw<FreeProxyHealthRow[]>`
            SELECT
                region,
                COUNT(*) FILTER (WHERE status = 'active')::bigint AS active_count,
                COUNT(*) FILTER (WHERE status = 'pending' AND success_streak > 0)::bigint AS warming_count,
                COUNT(*) FILTER (WHERE status = 'pending' AND success_streak = 0)::bigint AS pending_count,
                COUNT(*) FILTER (WHERE status = 'cooldown')::bigint AS cooldown_count,
                COUNT(*) FILTER (WHERE status = 'dead')::bigint AS dead_count,
                COALESCE(SUM(success_count), 0)::bigint AS success_count,
                COALESCE(SUM(failure_count), 0)::bigint AS failure_count,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)
                    FILTER (WHERE latency_ms IS NOT NULL) AS median_latency_ms,
                MAX(last_checked_at) AS last_checked_at
            FROM free_proxy_health
            GROUP BY region
        `,
        ]);

    const minActivePerRegion = Number(minActiveSetting?.value ?? 25);
    const configuredRegions = (
        starterRegionsSetting?.value ?? DEFAULT_STARTER_REGIONS
    )
        .split(",")
        .map((region) => region.trim().toLowerCase())
        .filter(Boolean);
    const rowsByRegion = new Map(rows.map((row) => [row.region, row]));
    const regions = Object.fromEntries(
        configuredRegions.map((region) => {
            const row = rowsByRegion.get(region);
            if (!row) {
                const emptyHealth: FreeProxyRegionHealth = {
                    region,
                    active: 0,
                    warming: 0,
                    usable: 0,
                    pending: 0,
                    cooldown: 0,
                    dead: 0,
                    successRate: null,
                    medianLatencyMs: null,
                    lastCheckedAt: null,
                    healthy: false,
                };
                return [region, emptyHealth];
            }

            const active = Number(row.active_count);
            const warming = Number(row.warming_count);
            const usable = active + warming;
            const successCount = Number(row.success_count);
            const failureCount = Number(row.failure_count);
            const totalChecks = successCount + failureCount;
            const health: FreeProxyRegionHealth = {
                region: row.region,
                active,
                warming,
                usable,
                pending: Number(row.pending_count),
                cooldown: Number(row.cooldown_count),
                dead: Number(row.dead_count),
                successRate:
                    totalChecks > 0
                        ? Math.round((successCount / totalChecks) * 100)
                        : null,
                medianLatencyMs:
                    row.median_latency_ms === null
                        ? null
                        : Math.round(row.median_latency_ms),
                lastCheckedAt: row.last_checked_at,
                healthy: usable >= minActivePerRegion,
            };
            return [region, health];
        }),
    );

    return {
        enabled: setting?.value === "true",
        minActivePerRegion,
        regions,
        activeCount: regions.de?.usable ?? 0,
    };
}
