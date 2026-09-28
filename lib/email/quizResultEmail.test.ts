import { describe, expect, it } from "vitest";

import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";

import { buildQuizResultEmail } from "./quizResultEmail";

const LABELS = {
  dry: "Dry",
  sensitive: "Sensitive",
  oily: "Oily",
} as const;

describe("buildQuizResultEmail", () => {
  it.each(Object.entries(LABELS))("includes the %s skin type's label and excludes the others", (skinType, label) => {
    const content = buildQuizResultEmail(skinType as keyof typeof LABELS);
    const otherLabels = Object.values(LABELS).filter((l) => l !== label);

    expect(content.subject).toMatch(/skin type/i);
    expect(content.html).toContain(label);
    expect(content.text).toContain(label);

    for (const other of otherLabels) {
      expect(content.html).not.toContain(other);
      expect(content.text).not.toContain(other);
    }
  });

  it.each(Object.keys(LABELS))(
    "includes the %s skin type's package name, products and price, and no other package's name",
    (skinType) => {
      const typed = skinType as keyof typeof LABELS;
      const content = buildQuizResultEmail(typed);
      const pkg = getPackageForSkinType(typed);
      const price = formatPrice(pkg.priceInCents, pkg.currency);

      for (const body of [content.html, content.text]) {
        expect(body).toContain(pkg.name);
        expect(body).toContain(price);
        for (const product of pkg.products) {
          expect(body).toContain(product);
        }
      }

      const otherNames = Object.keys(LABELS)
        .filter((other) => other !== skinType)
        .map((other) => getPackageForSkinType(other as keyof typeof LABELS).name);

      for (const otherName of otherNames) {
        expect(content.html).not.toContain(otherName);
        expect(content.text).not.toContain(otherName);
      }
    },
  );
});
