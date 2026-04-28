"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { COLORS, type Color } from "@/lib/colors";
import { X, Search } from "lucide-react";

interface ColorPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ColorPicker({ selected, onChange }: ColorPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return COLORS;
    const q = query.toLowerCase();
    return COLORS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const selectedColors = useMemo(
    () =>
      selected
        .map((id) => COLORS.find((c) => c.id === id))
        .filter(Boolean) as Color[],
    [selected]
  );

  const toggle = (color: Color) => {
    if (selected.includes(color.id)) {
      onChange(selected.filter((id) => id !== color.id));
    } else {
      onChange([...selected, color.id]);
      setQuery("");
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  function ColorDot({ hex, size = 14 }: { hex: string; size?: number }) {
    if (hex === "multi") {
      return (
        <span
          className="inline-block rounded-full border border-input shrink-0"
          style={{
            width: size,
            height: size,
            background:
              "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
          }}
        />
      );
    }
    if (hex === "transparent") {
      return (
        <span
          className="inline-block rounded-full border border-input shrink-0"
          style={{
            width: size,
            height: size,
            background:
              "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%), repeating-conic-gradient(#ffffff 0% 25%, #d4d4d8 0% 50%) 50% / 6px 6px",
          }}
        />
      );
    }
    return (
      <span
        className="inline-block rounded-full border border-input shrink-0"
        style={{ width: size, height: size, backgroundColor: hex }}
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedColors.map((color) => (
            <span
              key={color.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[12px] font-medium border border-primary"
            >
              <ColorDot hex={color.hex} size={12} />
              {color.label}
              <button
                type="button"
                onClick={() => remove(color.id)}
                className="hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search color…"
          className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-[13px] outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-border transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-input bg-background shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">
              No color found
            </div>
          ) : (
            filtered.map((color) => {
              const isSelected = selected.includes(color.id);
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => toggle(color)}
                  className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors flex items-center justify-between ${
                    isSelected ? "bg-accent text-accent-foreground font-medium" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ColorDot hex={color.hex} />
                    {color.label}
                  </span>
                  {isSelected && (
                    <span className="text-[11px] text-primary">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
