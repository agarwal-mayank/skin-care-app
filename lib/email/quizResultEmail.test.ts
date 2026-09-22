import { describe, expect, it } from "vitest";

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
});
