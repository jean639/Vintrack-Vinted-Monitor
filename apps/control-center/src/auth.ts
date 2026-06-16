import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import type { Provider } from "@auth/core/providers";

const oidcConfigured =
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET;

const providers: Provider[] = oidcConfigured
    ? [
          {
              id: "oidc",
              name: process.env.AUTH_OIDC_NAME || "SSO",
              type: "oidc",
              issuer: process.env.AUTH_OIDC_ISSUER!,
              clientId: process.env.AUTH_OIDC_CLIENT_ID!,
              clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET!,
          },
      ]
    : [Discord];

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(db),
    session: {
        strategy: "database",
        maxAge: 180 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
    },
    providers,
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
