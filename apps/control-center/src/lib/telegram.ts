import { isValidTelegramChatId } from "@/lib/validation";

type TelegramResult = { success: true } | { error: string };
type TelegramRateLimit = { parameters?: { retry_after?: number } };

function telegramEndpoint(method: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;
    return `https://api.telegram.org/bot${token}/${method}`;
}

export async function sendTelegramMessage(
    chatId: string | null | undefined,
    text: string,
): Promise<TelegramResult> {
    const normalizedChatId = chatId?.trim();
    if (!normalizedChatId) return { error: "Missing Telegram chat ID" };
    if (!isValidTelegramChatId(normalizedChatId)) {
        return { error: "Invalid Telegram chat ID" };
    }

    const endpoint = telegramEndpoint("sendMessage");
    if (!endpoint) {
        console.warn(
            "Telegram notification skipped: TELEGRAM_BOT_TOKEN is not configured",
        );
        return { error: "Telegram bot token is not configured" };
    }

    try {
        const payload = {
            chat_id: normalizedChatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
        };
        const res = await postTelegram(endpoint, payload);

        if (!res.ok) {
            return { error: `Telegram API returned ${res.status}` };
        }

        return { success: true };
    } catch (error) {
        return {
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to send Telegram message",
        };
    }
}

async function postTelegram(
    endpoint: string,
    payload: Record<string, unknown>,
) {
    const body = JSON.stringify(payload);
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

    if (res.status !== 429) return res;

    let retryAfter = 2;
    try {
        const data = (await res.json()) as TelegramRateLimit;
        if (typeof data.parameters?.retry_after === "number") {
            retryAfter = data.parameters.retry_after;
        }
    } catch {}

    await new Promise((resolve) =>
        setTimeout(resolve, Math.min(retryAfter * 1000, 10_000)),
    );

    return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });
}

export function monitorStatusTelegramText(
    name: string,
    status: "created" | "started" | "paused",
) {
    if (status === "created") {
        return `Vintrack: Monitor <b>${escapeTelegramHTML(name)}</b> has been created and started.`;
    }

    return `Vintrack: Monitor <b>${escapeTelegramHTML(name)}</b> has been ${status}.`;
}

export function escapeTelegramHTML(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
