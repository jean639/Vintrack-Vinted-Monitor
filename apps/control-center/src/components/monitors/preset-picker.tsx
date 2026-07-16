"use client";

import { Check, Footprints, Shirt, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    MONITOR_PRESETS,
    type MonitorPreset,
    type MonitorPresetKey,
} from "@/lib/monitor-presets";

const ICONS = {
    shirt: Shirt,
    sneaker: Footprints,
    sparkles: Sparkles,
} as const;

const ACCENTS = {
    violet: {
        shell: "from-violet-500/14 via-violet-500/5 to-transparent",
        icon: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
        selected:
            "border-violet-500/60 ring-2 ring-violet-500/15 dark:border-violet-400/60",
    },
    amber: {
        shell: "from-amber-500/16 via-amber-500/5 to-transparent",
        icon: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
        selected:
            "border-amber-500/60 ring-2 ring-amber-500/15 dark:border-amber-400/60",
    },
    emerald: {
        shell: "from-emerald-500/14 via-emerald-500/5 to-transparent",
        icon: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        selected:
            "border-emerald-500/60 ring-2 ring-emerald-500/15 dark:border-emerald-400/60",
    },
} as const;

export function MonitorPresetPicker({
    selected,
    onSelect,
    compact = false,
}: {
    selected: MonitorPresetKey | null;
    onSelect: (preset: MonitorPreset) => void;
    compact?: boolean;
}) {
    return (
        <div
            className="grid gap-3 md:grid-cols-3"
            role="radiogroup"
            aria-label="Monitor presets"
        >
            {MONITOR_PRESETS.map((preset) => {
                const Icon = ICONS[preset.icon];
                const accent = ACCENTS[preset.accent];
                const isSelected = selected === preset.key;

                return (
                    <button
                        key={preset.key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`monitor-preset-${preset.key}`}
                        onClick={() => onSelect(preset)}
                        className={cn(
                            "border-border/70 bg-card hover:border-foreground/25 focus-visible:ring-ring relative overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow,transform] outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2",
                            compact ? "min-h-36 p-4" : "min-h-44 p-5",
                            isSelected && accent.selected,
                        )}
                    >
                        <div
                            className={cn(
                                "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                                accent.shell,
                            )}
                        />
                        <div className="relative flex h-full flex-col">
                            <div className="flex items-start justify-between gap-3">
                                <span
                                    className={cn(
                                        "flex size-9 items-center justify-center rounded-lg",
                                        accent.icon,
                                    )}
                                >
                                    <Icon className="size-4.5" />
                                </span>
                                <span
                                    className={cn(
                                        "flex size-6 items-center justify-center rounded-full border transition-opacity",
                                        isSelected
                                            ? "border-foreground bg-foreground text-background opacity-100"
                                            : "border-border bg-background/70 opacity-0",
                                    )}
                                    aria-hidden="true"
                                >
                                    <Check className="size-3.5" />
                                </span>
                            </div>
                            <div className={cn("mt-auto", compact && "pt-5")}>
                                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                                    {preset.eyebrow}
                                </p>
                                <p className="mt-1.5 text-sm font-semibold">
                                    {preset.name}
                                </p>
                                {!compact && (
                                    <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                                        {preset.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
