import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type MetricsRow = {
    total_checks: bigint;
    success_count: bigint;
    failed_count: bigint;
    avg_duration_ms: number | null;
    p95_duration_ms: number | null;
    new_item_count: bigint;
    last_error: string | null;
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const monitorId = Number(id);
    if (!Number.isInteger(monitorId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const monitor = await db.monitors.findFirst({
        where: { id: monitorId, userId: session.user.id },
        select: { id: true },
    });
    if (!monitor) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db.$queryRaw<MetricsRow[]>`
        WITH recent AS (
            SELECT status, duration_ms, new_item_count, error_message, checked_at
            FROM monitor_runs
            WHERE monitor_id = ${monitorId}
            ORDER BY checked_at DESC
            LIMIT 100
        )
        SELECT
            COUNT(*)::bigint AS total_checks,
            COUNT(*) FILTER (WHERE status = 'success')::bigint AS success_count,
            COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
            AVG(duration_ms)::float AS avg_duration_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::float AS p95_duration_ms,
            COALESCE(SUM(new_item_count), 0)::bigint AS new_item_count,
            (
                SELECT error_message
                FROM recent
                WHERE error_message IS NOT NULL
                ORDER BY checked_at DESC
                LIMIT 1
            ) AS last_error
        FROM recent
    `;
    const row = rows[0];
    const totalChecks = Number(row?.total_checks ?? 0);
    const successCount = Number(row?.success_count ?? 0);

    return NextResponse.json({
        window: "latest_100",
        totalChecks,
        successCount,
        failedCount: Number(row?.failed_count ?? 0),
        successRate:
            totalChecks > 0
                ? Math.round((successCount / totalChecks) * 100)
                : null,
        avgDurationMs:
            row?.avg_duration_ms === null || row?.avg_duration_ms === undefined
                ? null
                : Math.round(row.avg_duration_ms),
        p95DurationMs:
            row?.p95_duration_ms === null || row?.p95_duration_ms === undefined
                ? null
                : Math.round(row.p95_duration_ms),
        newItemCount: Number(row?.new_item_count ?? 0),
        lastError: row?.last_error ?? null,
    });
}
