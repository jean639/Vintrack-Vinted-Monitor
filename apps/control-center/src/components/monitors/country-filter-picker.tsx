"use client";

import { REGIONS } from "@/lib/regions";
import { Badge } from "@/components/ui/badge";

interface CountryFilterPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function CountryFilterPicker({ selected, onChange }: CountryFilterPickerProps) {
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
          <Badge
            key={region.code}
            variant={isSelected ? "default" : "outline"}
            className="cursor-pointer transition-colors"
            onClick={() => toggleRegion(region.code)}
          >
            <span className="mr-1">{region.flag}</span>
            {region.label}
          </Badge>
        );
      })}
    </div>
  );
}
