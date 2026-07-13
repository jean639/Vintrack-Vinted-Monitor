import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildSellerProfileUrl } from "@/lib/seller-bans";

export const dynamic = "force-dynamic";

function parseSellerId(value: unknown) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) return null;
    return BigInt(normalized);
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bans = await db.seller_bans.findMany({
        where: { userId: session.user.id },
        orderBy: { created_at: "desc" },
    });

    return NextResponse.json(
        bans.map((ban) => ({
            id: ban.id.toString(),
            seller_id: ban.seller_id.toString(),
            seller_login: ban.seller_login,
            seller_profile_url:
                ban.seller_profile_url ||
                buildSellerProfileUrl(ban.seller_id, ban.seller_login),
            created_at: ban.created_at.toISOString(),
        })),
    );
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
        seller_id?: unknown;
        seller_login?: unknown;
        seller_profile_url?: unknown;
        item_url?: unknown;
    };
    const sellerId = parseSellerId(body.seller_id);
    if (!sellerId) {
        return NextResponse.json(
            { error: "Invalid seller_id" },
            { status: 400 },
        );
    }

    const sellerLogin =
        typeof body.seller_login === "string"
            ? body.seller_login.trim().slice(0, 255) || null
            : null;
    const itemUrl = typeof body.item_url === "string" ? body.item_url : null;
    const rawProfileUrl =
        typeof body.seller_profile_url === "string"
            ? body.seller_profile_url.trim()
            : "";
    const sellerProfileUrl =
        rawProfileUrl || buildSellerProfileUrl(sellerId, sellerLogin, itemUrl);

    const ban = await db.seller_bans.upsert({
        where: {
            userId_seller_id: {
                userId: session.user.id,
                seller_id: sellerId,
            },
        },
        create: {
            userId: session.user.id,
            seller_id: sellerId,
            seller_login: sellerLogin,
            seller_profile_url: sellerProfileUrl,
        },
        update: {
            seller_login: sellerLogin,
            seller_profile_url: sellerProfileUrl,
        },
    });

    return NextResponse.json({
        id: ban.id.toString(),
        seller_id: ban.seller_id.toString(),
        seller_login: ban.seller_login,
        seller_profile_url: ban.seller_profile_url,
        created_at: ban.created_at.toISOString(),
    });
}
