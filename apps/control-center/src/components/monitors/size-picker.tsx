"use client";

import { useState } from "react";
import { SIZE_GROUPS } from "@/lib/sizes";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SizePickerProps {
    selected: string[];
    onChange: (ids: string[]) => void;
}

export function SizePicker({ selected, onChange }: SizePickerProps) {
    const [activeGroup, setActiveGroup] = useState<string>("14");
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const group = SIZE_GROUPS.find((g) => g.key === activeGroup);

    const toggle = (id: number) => {
        const sid = String(id);
        if (selected.includes(sid)) {
            onChange(selected.filter((s) => s !== sid));
        } else {
            onChange([...selected, sid]);
        }
    };

    const activeLabel =
        SIZE_GROUPS.find((g) => g.key === activeGroup)?.label ?? "Size Type";

    return (
        <div className="space-y-2.5">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="border-input bg-background hover:bg-muted flex h-9 w-full items-center justify-between rounded-md border px-3 text-left text-[13px] transition-colors"
                >
                    <span className="truncate">{activeLabel}</span>
                    <ChevronDown
                        className={cn(
                            "text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform",
                            dropdownOpen && "rotate-180",
                        )}
                    />
                </button>
                {dropdownOpen && (
                    <div className="border-input bg-background absolute z-50 mt-1 w-full rounded-md border shadow-lg">
                        {SIZE_GROUPS.map((g) => (
                            <button
                                key={g.key}
                                type="button"
                                onClick={() => {
                                    setActiveGroup(g.key);
                                    setDropdownOpen(false);
                                }}
                                className={cn(
                                    "hover:bg-muted w-full px-3 py-1.5 text-left text-[13px] transition-colors",
                                    activeGroup === g.key &&
                                        "bg-muted font-medium",
                                )}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {group && (
                <div className="flex flex-wrap gap-1.5">
                    {group.sizes.map((size) => {
                        const isSelected = selected.includes(String(size.id));
                        return (
                            <button
                                key={size.id}
                                type="button"
                                onClick={() => toggle(size.id)}
                                className={cn(
                                    "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                                    isSelected
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background hover:bg-muted border-input text-muted-foreground",
                                )}
                            >
                                {size.label}
                                {isSelected && <Check className="h-3 w-3" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
