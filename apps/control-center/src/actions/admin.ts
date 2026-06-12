"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { monitorStatusTelegramText, sendTelegramMessage } from "@/lib/telegram";
import { getTelegramConnection } from "@/lib/telegram-connection";
import {
    GLOBAL_MONITOR_LIMIT_SCOPE,
    normalizeMonitorLimitInput,
    roleLimitScope,
    setMonitorLimit,
    userLimitScope,
} from "@/lib/monitor-limits";

const SERVER_PROXIES_SETTING_KEY = "server_proxies";
const VALID_PROXY_SCHEMES = ["http", "https", "socks4", "socks5"];

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    });

    if (user?.role !== "admin") throw new Error("Forbidden");
    return session.user.id;
}

function validateProxyLine(line: string): string | null {
    line = line.trim();
    if (!line) return null;

    if (/^(https?|socks[45]):\/\//.test(line)) {
        try {
            const url = new URL(line);
            if (!VALID_PROXY_SCHEMES.includes(url.protocol.replace(":", ""))) {
                return null;
            }
            if (!url.hostname || !url.port) return null;
            return line;
        } catch {
            return null;
        }
    }

    const parts = line.split(":");

    if (parts.length >= 4) {
        const pass = parts[parts.length - 1];
        const user = parts[parts.length - 2];
        const port = parts[parts.length - 3];
        const host = parts.slice(0, parts.length - 3).join(":");
        if (!host || !port || !user || !pass) return null;
        if (!/^\d{1,5}$/.test(port)) return null;
        return `http://${user}:${pass}@${host}:${port}`;
    }

    if (parts.length === 2 && /^\d{1,5}$/.test(parts[1])) {
        return `http://${line}`;
    }

    return null;
}

function validateProxies(text: string) {
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const line of lines) {
        const parsed = validateProxyLine(line);
        if (parsed) {
            valid.push(line.trim());
        } else {
            invalid.push(line.trim());
        }
    }

    return { valid, invalid, total: lines.length };
}

export async function getServerProxies() {
    await requireAdmin();

    const rows = await db.$queryRaw<{ value: string }[]>`
        SELECT value FROM app_settings WHERE key = ${SERVER_PROXIES_SETTING_KEY}
    `;

    const proxies = rows[0]?.value ?? "";
    const proxyCount = proxies
        .split("\n")
        .filter((line) => line.trim().length > 0).length;

    return { proxies, proxyCount };
}

export async function updateServerProxies(formData: FormData) {
    await requireAdmin();

    const proxies = (formData.get("proxies") as string | null)?.trim() ?? "";
    const { valid, invalid, total } = validateProxies(proxies);

    if (total > 0 && valid.length === 0) {
        return {
            success: false,
            error: "No valid proxies found. Use format: host:port:user:pass or http://user:pass@host:port",
        };
    }

    if (invalid.length > 0) {
        console.warn(
            `[admin] server proxies: ${invalid.length}/${total} invalid lines skipped`,
        );
    }

    const value = valid.join("\n");

    try {
        await db.$executeRaw`
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (${SERVER_PROXIES_SETTING_KEY}, ${value}, NOW())
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        `;
    } catch (error) {
        console.error("[admin] failed to update server proxies", error);
        return {
            success: false,
            error: "Failed to save server proxies. Make sure database migrations have been applied.",
        };
    }

    revalidatePath("/admin");

    return {
        success: true,
        proxyCount: valid.length,
        skippedCount: invalid.length,
    };
}

export async function getUsers() {
    await requireAdmin();

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

    return users;
}

