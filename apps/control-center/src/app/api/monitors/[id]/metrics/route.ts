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
    saved_item_count: bigint;
    last_error: string | null;
};

type DetectionMetricsRow = {
    detection_count: bigint;
    early_detection_count: bigint;
    early_win_count: bigint;
    early_alert_count: bigint;
    median_early_lead_ms: number | null;
    p95_detect_to_alert_ms: number | null;
};

type PreindexExperimentRow = {
    experiment_detection_count: bigint;
    preindex_detection_count: bigint;
    preindex_win_count: bigint;
    avg_preindex_lead_ms: number | null;
    median_preindex_lead_ms: number | null;
    p95_preindex_lead_ms: number | null;
};

type PreindexHealthRow = {
    probe_count: bigint;
    hit_count: bigint;
    miss_count: bigint;
    issue_count: bigint;
    blocked_count: bigint;
    avg_duration_ms: number | null;
    p95_duration_ms: number | null;
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
        select: { id: true, region: true },
    });
    if (!monitor) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db.$queryRaw<MetricsRow[]>`
        WITH recent AS (
            SELECT status, duration_ms, error_message, checked_at
            FROM monitor_runs
            WHERE monitor_id = ${monitorId}
              AND fetch_source = 'canonical'
            ORDER BY checked_at DESC
            LIMIT 100
        ),
        bounds AS (
            SELECT MIN(checked_at) AS oldest_check_at
            FROM recent
        )
        SELECT
            COUNT(*)::bigint AS total_checks,
            COUNT(*) FILTER (WHERE status = 'success')::bigint AS success_count,
            COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
            AVG(duration_ms)::float AS avg_duration_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::float AS p95_duration_ms,
            (
                SELECT COUNT(*)::bigint
                FROM items i, bounds b
                WHERE i.monitor_id = ${monitorId}
                  AND b.oldest_check_at IS NOT NULL
                  AND i.found_at >= b.oldest_check_at
            ) AS saved_item_count,
            (
                SELECT error_message
                FROM recent
                WHERE error_message IS NOT NULL
                ORDER BY checked_at DESC
                LIMIT 1
            ) AS last_error
        FROM recent
    `;
    const detectionRows = await db.$queryRaw<DetectionMetricsRow[]>`
        WITH recent_raw AS (
            SELECT early_seen_at, canonical_seen_at, alert_sent_at
            FROM monitor_item_detections
            WHERE monitor_id = ${monitorId}
            ORDER BY created_at DESC
            LIMIT 500
        ),
        recent_detections AS (
            SELECT
                early_seen_at,
                canonical_seen_at,
                alert_sent_at,
                CASE
                    WHEN early_seen_at IS NULL THEN canonical_seen_at
                    WHEN canonical_seen_at IS NULL THEN early_seen_at
                    ELSE LEAST(early_seen_at, canonical_seen_at)
                END AS first_seen_at
            FROM recent_raw
        )
        SELECT
            COUNT(*)::bigint AS detection_count,
            COUNT(*) FILTER (WHERE early_seen_at IS NOT NULL)::bigint AS early_detection_count,
            COUNT(*) FILTER (
                WHERE early_seen_at IS NOT NULL
                  AND canonical_seen_at IS NOT NULL
                  AND early_seen_at < canonical_seen_at
            )::bigint AS early_win_count,
            COUNT(*) FILTER (
                WHERE early_seen_at IS NOT NULL
                  AND alert_sent_at IS NOT NULL
                  AND (
                    canonical_seen_at IS NULL
                    OR alert_sent_at < canonical_seen_at
                  )
            )::bigint AS early_alert_count,
            percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (
                    canonical_seen_at - early_seen_at
                )) * 1000
            ) FILTER (
                WHERE early_seen_at IS NOT NULL
                  AND canonical_seen_at IS NOT NULL
                  AND early_seen_at < canonical_seen_at
            )::float AS median_early_lead_ms,
            percentile_cont(0.95) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (
                    alert_sent_at - first_seen_at
                )) * 1000
            ) FILTER (
                WHERE alert_sent_at IS NOT NULL
                  AND first_seen_at IS NOT NULL
                  AND alert_sent_at >= first_seen_at
            )::float AS p95_detect_to_alert_ms
        FROM recent_detections
    `;
    const preindexExperimentRows = await db.$queryRaw<PreindexExperimentRow[]>`
        WITH experiment_bounds AS (
            SELECT GREATEST(
                NOW() - INTERVAL '14 days',
                COALESCE(MIN(first_seen_at), NOW())
            ) AS experiment_started_at
            FROM item_preindex_samples
            WHERE region = ${monitor.region}
        ),
        experiment_detections AS (
            SELECT
                d.item_id,
                p.first_seen_at AS preindex_seen_at,
                CASE
                    WHEN d.early_seen_at IS NULL THEN d.canonical_seen_at
                    WHEN d.canonical_seen_at IS NULL THEN d.early_seen_at
                    ELSE LEAST(d.early_seen_at, d.canonical_seen_at)
                END AS first_seen_at
            FROM monitor_item_detections d
            CROSS JOIN experiment_bounds b
            LEFT JOIN item_preindex_samples p
              ON p.region = ${monitor.region}
             AND p.item_id = d.item_id
            WHERE d.monitor_id = ${monitorId}
              AND d.created_at >= b.experiment_started_at
        ),
        experiment_leads AS (
            SELECT
                item_id,
                preindex_seen_at,
                first_seen_at,
                EXTRACT(EPOCH FROM (
                    first_seen_at - preindex_seen_at
                )) * 1000 AS lead_ms
            FROM experiment_detections
        )
        SELECT
            COUNT(e.item_id)::bigint AS experiment_detection_count,
            COUNT(e.item_id) FILTER (
                WHERE e.preindex_seen_at IS NOT NULL
            )::bigint AS preindex_detection_count,
            COUNT(e.item_id) FILTER (
                WHERE e.lead_ms > 0
            )::bigint AS preindex_win_count,
            AVG(e.lead_ms) FILTER (
                WHERE e.lead_ms > 0
            )::float AS avg_preindex_lead_ms,
            percentile_cont(0.5) WITHIN GROUP (
                ORDER BY e.lead_ms
            ) FILTER (
                WHERE e.lead_ms > 0
            )::float AS median_preindex_lead_ms,
            percentile_cont(0.95) WITHIN GROUP (
                ORDER BY e.lead_ms
            ) FILTER (
                WHERE e.lead_ms > 0
            )::float AS p95_preindex_lead_ms,
            b.experiment_started_at
        FROM experiment_bounds b
        LEFT JOIN experiment_leads e ON TRUE
        GROUP BY b.experiment_started_at
    `;
    const preindexHealthRows = await db.$queryRaw<PreindexHealthRow[]>`
        WITH recent AS (
            SELECT outcome, duration_ms
            FROM preindex_probe_runs
            WHERE region = ${monitor.region}
            ORDER BY checked_at DESC
            LIMIT 500
        )
        SELECT
            COUNT(*)::bigint AS probe_count,
            COUNT(*) FILTER (WHERE outcome = 'hit')::bigint AS hit_count,
            COUNT(*) FILTER (WHERE outcome = 'miss')::bigint AS miss_count,
            COUNT(*) FILTER (
                WHERE outcome NOT IN ('hit', 'miss')
            )::bigint AS issue_count,
            COUNT(*) FILTER (WHERE outcome = 'blocked')::bigint AS blocked_count,
            AVG(duration_ms)::float AS avg_duration_ms,
            percentile_cont(0.95) WITHIN GROUP (
                ORDER BY duration_ms
            )::float AS p95_duration_ms
        FROM recent
    `;
    const row = rows[0];
    const detectionRow = detectionRows[0];
    const preindexExperimentRow = preindexExperimentRows[0];
    const preindexHealthRow = preindexHealthRows[0];
    const totalChecks = Number(row?.total_checks ?? 0);
    const successCount = Number(row?.success_count ?? 0);
    const successRate =
        totalChecks > 0 ? Math.round((successCount / totalChecks) * 100) : null;
    const preindexDetectionCount = Number(
        preindexExperimentRow?.preindex_detection_count ?? 0,
    );
    const preindexWinCount = Number(
        preindexExperimentRow?.preindex_win_count ?? 0,
    );
    const preindexWinRate =
        preindexDetectionCount > 0
            ? Math.round((preindexWinCount / preindexDetectionCount) * 100)
            : null;
    const medianPreindexLeadMs =
        preindexExperimentRow?.median_preindex_lead_ms === null ||
        preindexExperimentRow?.median_preindex_lead_ms === undefined
            ? null
            : Math.round(preindexExperimentRow.median_preindex_lead_ms);
    const preindexTargetMatches = 25;
    const preindexReady = preindexDetectionCount >= preindexTargetMatches;
    const preindexQualified =
        preindexReady &&
        preindexWinRate !== null &&
        preindexWinRate >= 60 &&
        medianPreindexLeadMs !== null &&
        medianPreindexLeadMs >= 5000 &&
        successRate !== null &&
        successRate >= 98;

    return NextResponse.json({
        window: "latest_100",
        totalChecks,
        successCount,
        failedCount: Number(row?.failed_count ?? 0),
        successRate,
        avgDurationMs:
            row?.avg_duration_ms === null || row?.avg_duration_ms === undefined
                ? null
                : Math.round(row.avg_duration_ms),
        p95DurationMs:
            row?.p95_duration_ms === null || row?.p95_duration_ms === undefined
                ? null
                : Math.round(row.p95_duration_ms),
        newItemCount: Number(row?.saved_item_count ?? 0),
        lastError: row?.last_error ?? null,
        detectionCount: Number(detectionRow?.detection_count ?? 0),
        detectionWindow: 500,
        earlyDetectionCount: Number(detectionRow?.early_detection_count ?? 0),
        earlyWinCount: Number(detectionRow?.early_win_count ?? 0),
        earlyAlertCount: Number(detectionRow?.early_alert_count ?? 0),
        medianEarlyLeadMs:
            detectionRow?.median_early_lead_ms === null ||
            detectionRow?.median_early_lead_ms === undefined
                ? null
                : Math.round(detectionRow.median_early_lead_ms),
        p95DetectToAlertMs:
            detectionRow?.p95_detect_to_alert_ms === null ||
            detectionRow?.p95_detect_to_alert_ms === undefined
                ? null
                : Math.round(detectionRow.p95_detect_to_alert_ms),
        preindexExperimentDetectionCount: Number(
            preindexExperimentRow?.experiment_detection_count ?? 0,
        ),
        preindexDetectionCount,
        preindexWinCount,
        preindexWinRate,
        avgPreindexLeadMs:
            preindexExperimentRow?.avg_preindex_lead_ms === null ||
            preindexExperimentRow?.avg_preindex_lead_ms === undefined
                ? null
                : Math.round(preindexExperimentRow.avg_preindex_lead_ms),
        medianPreindexLeadMs,
        p95PreindexLeadMs:
            preindexExperimentRow?.p95_preindex_lead_ms === null ||
            preindexExperimentRow?.p95_preindex_lead_ms === undefined
                ? null
                : Math.round(preindexExperimentRow.p95_preindex_lead_ms),
        preindexWindowDays: 14,
        preindexTargetMatches,
        preindexReady,
        preindexQualified,
        preindexProbeCount: Number(preindexHealthRow?.probe_count ?? 0),
        preindexHitCount: Number(preindexHealthRow?.hit_count ?? 0),
        preindexMissCount: Number(preindexHealthRow?.miss_count ?? 0),
        preindexIssueCount: Number(preindexHealthRow?.issue_count ?? 0),
        preindexBlockedCount: Number(preindexHealthRow?.blocked_count ?? 0),
        avgPreindexProbeMs:
            preindexHealthRow?.avg_duration_ms === null ||
            preindexHealthRow?.avg_duration_ms === undefined
                ? null
                : Math.round(preindexHealthRow.avg_duration_ms),
        p95PreindexProbeMs:
            preindexHealthRow?.p95_duration_ms === null ||
            preindexHealthRow?.p95_duration_ms === undefined
                ? null
                : Math.round(preindexHealthRow.p95_duration_ms),
    });
}
