import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTelegramConnection } from "@/lib/telegram-connection";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getTelegramConnection(session.user.id);
  if (!connection) {
    return NextResponse.json(
      { error: "Telegram is not connected" },
      { status: 400 }
    );
  }

  const result = await sendTelegramMessage(
    connection.chat_id,
    "Vintrack: Telegram notifications are connected. New matching items will appear here."
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
