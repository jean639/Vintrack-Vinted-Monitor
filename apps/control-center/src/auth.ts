import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(db),
    session: {
        strategy: "database",
        maxAge: 180 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
    },
    providers: [Discord],
    pages: {
        signIn: "/login",
        signOut: "/logout",
    },
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                const dbUser = await db.user.findUnique({
                    where: { id: user.id },
                    select: { role: true },
                });
                session.user.role = dbUser?.role ?? "free";
            }
            return session;
        },
    },
});
