import { describe, expect, it } from "vitest";

import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";

import { buildQuizResultEmail } from "./quizResultEmail";

// Typed against SkinType so a new or renamed skin type fails to compile here
// until it gets a label, rather than silently going untested.
const LABELS: Record<SkinType, string> = {
  dry: "Dry",
  sensitive: "Sensitive",
  oily: "Oily",
};

// Safe cast: the Record type guarantees the keys are exactly SkinType.
const SKIN_TYPES = Object.keys(LABELS) as SkinType[];

describe("buildQuizResultEmail", () => {
  it("uses a skin-type subject line", () => {
    expect(buildQuizResultEmail("dry").subject).toMatch(/skin type/i);
  });

  it.each(SKIN_TYPES)("includes the %s skin type's label and excludes the others", (skinType) => {
    const label = LABELS[skinType];
    const content = buildQuizResultEmail(skinType);
    const otherLabels = Object.values(LABELS).filter((l) => l !== label);

    expect(content.html).toContain(label);
    expect(content.text).toContain(label);

    for (const other of otherLabels) {
      expect(content.html).not.toContain(other);
      expect(content.text).not.toContain(other);
    }
  });

  it.each(SKIN_TYPES)(
    "includes the %s skin type's package name, products and price, and no other package's name",
    (skinType) => {
      const content = buildQuizResultEmail(skinType);
      const pkg = getPackageForSkinType(skinType);
      const price = formatPrice(pkg.priceInCents, pkg.currency);

      for (const body of [content.html, content.text]) {
        expect(body).toContain(pkg.name);
        expect(body).toContain(price);
        for (const product of pkg.products) {
          expect(body).toContain(product);
        }
      }

      const otherNames = SKIN_TYPES.filter((other) => other !== skinType).map(
        (other) => getPackageForSkinType(other).name,
      );

      for (const otherName of otherNames) {
        expect(content.html).not.toContain(otherName);
        expect(content.text).not.toContain(otherName);
      }
    },
  );
});
