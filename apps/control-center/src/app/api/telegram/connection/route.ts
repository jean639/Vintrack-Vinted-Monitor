import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getTelegramBotUsername,
  getTelegramConnection,
  telegramDisplayName,
} from "@/lib/telegram-connection";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getTelegramConnection(session.user.id);
  return NextResponse.json({
    connected: Boolean(connection),
    botUsername: getTelegramBotUsername(),
    connection: connection
      ? {
          chat_type: connection.chat_type,
          chat_title: telegramDisplayName(connection),
          username: connection.username,
          updated_at: connection.updated_at.toISOString(),
        }
      : null,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.telegram_connections.deleteMany({
    where: { userId: session.user.id },
  });
  await db.monitors.updateMany({
    where: { userId: session.user.id },
    data: { telegram_active: false },
  });

  return NextResponse.json({ success: true });
}
