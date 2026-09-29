import { describe, expect, it } from "vitest";

import { getFirstName, INDIAN_STATES, isIndianState, isValidPinCode, normalizeIndianPhone } from "./indianAddress";

describe("normalizeIndianPhone", () => {
  it.each(["9876543210", "+91 98765 43210", "+919876543210", "919876543210", "098765-43210", "(987) 654-3210"])(
    "normalizes %s to E.164",
    (input) => {
      expect(normalizeIndianPhone(input)).toBe("+919876543210");
    },
  );

  it.each(["12345", "5876543210", "98765432101", "+1 4155552671", "98765abcde", ""])("rejects %s", (input) => {
    expect(normalizeIndianPhone(input)).toBeNull();
  });
});

describe("isValidPinCode", () => {
  it("accepts a 6-digit PIN not starting with 0", () => {
    expect(isValidPinCode("110001")).toBe(true);
    expect(isValidPinCode(" 560034 ")).toBe(true);
  });

  it.each(["011001", "11001", "1100011", "abcdef", ""])("rejects %s", (input) => {
    expect(isValidPinCode(input)).toBe(false);
  });
});

describe("INDIAN_STATES", () => {
  it("lists all 28 states and 8 union territories without duplicates", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
  });

  it("isIndianState recognizes list members only", () => {
    expect(isIndianState("Karnataka")).toBe(true);
    expect(isIndianState("karnataka")).toBe(false);
    expect(isIndianState("California")).toBe(false);
  });
});

describe("getFirstName", () => {
  it("returns the first whitespace-separated token", () => {
    expect(getFirstName("  Priya   Sharma ")).toBe("Priya");
    expect(getFirstName("Arjun")).toBe("Arjun");
  });

  it("returns an empty string for a blank name", () => {
    expect(getFirstName("   ")).toBe("");
  });
});
