import crypto from "crypto";
import { db } from "@/lib/db";

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
}

export function buildTelegramBotLink(code: string) {
  const username = getTelegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}

export function createTelegramConnectCode() {
  return `VT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function getTelegramConnection(userId: string) {
  return db.telegram_connections.findUnique({
    where: { userId },
    select: {
      chat_id: true,
      chat_type: true,
      chat_title: true,
      username: true,
      updated_at: true,
    },
  });
}

export function telegramDisplayName(
  connection: Awaited<ReturnType<typeof getTelegramConnection>>
) {
  if (!connection) return null;
  return connection.chat_title || connection.username || connection.chat_id;
}
