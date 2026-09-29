// PLACEHOLDER CONTENT — not the real product bundles or prices.
// The founder decided (2026-09-28) that a "package" is a physical product
// bundle, but hasn't provided the actual products/prices yet (see the PRD's
// Open Questions and .claude/references/quiz-content.md). Every name below is
// prefixed "[PLACEHOLDER]" so it's never mistaken for real content. Replace the
// data here when the real bundles arrive — callers should not need to change.

import type { SkinPackage, SkinType } from "@/lib/quiz/types";

// Prices are charged in INR (founder decision, 2026-09-29), so priceInCents
// holds paise. The amounts themselves are still placeholders.
const PACKAGES: Record<SkinType, SkinPackage> = {
  dry: {
    id: "bundle-a",
    name: "[PLACEHOLDER] Bundle A",
    products: ["[PLACEHOLDER] Product A1", "[PLACEHOLDER] Product A2", "[PLACEHOLDER] Product A3"],
    priceInCents: 9900,
    currency: "INR",
  },
  sensitive: {
    id: "bundle-b",
    name: "[PLACEHOLDER] Bundle B",
    products: ["[PLACEHOLDER] Product B1", "[PLACEHOLDER] Product B2", "[PLACEHOLDER] Product B3"],
    priceInCents: 9900,
    currency: "INR",
  },
  oily: {
    id: "bundle-c",
    name: "[PLACEHOLDER] Bundle C",
    products: ["[PLACEHOLDER] Product C1", "[PLACEHOLDER] Product C2", "[PLACEHOLDER] Product C3"],
    priceInCents: 9900,
    currency: "INR",
  },
};

export function getPackageForSkinType(skinType: SkinType): SkinPackage {
  return PACKAGES[skinType];
}

// `/ 100` assumes a two-decimal currency (true for SGD/USD/INR);
// zero-decimal currencies (e.g. JPY) would need handling here.
export function formatPrice(priceInCents: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(priceInCents / 100);
}
