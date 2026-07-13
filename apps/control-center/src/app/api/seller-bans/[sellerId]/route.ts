import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ sellerId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sellerId } = await params;
    if (!/^\d+$/.test(sellerId)) {
        return NextResponse.json(
            { error: "Invalid seller_id" },
            { status: 400 },
        );
    }

    await db.seller_bans.deleteMany({
        where: {
            userId: session.user.id,
            seller_id: BigInt(sellerId),
        },
    });

    return NextResponse.json({ success: true });
}
