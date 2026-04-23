"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { BRANDS, type Brand } from "@/lib/brands";
import { Check, Loader2, Search, X } from "lucide-react";

interface BrandPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  catalogIds?: string[];
}

const BRAND_CACHE_KEY = "vintrack.brand-cache.v1";

function mergeBrands(...brandGroups: Brand[][]) {
  const brandsById = new Map<string, Brand>();

  for (const brands of brandGroups) {
    for (const brand of brands) {
      brandsById.set(brand.id, brand);
    }
  }

  return [...brandsById.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function BrandPicker({ selected, onChange, catalogIds = [] }: BrandPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [remoteBrands, setRemoteBrands] = useState<Brand[]>([]);
  const [cachedBrands, setCachedBrands] = useState<Brand[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
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

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(BRAND_CACHE_KEY) || "[]");
      if (Array.isArray(cached)) {
        setCachedBrands(
          cached.filter(
            (brand): brand is Brand =>
              typeof brand?.id === "string" && typeof brand?.label === "string"
          )
        );
      }
    } catch {
      setCachedBrands([]);
    }
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setRemoteBrands([]);
      setLoadingRemote(false);
      setRemoteError(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingRemote(true);
      setRemoteError(false);

      const params = new URLSearchParams({ query: normalizedQuery });
      if (catalogIds.length > 0) {
        params.set("catalog_ids", catalogIds.join(","));
      }

      try {
        const response = await fetch(`/api/catalog/brands?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Brand search failed");
        }

        if (!controller.signal.aborted) {
          const brands = Array.isArray(data.brands) ? data.brands : [];
          setRemoteBrands(
            brands.filter(
              (brand: unknown): brand is Brand =>
                typeof (brand as Brand)?.id === "string" &&
                typeof (brand as Brand)?.label === "string"
            )
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setRemoteBrands([]);
          setRemoteError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRemote(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [catalogIds, query]);

  const allBrands = useMemo(
    () => mergeBrands(BRANDS, cachedBrands, remoteBrands),
    [cachedBrands, remoteBrands]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allBrands.slice(0, 50);
    const q = query.toLowerCase();
    return allBrands.filter((b) => b.label.toLowerCase().includes(q)).slice(0, 50);
  }, [allBrands, query]);

  const selectedBrands = useMemo(
    () =>
      selected
        .map((id) => allBrands.find((b) => b.id === id) ?? { id, label: id })
        .filter(Boolean) as Brand[],
    [allBrands, selected]
  );

  const rememberBrand = (brand: Brand) => {
    setCachedBrands((current) => {
      const next = mergeBrands(current, [brand]).slice(0, 500);
      try {
        localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggle = (brand: Brand) => {
    if (selected.includes(brand.id)) {
      onChange(selected.filter((id) => id !== brand.id));
    } else {
      rememberBrand(brand);
      onChange([...selected, brand.id]);
      setQuery("");
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  return (
    <div ref={ref} className="relative">
      {selectedBrands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedBrands.map((brand) => (
            <span
              key={brand.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground border-primary text-[12px] font-medium border"
            >
              {brand.label}
              <button
                type="button"
                onClick={() => remove(brand.id)}
                className="hover:text-blue-900"
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
          placeholder="Search brand…"
          className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-[13px] outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-border transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-input bg-background shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">
              {loadingRemote
                ? "Searching Vinted..."
                : remoteError
                  ? "Vinted brand search unavailable"
                  : "No brand found"}
            </div>
          ) : (
            <>
              {filtered.map((brand) => {
                const isSelected = selected.includes(brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => toggle(brand)}
                    className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors flex items-center justify-between ${
                      isSelected ? "bg-accent text-accent-foreground font-medium" : ""
                    }`}
                  >
                    <span>{brand.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                  </button>
                );
              })}
              {loadingRemote && (
                <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching Vinted...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
