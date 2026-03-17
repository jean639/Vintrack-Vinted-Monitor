import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AccountProvider } from "@/components/account-provider";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let role = "free";
  if (session?.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    role = dbUser?.role ?? "free";
  }

  const user = session?.user ? { ...session.user, role } : undefined;

  return (
    <AccountProvider>
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </AccountProvider>
  );
}
