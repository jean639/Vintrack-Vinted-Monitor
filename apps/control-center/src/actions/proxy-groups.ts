"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const VALID_SCHEMES = ["http", "https", "socks4", "socks5"];
const BYTES_PER_GB = 1024 * 1024 * 1024;

function validateProxyLine(line: string): string | null {
    line = line.trim();
    if (!line) return null;

    if (/^(https?|socks[45]):\/\//.test(line)) {
        try {
            const u = new URL(line);
            if (!VALID_SCHEMES.includes(u.protocol.replace(":", "")))
                return null;
            if (!u.hostname || !u.port) return null;
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
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
        if (validateProxyLine(line)) {
            valid.push(line.trim());
        } else {
            invalid.push(line.trim());
        }
    }
    return { valid, invalid, total: lines.length };
}

function parseBandwidthLimitBytes(formData: FormData) {
    const rawValue = (
        formData.get("bandwidth_limit_gb") as string | null
    )?.trim();

    if (!rawValue) {
        return null;
    }

    const limitGb = Number(rawValue);
    if (!Number.isFinite(limitGb) || limitGb < 0) {
        throw new Error("Bandwidth limit must be a positive number");
    }

    if (limitGb === 0) {
        return null;
    }

    return BigInt(Math.round(limitGb * BYTES_PER_GB));
}

export async function getProxyGroups() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    return db.proxy_groups.findMany({
        where: { userId: session.user.id },
        orderBy: { created_at: "desc" },
        include: {
            _count: { select: { monitors: true } },
        },
    });
}

export async function createProxyGroup(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = (formData.get("name") as string)?.trim();
    const proxies = (formData.get("proxies") as string)?.trim();
    const bandwidthLimitBytes = parseBandwidthLimitBytes(formData);

    if (!name || !proxies) throw new Error("Name and proxies are required");

    const { valid, invalid, total } = validateProxies(proxies);
    if (valid.length === 0)
        throw new Error(
            "No valid proxies found. Use format: host:port:user:pass or http://user:pass@host:port",
        );
    if (invalid.length > 0) {
        console.warn(
            `[proxy-groups] ${invalid.length}/${total} invalid lines skipped for user ${session.user.id}`,
        );
    }

    await db.proxy_groups.create({
        data: {
            userId: session.user.id,
            name,
            proxies: valid.join("\n"),
            bandwidth_limit_bytes: bandwidthLimitBytes,
        },
    });

    revalidatePath("/proxies");
}

export async function deleteProxyGroup(id: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const group = await db.proxy_groups.findFirst({
        where: { id, userId: session.user.id },
        include: { _count: { select: { monitors: true } } },
    });

    if (!group) throw new Error("Not found");
    if (group._count.monitors > 0) {
        throw new Error("Cannot delete proxy group that is in use by monitors");
    }

    await db.proxy_groups.delete({
        where: { id },
    });

    revalidatePath("/proxies");
}

export async function updateProxyGroup(id: number, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = (formData.get("name") as string)?.trim();
    const proxies = (formData.get("proxies") as string)?.trim();
    const bandwidthLimitBytes = parseBandwidthLimitBytes(formData);

    if (!name || !proxies) throw new Error("Name and proxies are required");

    const { valid, invalid, total } = validateProxies(proxies);
    if (valid.length === 0)
        throw new Error(
            "No valid proxies found. Use format: host:port:user:pass or http://user:pass@host:port",
        );
    if (invalid.length > 0) {
        console.warn(
            `[proxy-groups] update ${id}: ${invalid.length}/${total} invalid lines skipped`,
        );
    }

    await db.proxy_groups.update({
        where: { id, userId: session.user.id },
        data: {
            name,
            proxies: valid.join("\n"),
            bandwidth_limit_bytes: bandwidthLimitBytes,
        },
    });

    revalidatePath("/proxies");
}

export async function resetProxyGroupBandwidth(id: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.proxy_groups.update({
        where: { id, userId: session.user.id },
        data: {
            bandwidth_rx_bytes: BigInt(0),
            bandwidth_tx_bytes: BigInt(0),
            bandwidth_reset_at: new Date(),
        },
    });

    revalidatePath("/proxies");
}
