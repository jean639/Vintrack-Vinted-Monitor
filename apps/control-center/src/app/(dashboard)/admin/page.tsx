import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "admin") redirect("/dashboard");

  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      _count: {
        select: {
          monitors: true,
          proxy_groups: true,
        },
      },
      monitors: {
        orderBy: [
          { status: "asc" },
          { created_at: "desc" },
        ],
        select: {
          id: true,
          query: true,
          status: true,
          region: true,
          created_at: true,
          price_max: true,
          discord_webhook: true,
          webhook_active: true,
          proxy_group: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      },
    },
  });

  return <AdminClient users={users} currentUserId={session.user.id} />;
}
