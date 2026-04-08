"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth"; 
import { isValidDiscordWebhook } from "@/lib/validation";

export async function createMonitor(formData: FormData) {

  const session = await auth();
  if (!session?.user?.id) {
     throw new Error("Not logged in!");
  }

  const name = formData.get("name") as string;
  const query = formData.get("query") as string;
  const priceMin = formData.get("price_min") ? Number(formData.get("price_min")) : null;
  const priceMax = formData.get("price_max") ? Number(formData.get("price_max")) : null;
  const sizeId = formData.get("size_id") as string;
  const catalogIds = (formData.get("catalog_ids") as string) || null;
  const brandIds = (formData.get("brand_ids") as string) || null;
  const colorIds = (formData.get("color_ids") as string) || null;
  const statusIds = (formData.get("status_ids") as string) || null;
  const region = (formData.get("region") as string) || "de";
  const allowedCountries = (formData.get("allowed_countries") as string) || null;
  const discordWebhook = (formData.get("discord_webhook") as string) || null;
  const proxyGroupRaw = formData.get("proxy_group_id") as string;

  const normalizedName = name?.trim() ?? "";
  const normalizedQuery = query?.trim() ?? "";

  if (!normalizedName) throw new Error("Name is required");
  if (normalizedName.length > 255) throw new Error("Name is too long");
  if (normalizedQuery.length > 255) throw new Error("Keywords are too long");

  let proxyGroupId: number | null = null;

  if (proxyGroupRaw && proxyGroupRaw !== "server") {
    const pgId = parseInt(proxyGroupRaw);
    if (!isNaN(pgId)) {
      const group = await db.proxy_groups.findFirst({
        where: { id: pgId, userId: session.user.id },
      });
      if (!group) throw new Error("Invalid proxy group");
      proxyGroupId = pgId;
    }
  } else if (proxyGroupRaw === "server") {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "premium" && user?.role !== "admin") {
      throw new Error("Server proxies require a premium account");
    }
    proxyGroupId = null;
  } else {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role === "free") {
      throw new Error("You must select a proxy group");
    }
  }

  const urlToSave = discordWebhook?.trim() || null;
  if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
    throw new Error("Invalid Discord Webhook URL");
  }

  const monitor = await db.monitors.create({
    data: {
      userId: session.user.id,
      name: normalizedName,
      query: normalizedQuery,
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
      status: "active",
      webhook_active: urlToSave ? true : false,
    },
  });

  if (monitor.discord_webhook && monitor.webhook_active) {
    try {
      const payload = {
        username: "Vintrack Monitor",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
        embeds: [
          {
            title: "🚀 New Monitor Created & Started",
            description: `The monitor **${monitor.name}** has been successfully created and is now active.`,
            color: 3066993, // Green
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
  redirect(`/monitors/${monitor.id}`);
}

export async function updateMonitor(id: number, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const query = formData.get("query") as string;
  const priceMin = formData.get("price_min") ? Number(formData.get("price_min")) : null;
  const priceMax = formData.get("price_max") ? Number(formData.get("price_max")) : null;
  const sizeId = formData.get("size_id") as string;
  const catalogIds = (formData.get("catalog_ids") as string) || null;
  const brandIds = (formData.get("brand_ids") as string) || null;
  const colorIds = (formData.get("color_ids") as string) || null;
  const statusIds = (formData.get("status_ids") as string) || null;
  const region = (formData.get("region") as string) || "de";
  const allowedCountries = (formData.get("allowed_countries") as string) || null;
  const returnTo = (formData.get("return_to") as string) || "detail";
  const discordWebhook = (formData.get("discord_webhook") as string) || null;
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

  let proxyGroupId: number | null = null;

  if (proxyGroupRaw && proxyGroupRaw !== "server") {
    const pgId = parseInt(proxyGroupRaw);
    if (!isNaN(pgId)) {
      const group = await db.proxy_groups.findFirst({
        where: { id: pgId, userId: session.user.id },
      });
      if (!group) throw new Error("Invalid proxy group");
      proxyGroupId = pgId;
    }
  } else if (proxyGroupRaw === "server") {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "premium" && user?.role !== "admin") {
      throw new Error("Server proxies require a premium account");
    }
    proxyGroupId = null;
  }

  const urlToSave = discordWebhook?.trim() || null;
  if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
    throw new Error("Invalid Discord Webhook URL");
  }

  await db.monitors.update({
    where: { id, userId: session.user.id },
    data: {
      name: normalizedName,
      query: normalizedQuery,
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
      ...(urlToSave ? { webhook_active: true } : {}),
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
  const priceMin = formData.get("price_min") ? Number(formData.get("price_min")) : null;
  const priceMax = formData.get("price_max") ? Number(formData.get("price_max")) : null;
  const sizeId = formData.get("size_id") as string;
  const catalogIds = (formData.get("catalog_ids") as string) || null;
  const brandIds = (formData.get("brand_ids") as string) || null;
  const colorIds = (formData.get("color_ids") as string) || null;
  const statusIds = (formData.get("status_ids") as string) || null;
  const region = (formData.get("region") as string) || "de";
  const allowedCountries = (formData.get("allowed_countries") as string) || null;
  const returnTo = (formData.get("return_to") as string) || "detail";
  const discordWebhook = (formData.get("discord_webhook") as string) || null;
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

  let proxyGroupId: number | null = null;

  if (proxyGroupRaw && proxyGroupRaw !== "server") {
    const pgId = parseInt(proxyGroupRaw);
    if (!isNaN(pgId)) {
      const group = await db.proxy_groups.findFirst({
        where: { id: pgId, userId: session.user.id },
      });
      if (!group) throw new Error("Invalid proxy group");
      proxyGroupId = pgId;
    }
  } else if (proxyGroupRaw === "server") {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "premium" && user?.role !== "admin") {
      throw new Error("Server proxies require a premium account");
    }
    proxyGroupId = null;
  }

  const urlToSave = discordWebhook?.trim() || null;
  if (urlToSave && !isValidDiscordWebhook(urlToSave)) {
    throw new Error("Invalid Discord Webhook URL");
  }

  await db.monitors.update({
    where: { id, userId: session.user.id },
    data: {
      name: normalizedName,
      query: normalizedQuery,
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
      ...(urlToSave ? { webhook_active: true } : {}),
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
  
  const monitor = await db.monitors.update({
    where: { id, userId: session.user.id },
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
            color: isStarting ? 3066993 : 16753920, // Green for start, Orange for pause
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

  revalidatePath(`/monitors/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteMonitor(id: number) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.monitors.deleteMany({ 
    where: { 
        id,
        userId: session.user.id!
    } 
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
      avatar_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
      embeds: [
        {
          title: "🎉 Webhook Successfully Connected",
          description: "Your Discord webhook is configured correctly. You will now receive new items here as soon as they are found!",
          color: 1403248,
          thumbnail: {
            url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png",
          },
          fields: [
            {
              name: "Status",
              value: "✅ Active",
              inline: true,
            }
          ],
          footer: {
            text: "Vintrack • Setup Complete",
            icon_url: "https://cdn-icons-png.flaticon.com/512/8266/8266540.png"
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
  } catch (error: any) {
    return { error: error.message || "Failed to send webhook" };
  }
}
