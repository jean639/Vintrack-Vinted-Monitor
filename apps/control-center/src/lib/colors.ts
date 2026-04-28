export type Color = { label: string; id: string; hex: string };

export const COLORS: Color[] = [
  { label: "Black", id: "1", hex: "#000000" },
  { label: "Brown", id: "2", hex: "#8B4513" },
  { label: "Grey", id: "3", hex: "#919191" },
  { label: "Beige", id: "4", hex: "#D4C5A9" },
  { label: "Pink", id: "5", hex: "#FF1493" },
  { label: "Purple", id: "6", hex: "#8B008B" },
  { label: "Red", id: "7", hex: "#DC143C" },
  { label: "Yellow", id: "8", hex: "#FFD700" },
  { label: "Blue", id: "9", hex: "#1E90FF" },
  { label: "Green", id: "10", hex: "#228B22" },
  { label: "Orange", id: "11", hex: "#FF8C00" },
  { label: "White", id: "12", hex: "#FFFFFF" },
  { label: "Silver", id: "13", hex: "#C0C0C0" },
  { label: "Gold", id: "14", hex: "#D4AF37" },
  { label: "Multicolor", id: "15", hex: "multi" },
  { label: "Khaki", id: "16", hex: "#6B7A4F" },
  { label: "Turquoise", id: "17", hex: "#40E0D0" },
  { label: "Cream", id: "20", hex: "#F5F0E1" },
  { label: "Apricot", id: "21", hex: "#FBCEB1" },
  { label: "Coral", id: "22", hex: "#FF7F50" },
  { label: "Burgundy", id: "23", hex: "#722F37" },
  { label: "Rose", id: "24", hex: "#F4A7B9" },
  { label: "Lilac", id: "25", hex: "#C8A2C8" },
  { label: "Light Blue", id: "26", hex: "#87CEEB" },
  { label: "Navy", id: "27", hex: "#000080" },
  { label: "Dark Green", id: "28", hex: "#006400" },
  { label: "Mustard", id: "29", hex: "#D4A017" },
  { label: "Mint", id: "30", hex: "#98FF98" },
  { label: "Transparent", id: "32", hex: "transparent" },
];

const COLORS_BY_ID: Record<string, Color> = Object.create(null);
for (const color of COLORS) {
  COLORS_BY_ID[color.id] = color;
}

export function getColorLabels(ids: string): string[] {
  return ids
    .split(",")
    .map((id) => COLORS_BY_ID[id.trim()]?.label)
    .filter(Boolean) as string[];
}
