"use client";

import { REGIONS } from "@/lib/regions";

interface CountryFilterPickerProps {
    selected: string[];
    onChange: (selected: string[]) => void;
}

export function CountryFilterPicker({
    selected,
    onChange,
}: CountryFilterPickerProps) {
    const toggleRegion = (code: string) => {
        if (selected.includes(code)) {
            onChange(selected.filter((c) => c !== code));
        } else {
            onChange([...selected, code]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {REGIONS.map((region) => {
                const isSelected = selected.includes(region.code);
                return (
                    <button
                        type="button"
                        key={region.code}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-input hover:bg-muted"
                        }`}
                        onClick={() => toggleRegion(region.code)}
                    >
                        <span>{region.flag}</span>
                        {region.label}
                    </button>
                );
            })}
        </div>
    );
}
