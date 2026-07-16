export const MONITOR_ONBOARDING_STATUSES = [
    "pending",
    "dismissed",
    "completed",
    "ineligible",
] as const;

export type MonitorOnboardingStatus =
    (typeof MONITOR_ONBOARDING_STATUSES)[number];

export type MonitorPresetKey =
    | "ralph-lauren"
    | "nike-dunk-low"
    | "adidas-samba";

export type MonitorPreset = {
    key: MonitorPresetKey;
    name: string;
    eyebrow: string;
    description: string;
    query: string;
    brandIds: string[];
    icon: "shirt" | "sneaker" | "sparkles";
    accent: "violet" | "amber" | "emerald";
};

export const MONITOR_PRESETS: readonly MonitorPreset[] = [
    {
        key: "ralph-lauren",
        name: "Ralph Lauren",
        eyebrow: "Brand-wide search",
        description: "Ralph Lauren and Polo Ralph Lauren listings.",
        query: "",
        brandIds: ["88", "4273"],
        icon: "shirt",
        accent: "violet",
    },
    {
        key: "nike-dunk-low",
        name: "Nike Dunk Low",
        eyebrow: "Popular sneaker",
        description: "Fresh Dunk Low listings filtered to Nike.",
        query: "Dunk Low",
        brandIds: ["53"],
        icon: "sneaker",
        accent: "amber",
    },
    {
        key: "adidas-samba",
        name: "Adidas Samba",
        eyebrow: "Trending classic",
        description: "New Samba listings filtered to adidas.",
        query: "Samba",
        brandIds: ["14"],
        icon: "sparkles",
        accent: "emerald",
    },
] as const;

export function getMonitorPreset(value: unknown): MonitorPreset | null {
    if (typeof value !== "string") return null;
    return MONITOR_PRESETS.find((preset) => preset.key === value) ?? null;
}

export function normalizeMonitorOnboardingStatus(
    value: string | null | undefined,
): MonitorOnboardingStatus {
    return MONITOR_ONBOARDING_STATUSES.includes(
        value as MonitorOnboardingStatus,
    )
        ? (value as MonitorOnboardingStatus)
        : "ineligible";
}
