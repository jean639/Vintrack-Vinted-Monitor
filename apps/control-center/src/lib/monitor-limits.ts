import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const GLOBAL_MONITOR_LIMIT_SCOPE = "global";
export const ROLE_MONITOR_LIMIT_PREFIX = "role:";
export const USER_MONITOR_LIMIT_PREFIX = "user:";

export type MonitorLimitRow = {
    scope: string;
    active_limit: number | null;
};

export type EffectiveMonitorLimit = {
    activeLimit: number | null;
    source: "user" | "role" | "global" | null;
};

export function roleLimitScope(role: string) {
    return `${ROLE_MONITOR_LIMIT_PREFIX}${role}`;
}

export function userLimitScope(userId: string) {
    return `${USER_MONITOR_LIMIT_PREFIX}${userId}`;
}

export function normalizeMonitorLimitInput(value: FormDataEntryValue | null) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("Monitor limit must be empty or a non-negative number");
    }

    return parsed;
}

export async function getMonitorLimits(scopes: string[]) {
    if (scopes.length === 0) return new Map<string, number | null>();

    const rows = await db.$queryRaw<MonitorLimitRow[]>`
        SELECT scope, active_limit
        FROM "monitor_limits"
        WHERE scope IN (${Prisma.join(scopes)})
    `;

    return new Map(rows.map((row) => [row.scope, row.active_limit]));
}

export async function setMonitorLimit(scope: string, activeLimit: number | null) {
    await db.$executeRaw`
        INSERT INTO "monitor_limits" ("scope", "active_limit", "updated_at")
        VALUES (${scope}, ${activeLimit}, NOW())
        ON CONFLICT ("scope") DO UPDATE
        SET "active_limit" = EXCLUDED."active_limit",
            "updated_at" = NOW()
    `;
}

export async function getEffectiveMonitorLimit(
    userId: string,
): Promise<EffectiveMonitorLimit> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (!user) throw new Error("User not found");

    if (user.role === "admin") {
        return { activeLimit: null, source: null };
    }

    const scopes = [
        userLimitScope(userId),
        roleLimitScope(user.role),
        GLOBAL_MONITOR_LIMIT_SCOPE,
    ];
    const limits = await getMonitorLimits(scopes);

    const userLimit = limits.get(scopes[0]);
    if (userLimit !== undefined && userLimit !== null) {
        return { activeLimit: userLimit, source: "user" };
    }

    const roleLimit = limits.get(scopes[1]);
    if (roleLimit !== undefined && roleLimit !== null) {
        return { activeLimit: roleLimit, source: "role" };
    }

    const globalLimit = limits.get(scopes[2]);
    if (globalLimit !== undefined && globalLimit !== null) {
        return { activeLimit: globalLimit, source: "global" };
    }

    return { activeLimit: null, source: null };
}

export async function getActiveMonitorCount(userId: string) {
    return db.monitors.count({
        where: { userId, status: "active" },
    });
}

export async function getMonitorActivationState(userId: string) {
    const [limit, activeCount] = await Promise.all([
        getEffectiveMonitorLimit(userId),
        getActiveMonitorCount(userId),
    ]);

    return {
        ...limit,
        activeCount,
        canActivate:
            limit.activeLimit === null || activeCount < limit.activeLimit,
    };
}
