import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import {
    buildSellerProfileUrl,
    getBannedSellerIds,
    visibleSellerWhere,
} from "@/lib/seller-bans";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const monitorId = parseInt(id);

    if (isNaN(monitorId))
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const monitor = await db.monitors.findFirst({
        where: { id: monitorId, userId: session.user.id },
    });

    if (!monitor) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const bannedSellerIds = await getBannedSellerIds(session.user.id);
        const items = await db.items.findMany({
            where: {
                monitor_id: monitorId,
                ...visibleSellerWhere(bannedSellerIds),
            },
            orderBy: { found_at: "desc" },
            take: 50,
            select: {
                id: true,
                monitor_id: true,
                title: true,
                brand: true,
                price: true,
                total_price: true,
                size: true,
                condition: true,
                url: true,
                image_url: true,
                extra_images: true,
                found_at: true,
                location: true,
                rating: true,
                seller_id: true,
                seller_login: true,
                seller_profile_url: true,
            },
        });

        const safeItems = items.map((item) => ({
            ...item,
            id: item.id.toString(),
            seller_id: item.seller_id?.toString() || null,
            seller_profile_url:
                item.seller_profile_url ||
                buildSellerProfileUrl(
                    item.seller_id,
                    item.seller_login,
                    item.url,
                ),
        }));

        return NextResponse.json(safeItems);
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
