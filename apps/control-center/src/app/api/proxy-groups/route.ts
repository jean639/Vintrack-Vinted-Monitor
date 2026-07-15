import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getFreeProxyPoolHealth } from "@/lib/free-proxy-health";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [groups, user, freeProxy] = await Promise.all([
        db.proxy_groups.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                name: true,
                proxies: true,
            },
            orderBy: { created_at: "desc" },
        }),
        db.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        }),
        getFreeProxyPoolHealth(),
    ]);

    return NextResponse.json({
        role: user?.role ?? "free",
        groups: groups.map((g) => ({
            id: g.id,
            name: g.name,
            proxyCount: g.proxies.split("\n").filter((l) => l.trim()).length,
        })),
        freeProxy,
    });
}
