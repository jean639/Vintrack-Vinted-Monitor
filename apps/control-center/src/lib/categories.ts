export type RawCategoryNode = {
  id: number;
  slug: string;
  size_id?: number;
  children: Record<string, RawCategoryNode>;
};

export type RawCategoryTree = Record<string, RawCategoryNode>;

export type CategoryNode = {
  id: number;
  label: string;
  slug: string;
  sizeId?: number;
  path: string[];
  children: CategoryNode[];
};

export function normalizeCategoryTree(
  tree: RawCategoryTree,
  parentPath: string[] = []
): CategoryNode[] {
  return Object.entries(tree).map(([label, node]) => {
    const path = [...parentPath, label];

    return {
      id: node.id,
      label,
      slug: node.slug,
      sizeId: node.size_id,
      path,
      children: normalizeCategoryTree(node.children ?? {}, path),
    };
  });
}

export function flattenCategoryTree(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

export function buildCategoryLabelMap(tree: CategoryNode[]): Record<string, string> {
  const labels: Record<string, string> = Object.create(null);

  const visit = (node: CategoryNode) => {
    labels[String(node.id)] = node.path.join(" › ");
    for (const child of node.children) {
      visit(child);
    }
  };

  for (const node of tree) {
    visit(node);
  }

  return labels;
}

export function getCategoryLabelsFromMap(
  catalogIds: string | null | undefined,
  labelMap: Record<string, string>
): string[] {
  if (!catalogIds) return [];

  return catalogIds
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => labelMap[value] ?? value);
}
