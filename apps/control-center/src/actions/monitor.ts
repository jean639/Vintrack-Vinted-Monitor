"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isValidDiscordWebhook } from "@/lib/validation";
import { monitorStatusTelegramText, sendTelegramMessage } from "@/lib/telegram";
import { getTelegramConnection } from "@/lib/telegram-connection";
import { normalizeQueryDelayMs } from "@/lib/monitor-delay";
import { getMonitorActivationState } from "@/lib/monitor-limits";
import { getFreeProxyPoolHealth } from "@/lib/free-proxy-health";

function normalizeAntiKeywords(value: FormDataEntryValue | null) {
    const normalized = String(value ?? "").trim();
    if (normalized.length > 1000) throw new Error("Anti keywords are too long");
    return normalized || null;
}

async function sendTelegramStatusIfConfigured(
    monitor: { name: string; userId: string; telegram_active: boolean },
    status: "created" | "started" | "paused",
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

async function isFreeProxyPoolAvailable(region: string) {
    const health = await getFreeProxyPoolHealth();
    return health.enabled && Boolean(health.regions[region]?.healthy);
}

async function resolveMonitorProxySelection(
    userId: string,
    rawValue: string,
    region: string,
) {
    const proxyGroupRaw = rawValue?.trim() ?? "";
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (proxyGroupRaw === "free") {
        if (!(await isFreeProxyPoolAvailable(region))) {
            throw new Error(
                "Free proxy pool is not healthy for this region right now",
            );
        }
        return { proxyGroupId: null, proxySource: "free" };
    }

    if (proxyGroupRaw === "server") {
        if (user?.role !== "premium" && user?.role !== "admin") {
            throw new Error("Server proxies require a premium account");
        }
        return { proxyGroupId: null, proxySource: "server" };
    }

    if (proxyGroupRaw) {
        const pgId = parseInt(proxyGroupRaw);
        if (!Number.isInteger(pgId)) throw new Error("Invalid proxy group");

        const group = await db.proxy_groups.findFirst({
            where: { id: pgId, userId },
            select: { id: true },
        });
        if (!group) throw new Error("Invalid proxy group");
        return { proxyGroupId: pgId, proxySource: "group" };
    }

    if (user?.role === "free") {
        throw new Error("You must select a proxy group or free proxy pool");
    }

    return { proxyGroupId: null, proxySource: "server" };
}

export async function createMonitor(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Not logged in!");
    }

    const name = formData.get("name") as string;
    const query = formData.get("query") as string;
    const antiKeywords = normalizeAntiKeywords(formData.get("anti_keywords"));
    const queryDelayMs = normalizeQueryDelayMs(formData.get("query_delay_ms"));
    const priceMin = formData.get("price_min")
        ? Number(formData.get("price_min"))
        : null;
    const priceMax = formData.get("price_max")
        ? Number(formData.get("price_max"))
        : null;
    const sizeId = formData.get("size_id") as string;
    const catalogIds = (formData.get("catalog_ids") as string) || null;
    const brandIds = (formData.get("brand_ids") as string) || null;
    const colorIds = (formData.get("color_ids") as string) || null;
    const statusIds = (formData.get("status_ids") as string) || null;
    const region = (formData.get("region") as string) || "de";
    const allowedCountries =
        (formData.get("allowed_countries") as string) || null;
    const discordWebhook = (formData.get("discord_webhook") as string) || null;
    const wantsTelegramActive = formData.get("telegram_active") === "true";
    const proxyGroupRaw = formData.get("proxy_group_id") as string;

    const normalizedName = name?.trim() ?? "";
    const normalizedQuery = query?.trim() ?? "";

    if (!normalizedName) throw new Error("Name is required");
    if (normalizedName.length > 255) throw new Error("Name is too long");
    if (normalizedQuery.length > 255) throw new Error("Keywords are too long");

    const { proxyGroupId, proxySource } = await resolveMonitorProxySelection(
        session.user.id,
        proxyGroupRaw,
        region,
    );

    const urlToSave = discordWebhook?.trim() || null;
    if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
        throw new Error("Invalid Discord Webhook URL");
    }
    const telegramConnection = wantsTelegramActive
        ? await getTelegramConnection(session.user.id)
        : null;

    const activationState = await getMonitorActivationState(session.user.id);
    const initialStatus = activationState.canActivate ? "active" : "paused";

    const monitor = await db.monitors.create({
        data: {
            userId: session.user.id,
            name: normalizedName,
            query: normalizedQuery,
            anti_keywords: antiKeywords,
            query_delay_ms: queryDelayMs,
            price_min: priceMin,
            price_max: priceMax,
            size_id: sizeId,
            catalog_ids: catalogIds || null,
            brand_ids: brandIds || null,
            color_ids: colorIds || null,
            status_ids: statusIds || null,
            region,
            allowed_countries: allowedCountries || null,
            discord_webhook: urlToSave,
            telegram_active: Boolean(telegramConnection),
            proxy_group_id: proxyGroupId,
            proxy_source: proxySource,
            status: initialStatus,
            webhook_active: urlToSave ? true : false,
        },
    });

    if (
        initialStatus === "active" &&
        monitor.discord_webhook &&
        monitor.webhook_active
    ) {
        try {
            const payload = {
                username: "Vintrack Monitor",
                avatar_url:
                    "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                embeds: [
                    {
                        title: "🚀 New Monitor Created & Started",
                        description: `The monitor **${monitor.name}** has been successfully created and is now active.`,
                        color: 3066993, // Green
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

    if (initialStatus === "active") {
        await sendTelegramStatusIfConfigured(monitor, "created");
    }

    revalidatePath("/dashboard");
    return {
        redirectTo: `/monitors/${monitor.id}`,
        started: initialStatus === "active",
        activeLimit: activationState.activeLimit,
    };
}

export async function updateMonitor(id: number, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const query = formData.get("query") as string;
    const antiKeywords = normalizeAntiKeywords(formData.get("anti_keywords"));
    const queryDelayMs = normalizeQueryDelayMs(formData.get("query_delay_ms"));
    const priceMin = formData.get("price_min")
        ? Number(formData.get("price_min"))
        : null;
    const priceMax = formData.get("price_max")
        ? Number(formData.get("price_max"))
        : null;
    const sizeId = formData.get("size_id") as string;
    const catalogIds = (formData.get("catalog_ids") as string) || null;
    const brandIds = (formData.get("brand_ids") as string) || null;
    const colorIds = (formData.get("color_ids") as string) || null;
    const statusIds = (formData.get("status_ids") as string) || null;
    const region = (formData.get("region") as string) || "de";
    const allowedCountries =
        (formData.get("allowed_countries") as string) || null;
    const returnTo = (formData.get("return_to") as string) || "detail";
    const discordWebhook = (formData.get("discord_webhook") as string) || null;
    const wantsTelegramActive = formData.get("telegram_active") === "true";
    const proxyGroupRaw = formData.get("proxy_group_id") as string;

    const normalizedName = name?.trim() ?? "";
    const normalizedQuery = query?.trim() ?? "";

    if (!normalizedName) throw new Error("Name is required");
    if (normalizedName.length > 255) throw new Error("Name is too long");
    if (normalizedQuery.length > 255) throw new Error("Keywords are too long");

    // Verify the monitor belongs to this user
    const existing = await db.monitors.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!existing) throw new Error("Monitor not found");

    const { proxyGroupId, proxySource } = await resolveMonitorProxySelection(
        session.user.id,
        proxyGroupRaw,
        region,
    );

    const urlToSave = discordWebhook?.trim() || null;
    if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
        throw new Error("Invalid Discord Webhook URL");
    }
    const telegramConnection = wantsTelegramActive
        ? await getTelegramConnection(session.user.id)
        : null;

    await db.monitors.update({
        where: { id, userId: session.user.id },
        data: {
            name: normalizedName,
            query: normalizedQuery,
            anti_keywords: antiKeywords,
            query_delay_ms: queryDelayMs,
            price_min: priceMin,
            price_max: priceMax,
            size_id: sizeId,
            catalog_ids: catalogIds || null,
            brand_ids: brandIds || null,
            color_ids: colorIds || null,
            status_ids: statusIds || null,
            region,
            allowed_countries: allowedCountries || null,
            discord_webhook: urlToSave,
            proxy_group_id: proxyGroupId,
            proxy_source: proxySource,
            webhook_active: urlToSave ? true : false,
            telegram_active: Boolean(telegramConnection),
        },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/monitors/${id}`);
    revalidatePath(`/monitors/${id}/edit`);

    if (returnTo === "dashboard") {
        redirect("/dashboard");
    }

    redirect(`/monitors/${id}`);
}

export async function updateMonitorAndReturn(id: number, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const query = formData.get("query") as string;
    const antiKeywords = normalizeAntiKeywords(formData.get("anti_keywords"));
    const queryDelayMs = normalizeQueryDelayMs(formData.get("query_delay_ms"));
    const priceMin = formData.get("price_min")
        ? Number(formData.get("price_min"))
        : null;
    const priceMax = formData.get("price_max")
        ? Number(formData.get("price_max"))
        : null;
    const sizeId = formData.get("size_id") as string;
    const catalogIds = (formData.get("catalog_ids") as string) || null;
    const brandIds = (formData.get("brand_ids") as string) || null;
    const colorIds = (formData.get("color_ids") as string) || null;
    const statusIds = (formData.get("status_ids") as string) || null;
    const region = (formData.get("region") as string) || "de";
    const allowedCountries =
        (formData.get("allowed_countries") as string) || null;
    const returnTo = (formData.get("return_to") as string) || "detail";
    const discordWebhook = (formData.get("discord_webhook") as string) || null;
    const wantsTelegramActive = formData.get("telegram_active") === "true";
    const proxyGroupRaw = formData.get("proxy_group_id") as string;

    const normalizedName = name?.trim() ?? "";
    const normalizedQuery = query?.trim() ?? "";

    if (!normalizedName) throw new Error("Name is required");
    if (normalizedName.length > 255) throw new Error("Name is too long");
    if (normalizedQuery.length > 255) throw new Error("Keywords are too long");

    const existing = await db.monitors.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!existing) throw new Error("Monitor not found");

    const { proxyGroupId, proxySource } = await resolveMonitorProxySelection(
        session.user.id,
        proxyGroupRaw,
        region,
    );

    const urlToSave = discordWebhook?.trim() || null;
    if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
        throw new Error("Invalid Discord Webhook URL");
    }
    const telegramConnection = wantsTelegramActive
        ? await getTelegramConnection(session.user.id)
        : null;

    await db.monitors.update({
        where: { id, userId: session.user.id },
        data: {
            name: normalizedName,
            query: normalizedQuery,
            anti_keywords: antiKeywords,
            query_delay_ms: queryDelayMs,
            price_min: priceMin,
            price_max: priceMax,
            size_id: sizeId,
            catalog_ids: catalogIds || null,
            brand_ids: brandIds || null,
            color_ids: colorIds || null,
            status_ids: statusIds || null,
            region,
            allowed_countries: allowedCountries || null,
            discord_webhook: urlToSave,
            proxy_group_id: proxyGroupId,
            proxy_source: proxySource,
            webhook_active: urlToSave ? true : false,
            telegram_active: Boolean(telegramConnection),
        },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/monitors/${id}`);
    revalidatePath(`/monitors/${id}/edit`);

    return {
        success: true,
        redirectTo: returnTo === "dashboard" ? "/dashboard" : `/monitors/${id}`,
    };
}

export async function toggleMonitorStatus(id: number, currentStatus: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

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
        where: { id, userId: session.user.id },
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
                        color: isStarting ? 3066993 : 16753920, // Green for start, Orange for pause
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

    revalidatePath(`/monitors/${id}`);
    revalidatePath("/dashboard");
}

export async function deleteMonitor(id: number) {
    const session = await auth();
    if (!session?.user?.id) return;

    await db.monitors.deleteMany({
        where: {
            id,
            userId: session.user.id!,
        },
    });
    revalidatePath("/dashboard");
    revalidatePath(`/monitors/${id}`);
    revalidatePath(`/monitors/${id}/edit`);
    redirect("/dashboard");
}

export async function deleteMonitorAndReturn(id: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.monitors.deleteMany({
        where: {
            id,
            userId: session.user.id,
        },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/monitors/${id}`);
    revalidatePath(`/monitors/${id}/edit`);

    return { success: true };
}

export async function testDiscordWebhook(url: string) {
    if (!url || !isValidDiscordWebhook(url)) {
        return { error: "Invalid Discord Webhook URL" };
    }

    try {
        const payload = {
            username: "Vintrack Monitor",
            avatar_url:
                "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
            embeds: [
                {
                    author: {
                        name: "Vintrack notification test",
                    },
                    title: "Discord webhook connected",
                    description:
                        "New matches will arrive here with the listing image, price, size, condition, seller details, and direct links.",
                    color: 0x007782,
                    fields: [
                        {
                            name: "Delivery",
                            value: "**Ready**",
                            inline: true,
                        },
                        {
                            name: "Content",
                            value: "Structured item cards",
                            inline: true,
                        },
                    ],
                    footer: {
                        text: "Vintrack • Notifications",
                        icon_url:
                            "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
                    },
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            return { error: `Discord API returned ${res.status}` };
        }

        return { success: true };
    } catch (error) {
        return {
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to send webhook",
        };
    }
}
