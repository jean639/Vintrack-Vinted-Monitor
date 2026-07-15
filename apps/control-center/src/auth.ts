import NextAuth from "next-auth";
import { cache } from "react";
import type { Session } from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import type { Provider } from "@auth/core/providers";
import {
    oidcClientId,
    oidcClientSecret,
    oidcConfigured,
    oidcIssuer,
    oidcName,
} from "@/lib/auth-provider";

const providers: Provider[] = oidcConfigured
    ? [
          {
              id: "oidc",
              name: oidcName,
              type: "oidc",
              issuer: oidcIssuer!,
              clientId: oidcClientId!,
              clientSecret: oidcClientSecret!,
          },
      ]
    : [Discord];

const authResult = NextAuth({
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
                session.user.role = user.role ?? "free";
            }
            return session;
        },
    },
});

export const { handlers, signIn, signOut } = authResult;

async function getAuthSession(): Promise<Session | null> {
    if (process.env.E2E_TEST_MODE === "true") {
        const userId = process.env.E2E_TEST_USER_ID ?? "e2e-user";
        return {
            user: {
                id: userId,
                name: "E2E User",
                email: "e2e@vintrack.test",
                image: null,
                role: "admin",
            },
            expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
    }

    return authResult.auth() as Promise<Session | null>;
}

export const auth = cache(getAuthSession);