async function sendPausedWebhook(
    name: string,
    monitorId: number,
    webhookUrl: string,
) {
    try {
        const payload = {
            username: "Vintrack Monitor",
            avatar_url:
                "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
            embeds: [
                {
                    title: "⏸️ Monitor Paused",
                    description: `The monitor **${name}** has been paused via User Management.`,
                    color: 16753920,
                    footer: {
                        text: "Vintrack • Status Update",
                        icon_url:
                            "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                    },
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error(
            "Failed to send admin pause webhook for",
            monitorId,
            error,
        );
    }
}

async function sendPausedTelegram(
    name: string,
    monitorId: number,
    userId: string,
) {
    const connection = await getTelegramConnection(userId);
    if (!connection) return;

    const result = await sendTelegramMessage(
        connection.chat_id,
        monitorStatusTelegramText(name, "paused"),
    );
    if ("error" in result) {
        console.error(
            "Failed to send admin pause Telegram message for",
            monitorId,
            result.error,
        );
    }
}

export async function setUserRole(userId: string, role: string) {
    await requireAdmin();

    const validRoles = ["free", "premium", "admin"];
    if (!validRoles.includes(role)) throw new Error("Invalid role");

    await db.user.update({
        where: { id: userId },
        data: { role },
    });

    revalidatePath("/admin");
}

export async function setGlobalActiveMonitorLimit(value: string) {
    await requireAdmin();

    await setMonitorLimit(
        GLOBAL_MONITOR_LIMIT_SCOPE,
        normalizeMonitorLimitInput(value),
    );

    revalidatePath("/admin");
}

export async function setRoleActiveMonitorLimit(role: string, value: string) {
    await requireAdmin();

    const validRoles = ["free", "premium"];
    if (!validRoles.includes(role)) throw new Error("Invalid role");

    await setMonitorLimit(roleLimitScope(role), normalizeMonitorLimitInput(value));

    revalidatePath("/admin");
}

export async function setUserActiveMonitorLimit(userId: string, value: string) {
    await requireAdmin();

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (!user) throw new Error("User not found");
    if (user.role === "admin") {
        throw new Error("Admins are always unlimited");
    }

    await setMonitorLimit(userLimitScope(userId), normalizeMonitorLimitInput(value));

    revalidatePath("/admin");
}

export async function stopUserActiveMonitors(userId: string) {
    await requireAdmin();

    const monitorsToStop = await db.monitors.findMany({
        where: { userId, status: "active" },
        select: {
            id: true,
            name: true,
            userId: true,
            discord_webhook: true,
            webhook_active: true,
            telegram_active: true,
        },
    });

    if (monitorsToStop.length === 0) {
        return { success: true, stoppedCount: 0 };
    }

    await db.monitors.updateMany({
        where: { userId, status: "active" },
        data: { status: "paused" },
    });

    Promise.all(
        monitorsToStop.map(async (monitor) => {
            if (monitor.discord_webhook && monitor.webhook_active) {
                await sendPausedWebhook(
                    monitor.name,
                    monitor.id,
                    monitor.discord_webhook,
                );
            }
            if (monitor.telegram_active) {
                await sendPausedTelegram(
                    monitor.name,
                    monitor.id,
                    monitor.userId,
                );
            }
        }),
    ).catch(console.error);

    revalidatePath("/admin");

    return {
        success: true,
        stoppedCount: monitorsToStop.length,
    };
}

export async function stopSingleUserMonitor(userId: string, monitorId: number) {
    await requireAdmin();

    const monitor = await db.monitors.findFirst({
        where: {
            id: monitorId,
            userId,
            status: "active",
        },
        select: {
            id: true,
            name: true,
            userId: true,
            discord_webhook: true,
            webhook_active: true,
            telegram_active: true,
        },
    });

    if (!monitor) {
        return { success: true, stopped: false };
    }

    await db.monitors.update({
        where: { id: monitorId, userId },
        data: { status: "paused" },
    });

    if (monitor.discord_webhook && monitor.webhook_active) {
        sendPausedWebhook(
            monitor.name,
            monitor.id,
            monitor.discord_webhook,
        ).catch(console.error);
    }
    if (monitor.telegram_active) {
        sendPausedTelegram(monitor.name, monitor.id, monitor.userId).catch(
            console.error,
        );
    }

    revalidatePath("/admin");

    return { success: true, stopped: true };
}
