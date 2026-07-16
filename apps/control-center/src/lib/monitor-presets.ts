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
    | "levis-501"
    | "carhartt"
    | "nike-dunk-low"
    | "adidas-samba";

export type MonitorPreset = {
    key: MonitorPresetKey;
    name: string;
    eyebrow: string;
    description: string;
    query: string;
    antiKeywords: readonly string[];
    priceMin: number;
    priceMax: number;
    sizeGroupKey: string;
    sizeIds: readonly string[];
    catalogIds: readonly string[];
    brandIds: readonly string[];
    colorIds: readonly string[];
    statusIds: readonly string[];
    icon: "shirt" | "sneaker" | "sparkles" | "tag" | "workwear";
    accent: "violet" | "sky" | "amber" | "rose" | "emerald";
};

const CLEAN_CONDITIONS = ["6", "1", "2"] as const;
const RESALE_ANTI_KEYWORDS = [
    "fake",
    "replica",
    "replika",
    "defekt",
    "beschädigt",
] as const;
const CLOTHING_SIZES = [
    "206",
    "207",
    "208",
    "209",
    "210",
    "211",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
] as const;
const JEANS_SIZES = [
    "1634",
    "1635",
    "1636",
    "1637",
    "1638",
    "1639",
    "1640",
    "1641",
    "1642",
] as const;
const SNEAKER_SIZES = [
    "59",
    "60",
    "61",
    "62",
    "778",
    "780",
    "782",
    "784",
    "786",
    "788",
] as const;

export const MONITOR_PRESETS: readonly MonitorPreset[] = [
    {
        key: "ralph-lauren",
        name: "Ralph Lauren",
        eyebrow: "Brand-wide search",
        description: "Clothing · €10–150 · popular sizes and colors",
        query: "",
        antiKeywords: RESALE_ANTI_KEYWORDS,
        priceMin: 10,
        priceMax: 150,
        sizeGroupKey: "14",
        sizeIds: CLOTHING_SIZES,
        catalogIds: ["1904", "5"],
        brandIds: ["88", "4273"],
        colorIds: ["1", "2", "3", "4", "9", "12", "27"],
        statusIds: CLEAN_CONDITIONS,
        icon: "shirt",
        accent: "violet",
    },
    {
        key: "levis-501",
        name: "Levi's 501",
        eyebrow: "Denim staple",
        description: "Jeans · €10–100 · W26–W34 · blue and black",
        query: "501",
        antiKeywords: RESALE_ANTI_KEYWORDS,
        priceMin: 10,
        priceMax: 100,
        sizeGroupKey: "77",
        sizeIds: JEANS_SIZES,
        catalogIds: ["183", "257"],
        brandIds: ["10"],
        colorIds: ["9", "27", "1", "3"],
        statusIds: CLEAN_CONDITIONS,
        icon: "tag",
        accent: "sky",
    },
    {
        key: "carhartt",
        name: "Carhartt",
        eyebrow: "Workwear favorite",
        description: "Clothing · €10–180 · Carhartt and WIP",
        query: "",
        antiKeywords: RESALE_ANTI_KEYWORDS,
        priceMin: 10,
        priceMax: 180,
        sizeGroupKey: "14",
        sizeIds: CLOTHING_SIZES,
        catalogIds: ["1904", "5"],
        brandIds: ["362", "872289"],
        colorIds: ["1", "2", "4", "10", "16", "28"],
        statusIds: CLEAN_CONDITIONS,
        icon: "workwear",
        accent: "amber",
    },
    {
        key: "nike-dunk-low",
        name: "Nike Dunk Low",
        eyebrow: "Popular sneaker",
        description: "Sneakers · €30–220 · common EU 39–44 sizes",
        query: "Dunk Low",
        antiKeywords: RESALE_ANTI_KEYWORDS,
        priceMin: 30,
        priceMax: 220,
        sizeGroupKey: "7",
        sizeIds: SNEAKER_SIZES,
        catalogIds: ["2632", "1242"],
        brandIds: ["53"],
        colorIds: ["1", "3", "7", "9", "10", "12", "15"],
        statusIds: CLEAN_CONDITIONS,
        icon: "sneaker",
        accent: "rose",
    },
    {
        key: "adidas-samba",
        name: "Adidas Samba",
        eyebrow: "Trending classic",
        description: "Sneakers · €25–180 · common EU 39–44 sizes",
        query: "Samba",
        antiKeywords: RESALE_ANTI_KEYWORDS,
        priceMin: 25,
        priceMax: 180,
        sizeGroupKey: "7",
        sizeIds: SNEAKER_SIZES,
        catalogIds: ["2632", "1242"],
        brandIds: ["14"],
        colorIds: ["1", "3", "4", "12", "20"],
        statusIds: CLEAN_CONDITIONS,
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
