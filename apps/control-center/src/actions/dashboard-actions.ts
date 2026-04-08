"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { isValidDiscordWebhook } from "@/lib/validation";

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
            avatar_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
            embeds: [
              {
                title: "⏸️ Monitor Paused",
                description: `The monitor **${monitor.name}** has been paused via Stop All.`,
                color: 16753920,
                footer: {
                  text: "Vintrack • Status Update",
                  icon_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png"
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
          console.error("Failed to send status webhook for", monitor.id, error);
        }
      }
    })
  ).catch(console.error);

  revalidatePath("/dashboard");
  return { success: true, message: "All monitors stopped successfully." };
}

export async function toggleMonitor(id: number, currentStatus: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const newStatus = currentStatus === "active" ? "paused" : "active";

  const monitor = await db.monitors.update({
    where: { id: id, userId: session.user.id },
    data: { status: newStatus },
  });

  if (monitor.discord_webhook && monitor.webhook_active) {
    try {
      const isStarting = newStatus === "active";
      const payload = {
        username: "Vintrack Monitor",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
        embeds: [
          {
            title: isStarting ? "▶️ Monitor Started" : "⏸️ Monitor Paused",
            description: `The monitor **${monitor.name}** has been ${isStarting ? "started" : "paused"}.`,
            color: isStarting ? 3066993 : 16753920,
            footer: {
              text: "Vintrack • Status Update",
              icon_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png"
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

  revalidatePath("/dashboard");
  return { success: true, status: newStatus };
}

export async function updateMonitorWebhook(monitorId: number, webhookUrl: string) {
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
            webhook_active: true
        }
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Webhook saved successfully" };
}

export async function toggleWebhookStatus(monitorId: number, currentStatus: boolean) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    await db.monitors.update({
        where: { id: monitorId, userId: session.user.id },
        data: { webhook_active: !currentStatus }
    });

    revalidatePath("/dashboard");
    return { success: true, message: !currentStatus ? "Webhook activated" : "Webhook deactivated" };
}
