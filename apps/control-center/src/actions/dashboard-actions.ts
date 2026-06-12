"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isValidDiscordWebhook } from "@/lib/validation";
import { monitorStatusTelegramText, sendTelegramMessage } from "@/lib/telegram";
import { getTelegramConnection } from "@/lib/telegram-connection";
import { getMonitorActivationState } from "@/lib/monitor-limits";

async function sendTelegramStatusIfConfigured(
    monitor: { name: string; userId: string; telegram_active: boolean },
    status: "started" | "paused",
) {
    if (!monitor.telegram_active) return;

    const connection = await getTelegramConnection(monitor.userId);
    if (!connection) return;
    const result = await sendTelegramMessage(
        connection.chat_id,
        monitorStatusTelegramText(monitor.name, status),
    );
    if ("error" in result) {
        console.error("Failed to send Telegram status message", result.error);
    }
}

export async function stopAllMonitors() {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const monitorsToStop = await db.monitors.findMany({
        where: { userId: session.user.id, status: "active" },
    });

    await db.monitors.updateMany({
        where: { userId: session.user.id, status: "active" },
        data: { status: "paused" },
    });

    Promise.all(
        monitorsToStop.map(async (monitor) => {
            if (monitor.discord_webhook && monitor.webhook_active) {
                try {
                    const payload = {
                        username: "Vintrack Monitor",
                        avatar_url:
                            "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                        embeds: [
                            {
                                title: "⏸️ Monitor Paused",
                                description: `The monitor **${monitor.name}** has been paused via Stop All.`,
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

                    await fetch(monitor.discord_webhook, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                } catch (error) {
                    console.error(
                        "Failed to send status webhook for",
                        monitor.id,
                        error,
                    );
                }
            }
            await sendTelegramStatusIfConfigured(monitor, "paused");
        }),
    ).catch(console.error);

    revalidatePath("/dashboard");
    return { success: true, message: "All monitors stopped successfully." };
}

export async function startAllMonitors() {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const activationState = await getMonitorActivationState(session.user.id);
    const availableSlots =
        activationState.activeLimit === null
            ? null
            : Math.max(
                  activationState.activeLimit - activationState.activeCount,
                  0,
              );

    if (availableSlots === 0) {
        return {
            success: true,
            startedCount: 0,
            skippedCount: await db.monitors.count({
                where: { userId: session.user.id, status: "paused" },
            }),
            startedMonitorIds: [] as number[],
            activeLimit: activationState.activeLimit,
            activeCount: activationState.activeCount,
            message: `Active monitor limit reached (${activationState.activeCount}/${activationState.activeLimit}).`,
        };
    }

    const monitorsToStart = await db.monitors.findMany({
        where: { userId: session.user.id, status: "paused" },
        orderBy: { created_at: "desc" },
        ...(availableSlots === null ? {} : { take: availableSlots }),
    });

    if (monitorsToStart.length === 0) {
        return {
            success: true,
            startedCount: 0,
            skippedCount: 0,
            startedMonitorIds: [] as number[],
            activeLimit: activationState.activeLimit,
            activeCount: activationState.activeCount,
            message: "No paused monitors to start.",
        };
    }

    await db.monitors.updateMany({
        where: {
            userId: session.user.id,
            status: "paused",
            id: { in: monitorsToStart.map((monitor) => monitor.id) },
        },
        data: { status: "active" },
    });

    const skippedCount =
        availableSlots === null
            ? 0
            : await db.monitors.count({
                  where: { userId: session.user.id, status: "paused" },
              });

    Promise.all(
        monitorsToStart.map(async (monitor) => {
            if (monitor.discord_webhook && monitor.webhook_active) {
                try {
                    const payload = {
                        username: "Vintrack Monitor",
                        avatar_url:
                            "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                        embeds: [
                            {
                                title: "▶️ Monitor Started",
                                description: `The monitor **${monitor.name}** has been started via Start All.`,
                                color: 3066993,
                                footer: {
                                    text: "Vintrack • Status Update",
                                    icon_url:
                                        "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                                },
                                timestamp: new Date().toISOString(),
                            },
                        ],
                    };

                    await fetch(monitor.discord_webhook, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                } catch (error) {
                    console.error(
                        "Failed to send status webhook for",
                        monitor.id,
                        error,
                    );
                }
            }
            await sendTelegramStatusIfConfigured(monitor, "started");
        }),
    ).catch(console.error);

    revalidatePath("/dashboard");
    return {
        success: true,
        startedCount: monitorsToStart.length,
        skippedCount,
        startedMonitorIds: monitorsToStart.map((monitor) => monitor.id),
        activeLimit: activationState.activeLimit,
        activeCount: activationState.activeCount + monitorsToStart.length,
        message:
            skippedCount > 0
                ? `Started ${monitorsToStart.length} monitor${monitorsToStart.length === 1 ? "" : "s"}. ${skippedCount} skipped because of the active monitor limit.`
                : `Started ${monitorsToStart.length} monitor${monitorsToStart.length === 1 ? "" : "s"}.`,
    };
}

export async function toggleMonitor(id: number, currentStatus: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const newStatus = currentStatus === "active" ? "paused" : "active";

    if (newStatus === "active") {
        const activationState = await getMonitorActivationState(
            session.user.id,
        );
        if (!activationState.canActivate) {
            throw new Error(
                `Active monitor limit reached (${activationState.activeCount}/${activationState.activeLimit}). Pause another monitor before resuming this one.`,
            );
        }
    }

    const monitor = await db.monitors.update({
        where: { id: id, userId: session.user.id },
        data: { status: newStatus },
    });

    if (monitor.discord_webhook && monitor.webhook_active) {
        try {
            const isStarting = newStatus === "active";
            const payload = {
                username: "Vintrack Monitor",
                avatar_url:
                    "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                embeds: [
                    {
                        title: isStarting
                            ? "▶️ Monitor Started"
                            : "⏸️ Monitor Paused",
                        description: `The monitor **${monitor.name}** has been ${isStarting ? "started" : "paused"}.`,
                        color: isStarting ? 3066993 : 16753920,
                        footer: {
                            text: "Vintrack • Status Update",
                            icon_url:
                                "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                        },
                        timestamp: new Date().toISOString(),
                    },
                ],
            };

            await fetch(monitor.discord_webhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            console.error("Failed to send status webhook", error);
        }
    }

    await sendTelegramStatusIfConfigured(
        monitor,
        newStatus === "active" ? "started" : "paused",
    );

    revalidatePath("/dashboard");
    return { success: true, status: newStatus };
}

export async function updateMonitorWebhook(
    monitorId: number,
    webhookUrl: string,
) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const urlToSave = webhookUrl.trim() === "" ? null : webhookUrl.trim();

    if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
        throw new Error("Invalid Discord Webhook URL");
    }

    await db.monitors.update({
        where: { id: monitorId, userId: session.user.id },
        data: {
            discord_webhook: urlToSave,
            webhook_active: urlToSave ? true : false,
        },
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Webhook saved successfully" };
}

export async function toggleWebhookStatus(
    monitorId: number,
    currentStatus: boolean,
) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    await db.monitors.update({
        where: { id: monitorId, userId: session.user.id },
        data: { webhook_active: !currentStatus },
    });

    revalidatePath("/dashboard");
    return {
        success: true,
        message: !currentStatus ? "Webhook activated" : "Webhook deactivated",
    };
}

export async function toggleTelegramStatus(
    monitorId: number,
    currentStatus: boolean,
) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    if (!currentStatus) {
        const connection = await getTelegramConnection(session.user.id);
        if (!connection) throw new Error("Connect Telegram first");
    }

    await db.monitors.update({
        where: { id: monitorId, userId: session.user.id },
        data: { telegram_active: !currentStatus },
    });

    revalidatePath("/dashboard");
    return {
        success: true,
        message: !currentStatus ? "Telegram activated" : "Telegram deactivated",
    };
}
