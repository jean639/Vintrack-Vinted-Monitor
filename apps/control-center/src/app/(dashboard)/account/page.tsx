import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { AccountStatus } from "./client";
import { AccountClient } from "./client";
import { getAccountStatus } from "@/actions/account";

export default async function AccountPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const status: AccountStatus = await getAccountStatus();
    const latestExtensionVersion =
        process.env.BROWSER_EXTENSION_LATEST_VERSION?.trim() || "0.1.4";
    const minimumExtensionVersion =
        process.env.BROWSER_EXTENSION_MIN_VERSION?.trim() ||
        latestExtensionVersion;

    return (
        <AccountClient
            initialStatus={status}
            latestExtensionVersion={latestExtensionVersion}
            minimumExtensionVersion={minimumExtensionVersion}
        />
    );
}
