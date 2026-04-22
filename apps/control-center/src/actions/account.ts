"use server";

import { auth } from "@/auth";

const API_URL = process.env.VINTED_SERVICE_URL || "http://localhost:4000";

type ApiError = { error: string };
type ApiResult<T extends object> = (T & { error?: never }) | ApiError;

type VintedAccountStatus = {
    linked: boolean;
    status?: string;
    vinted_name?: string;
    vinted_id?: number;
    domain?: string;
    linked_at?: string;
    last_check?: string;
    last_refresh_at?: string;
    last_valid_at?: string;
    invalid_reason?: string;
    has_refresh_token?: boolean;
    requires_browser_reauth?: boolean;
    has_browser_session?: boolean;
    browser_linked?: boolean;
    last_browser_sync?: string;
    has_phone_number?: boolean;
};

async function apiFetch<T extends object = Record<string, unknown>>(
    path: string,
    options: RequestInit = {},
): Promise<ApiResult<T>> {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Not authenticated" };
    }

    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": session.user.id,
                ...options.headers,
            },
            cache: "no-store",
        });
    } catch {
        return { error: "Vinted service unreachable" };
    }

    let data: T;
    try {
        data = (await res.json()) as T;
    } catch {
        return { error: `Request failed (${res.status})` };
    }

    if (!res.ok) {
        const errorData = data as Record<string, unknown>;
        return {
            error:
                typeof errorData.error === "string"
                    ? errorData.error
                    : `Request failed (${res.status})`,
        };
    }

    return data as T & { error?: never };
}

export async function getAccountStatus(): Promise<VintedAccountStatus> {
    const data = await apiFetch<VintedAccountStatus>("/api/account/status");
    if ("error" in data) return { linked: false };
    return data;
}

export async function linkVintedAccount(
  accessToken: string,
  domain: string,
  refreshToken?: string,
  phoneNumber?: string,
) {
    return apiFetch<{
        linked: boolean;
        vinted_name: string;
        vinted_id: number;
        domain: string;
        has_browser_session: boolean;
        browser_linked: boolean;
        last_browser_sync?: string;
        has_phone_number: boolean;
    }>("/api/account/link", {
        method: "POST",
        body: JSON.stringify({
            access_token: accessToken,
            domain,
            refresh_token: refreshToken || "",
            phone_number: phoneNumber || "",
        }),
    });
}

export async function unlinkVintedAccount() {
    return apiFetch("/api/account/unlink", {
        method: "DELETE",
    });
}

export async function updateVintedPhoneNumber(phoneNumber: string) {
    return apiFetch<{
        has_phone_number: boolean;
        last_check: string;
    }>("/api/account/phone", {
        method: "POST",
        body: JSON.stringify({ phone_number: phoneNumber }),
    });
}

export async function updateVintedDomain(domain: string) {
    return apiFetch<{
        domain: string;
        last_check: string;
    }>("/api/account/domain", {
        method: "POST",
        body: JSON.stringify({ domain }),
    });
}

export async function getVintedAccountInfo() {
    return apiFetch("/api/account/info");
}

export async function refreshVintedSession() {
    return apiFetch("/api/account/refresh", {
        method: "POST",
    });
}

export async function likeItem(itemId: number) {
    return apiFetch("/api/items/like", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId }),
    });
}

export async function unlikeItem(itemId: number) {
    return apiFetch("/api/items/unlike", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId }),
    });
}
