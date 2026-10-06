import { describe, expect, it } from "vitest";

import { parseQuizResponsePayload } from "./validate";

const validPayload = {
  email: "visitor@example.com",
  gender: "female",
  answers: { gender: "female", "skin-feel": "tight-dry" },
  skinType: "dry",
};

const without = (key: keyof typeof validPayload) =>
  Object.fromEntries(Object.entries(validPayload).filter(([entryKey]) => entryKey !== key));

describe("parseQuizResponsePayload", () => {
  it("returns the payload unchanged when everything is valid", () => {
    expect(parseQuizResponsePayload(validPayload)).toEqual(validPayload);
  });

  it("throws when email is missing", () => {
    expect(() => parseQuizResponsePayload(without("email"))).toThrow(/email/i);
  });

  it("throws when email is malformed", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, email: "not-an-email" })).toThrow(/email/i);
  });

  it("throws when gender is not a valid Gender value", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, gender: "nonbinary" })).toThrow(/gender/i);
  });

  it("throws when gender is not a string", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, gender: 123 })).toThrow(/gender/i);
  });

  it("throws when gender is missing", () => {
    expect(() => parseQuizResponsePayload(without("gender"))).toThrow(/gender/i);
  });

  it("throws when skinType is not a valid SkinType value", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, skinType: "combination" })).toThrow(/skinType/i);
  });

  it("throws when skinType is not a string", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, skinType: 123 })).toThrow(/skinType/i);
  });

  it("throws when skinType is missing", () => {
    expect(() => parseQuizResponsePayload(without("skinType"))).toThrow(/skinType/i);
  });

  it("throws when answers is missing", () => {
    expect(() => parseQuizResponsePayload(without("answers"))).toThrow(/answers/i);
  });

  it("throws when answers is not an object", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, answers: "gender:female" })).toThrow(/answers/i);
  });

  it("throws when answers is an array", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, answers: ["female"] })).toThrow(/answers/i);
  });

  it("throws when answers is an empty object", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, answers: {} })).toThrow(/answers/i);
  });

  it("throws when an answers value is not a string", () => {
    expect(() => parseQuizResponsePayload({ ...validPayload, answers: { gender: 1 } })).toThrow(/answers\.gender/i);
  });

  it("throws when the body itself is null", () => {
    expect(() => parseQuizResponsePayload(null)).toThrow();
  });

  it("throws when the body itself is a string", () => {
    expect(() => parseQuizResponsePayload("not an object")).toThrow();
  });

  it("throws when the body itself is an array", () => {
    expect(() => parseQuizResponsePayload([validPayload])).toThrow();
  });
});
