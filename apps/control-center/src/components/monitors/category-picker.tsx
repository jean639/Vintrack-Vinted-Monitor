"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  buildCategoryLabelMap,
  type CategoryNode,
} from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Loader2, X } from "lucide-react";

interface CategoryPickerProps {
  region: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  onSelectionMetaChange?: (meta: { selectedLabels: string[] }) => void;
}

function collectExpandedParents(nodes: CategoryNode[], selectedIds: Set<string>) {
  const expanded = new Set<string>();

  const visit = (node: CategoryNode): boolean => {
    let containsSelected = selectedIds.has(String(node.id));

    for (const child of node.children) {
      if (visit(child)) {
        expanded.add(String(node.id));
        containsSelected = true;
      }
    }

    return containsSelected;
  };

  for (const node of nodes) {
    visit(node);
  }

  return expanded;
}

export function CategoryPicker({
  region,
  selected,
  onChange,
  onSelectionMetaChange,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setLoading(true);

      try {
        const response = await fetch(`/api/categories?region=${region}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!controller.signal.aborted) {
          setCategories(data.categories ?? []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCategories([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCategories();
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    setExpandedIds(collectExpandedParents(categories, new Set(selected)));
  }, [categories, selected]);

  const labelMap = useMemo(() => buildCategoryLabelMap(categories), [categories]);

  const selectedLabels = useMemo(
    () =>
      selected.map((id) => ({
        id,
        label: labelMap[id] ?? id,
      })),
    [labelMap, selected]
  );

  useEffect(() => {
    onSelectionMetaChange?.({
      selectedLabels: selectedLabels.map((item) => item.label),
    });
  }, [onSelectionMetaChange, selectedLabels]);

  const toggle = (id: number) => {
    const idStr = String(id);
    if (selected.includes(idStr)) {
      onChange(selected.filter((value) => value !== idStr));
      return;
    }

    onChange([...selected, idStr]);
  };

  const toggleExpanded = (id: number) => {
    const idStr = String(id);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });
  };

  const renderTree = (nodes: CategoryNode[], depth = 0): ReactElement[] =>
    nodes.flatMap((node) => {
      const nodeId = String(node.id);
      const isExpanded = expandedIds.has(nodeId);
      const isSelected = selected.includes(nodeId);
      const hasChildren = node.children.length > 0;

      const row = (
        <div key={nodeId} className="border-b border-border/60 last:border-b-0">
          <div
            className={cn(
              "group flex items-center gap-2 px-2 py-1.5 transition-colors",
              isSelected ? "bg-primary/8" : "hover:bg-muted/60"
            )}
            style={{ paddingLeft: `${10 + depth * 18}px` }}
          >
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent hover:border-primary/40"
              )}
              aria-label={`Toggle ${node.label}`}
            >
              <Check className="h-3 w-3" />
            </button>

            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpanded(node.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
                />
              </button>
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}

            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="flex min-w-0 flex-1 items-center rounded-lg px-2 py-1 text-left"
            >
              <div className="min-w-0">
                <div
                  className={cn(
                    "truncate text-[13px]",
                    isSelected ? "font-semibold text-foreground" : "text-foreground/90"
                  )}
                >
                  {node.label}
                </div>
                {depth > 0 && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {node.path.slice(0, -1).join(" › ")}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      );

      if (!hasChildren || !isExpanded) {
        return [row];
      }

      return [row, ...renderTree(node.children, depth + 1)];
    });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-muted/20">
        <div className="border-b border-border/70 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-foreground">Vinted Categories</div>
              <div className="text-[11px] text-muted-foreground">
                Drill down through the full {region.toUpperCase()} category tree.
              </div>
            </div>
            <div className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {selected.length} selected
            </div>
          </div>
        </div>

        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border/70 px-3 py-3">
            {selectedLabels.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-foreground"
              >
                <span className="max-w-[320px] truncate">{item.label}</span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((value) => value !== item.id))}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label={`Remove ${item.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-112 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading categories...
            </div>
          ) : categories.length > 0 ? (
            <div>{renderTree(categories)}</div>
          ) : (
            <div className="px-4 py-6 text-[13px] text-muted-foreground">
              No categories available for this region.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
