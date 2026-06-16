function envValue(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

export const oidcIssuer = envValue("AUTH_OIDC_ISSUER");
export const oidcClientId = envValue("AUTH_OIDC_CLIENT_ID");
export const oidcClientSecret = envValue("AUTH_OIDC_CLIENT_SECRET");
export const oidcName = envValue("AUTH_OIDC_NAME") ?? "SSO";

export const oidcConfigured =
    !!oidcIssuer && !!oidcClientId && !!oidcClientSecret;
