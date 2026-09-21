import { describe, expect, it } from "vitest";

import { resolveGender } from "./QuizFlow";

describe("resolveGender", () => {
  it("returns a valid gender value unchanged", () => {
    expect(resolveGender({ gender: "female" })).toBe("female");
    expect(resolveGender({ gender: "male" })).toBe("male");
    expect(resolveGender({ gender: "other" })).toBe("other");
  });

  it("throws when the gender answer is missing", () => {
    expect(() => resolveGender({})).toThrow(/missing\/invalid gender/);
  });

  it("throws when the gender answer is an unexpected value", () => {
    expect(() => resolveGender({ gender: "nonbinary" })).toThrow(/missing\/invalid gender/);
  });
});
