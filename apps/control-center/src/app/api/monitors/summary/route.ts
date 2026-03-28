import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [activeMonitors, totalMonitors] = await Promise.all([
      db.monitors.count({
        where: {
          userId: session.user.id,
          status: "active",
        },
      }),
      db.monitors.count({
        where: {
          userId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({
      activeMonitors,
      totalMonitors,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
