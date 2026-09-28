import { describe, expect, it } from "vitest";
import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";

// Assertions check structure, not the [PLACEHOLDER] literals, so these tests
// stay valid when real bundle content replaces the placeholders.
const SKIN_TYPES: SkinType[] = ["dry", "sensitive", "oily"];

describe("getPackageForSkinType", () => {
  it.each(SKIN_TYPES)("returns a well-formed package for %s", (skinType) => {
    const pkg = getPackageForSkinType(skinType);

    expect(pkg.name.length).toBeGreaterThan(0);
    expect(pkg.products.length).toBeGreaterThan(0);
    expect(Number.isInteger(pkg.priceInCents)).toBe(true);
    expect(pkg.priceInCents).toBeGreaterThan(0);
    expect(pkg.currency).toMatch(/^[A-Z]{3}$/);
  });

  it("maps each skin type to a distinct package", () => {
    const packages = SKIN_TYPES.map(getPackageForSkinType);

    expect(new Set(packages.map((p) => p.id)).size).toBe(SKIN_TYPES.length);
    expect(new Set(packages.map((p) => p.name)).size).toBe(SKIN_TYPES.length);
  });
});

describe("formatPrice", () => {
  it("formats minor units as a currency amount", () => {
    expect(formatPrice(9900, "SGD")).toBe("$99.00");
  });

  it("keeps cents rather than rounding to whole units", () => {
    expect(formatPrice(1050, "SGD")).toBe("$10.50");
  });

  it("formats zero", () => {
    expect(formatPrice(0, "SGD")).toBe("$0.00");
  });

  it("throws on an invalid currency code instead of rendering garbage", () => {
    expect(() => formatPrice(100, "not-a-currency")).toThrow();
  });
});
