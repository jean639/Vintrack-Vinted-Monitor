"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

async function sendPausedWebhook(query: string, monitorId: number, webhookUrl: string) {
  try {
    const payload = {
      username: "Vintrack Monitor",
      avatar_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
      embeds: [
        {
          title: "⏸️ Monitor Paused",
          description: `The monitor **${query}** has been paused via User Management.`,
          color: 16753920,
          footer: {
            text: "Vintrack • Status Update",
            icon_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
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
    console.error("Failed to send admin pause webhook for", monitorId, error);
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

export async function stopUserActiveMonitors(userId: string) {
  await requireAdmin();

  const monitorsToStop = await db.monitors.findMany({
    where: { userId, status: "active" },
    select: {
      id: true,
      query: true,
      discord_webhook: true,
      webhook_active: true,
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
          monitor.query,
          monitor.id,
          monitor.discord_webhook
        );
      }
    })
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
      query: true,
      discord_webhook: true,
      webhook_active: true,
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
    sendPausedWebhook(monitor.query, monitor.id, monitor.discord_webhook).catch(
      console.error
    );
  }

  revalidatePath("/admin");

  return { success: true, stopped: true };
}
