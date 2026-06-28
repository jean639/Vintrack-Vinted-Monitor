import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AuditStatus = "success" | "failed" | "skipped";

type AuditEventInput = {
    userId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | number | bigint | null;
    status?: AuditStatus;
    metadata?: Prisma.InputJsonValue;
};

export async function logAuditEvent({
    userId,
    action,
    targetType = null,
    targetId = null,
    status = "success",
    metadata,
}: AuditEventInput) {
    try {
        await db.audit_events.create({
            data: {
                userId: userId || null,
                action,
                target_type: targetType,
                target_id:
                    targetId === null || targetId === undefined
                        ? null
                        : String(targetId),
                status,
                metadata: metadata ?? Prisma.JsonNull,
            },
        });
    } catch (error) {
        console.error("[audit] failed to write event", action, error);
    }
}
