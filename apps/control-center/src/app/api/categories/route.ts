import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCategoryTreeForRegion } from "@/lib/categories.server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "de";
  const categories = await getCategoryTreeForRegion(region);

  return NextResponse.json({ categories });
}
