import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type AlertEventRow = {
    id: bigint;
    monitor_id: number | null;
    monitor_name: string | null;
    item_id: bigint | null;
    channel: string;
    status: string;
    failure_reason: string | null;
    created_at: Date;
};

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.$queryRaw<AlertEventRow[]>`
        SELECT
            ae.id,
            ae.monitor_id,
            m.name AS monitor_name,
            ae.item_id,
            ae.channel,
            ae.status,
            ae.failure_reason,
            ae.created_at
        FROM alert_events ae
        LEFT JOIN monitors m ON m.id = ae.monitor_id
        WHERE ae."userId" = ${session.user.id}
        ORDER BY ae.created_at DESC
        LIMIT 100
    `;

    return NextResponse.json({
        alerts: rows.map((row) => ({
            id: row.id.toString(),
            monitorId: row.monitor_id,
            monitorName: row.monitor_name,
            itemId: row.item_id?.toString() ?? null,
            channel: row.channel,
            status: row.status,
            failureReason: row.failure_reason,
            createdAt: row.created_at.toISOString(),
        })),
    });
}
