import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AccountProvider } from "@/components/account-provider";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let role = "free";
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  role = dbUser?.role ?? "free";

  const user = { ...session.user, role };

  return (
    <AccountProvider>
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </AccountProvider>
  );
}
