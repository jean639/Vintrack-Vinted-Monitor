import brandsData from "./brands.generated.json";

export type Brand = { label: string; id: string };

export const BRANDS: Brand[] = [...brandsData].sort((a, b) =>
    a.label.localeCompare(b.label),
);

const BRANDS_BY_ID: Record<string, Brand> = Object.create(null);
for (const brand of BRANDS) {
    BRANDS_BY_ID[brand.id] = brand;
}

export function getBrandLabel(id: string): string {
    return BRANDS_BY_ID[id]?.label ?? id;
}

export function getBrandLabels(brandIds: string | null | undefined): string[] {
    if (!brandIds) return [];
    return brandIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(getBrandLabel);
}
