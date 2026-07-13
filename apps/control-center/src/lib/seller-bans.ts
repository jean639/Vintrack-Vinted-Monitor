import { db } from "@/lib/db";

export async function getBannedSellerIds(userId: string) {
    const bans = await db.seller_bans.findMany({
        where: { userId },
        select: { seller_id: true },
    });
    return bans.map((ban) => ban.seller_id);
}

export function visibleSellerWhere(bannedSellerIds: bigint[]) {
    if (bannedSellerIds.length === 0) return {};
    return {
        OR: [
            { seller_id: null },
            { seller_id: { notIn: bannedSellerIds } },
        ],
    };
}

export function buildSellerProfileUrl(
    sellerId: string | number | bigint | null | undefined,
    sellerLogin?: string | null,
    itemUrl?: string | null,
) {
    if (!sellerId) return null;

    let host = "www.vinted.de";
    if (itemUrl) {
        try {
            host = new URL(itemUrl).host;
        } catch {}
    }

    const id = String(sellerId);
    const login = sellerLogin?.trim();
    const path = login ? `${id}-${login}` : id;
    return `https://${host}/member/${path}`;
}
