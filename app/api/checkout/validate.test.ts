import { describe, expect, it } from "vitest";

import { parseCheckoutPayload } from "./validate";

const validPayload = {
  quizResponseId: "cmabc123",
  phone: "98765 43210",
  fullName: "  Priya Sharma ",
  addressLine1: "Flat 4B, Lotus Apartments",
  addressLine2: "MG Road, Indiranagar",
  landmark: "Near City Park",
  city: "Bengaluru",
  state: "Karnataka",
  pinCode: "560038",
};

describe("parseCheckoutPayload", () => {
  it("returns a trimmed payload with the phone normalized to E.164", () => {
    expect(parseCheckoutPayload(validPayload)).toEqual({
      ...validPayload,
      fullName: "Priya Sharma",
      phone: "+919876543210",
    });
  });

  it("never passes through client-sent amount, currency, email or skinType", () => {
    const parsed = parseCheckoutPayload({
      ...validPayload,
      amount: 1,
      currency: "USD",
      email: "x@example.com",
      skinType: "oily",
    });
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("currency");
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("skinType");
  });

  it.each(["quizResponseId", "fullName", "addressLine1", "addressLine2", "city", "state", "pinCode", "phone"])(
    "throws when %s is missing",
    (field) => {
      const { [field as keyof typeof validPayload]: _omitted, ...rest } = validPayload;
      expect(() => parseCheckoutPayload(rest)).toThrow(new RegExp(field));
    },
  );

  it("throws when a required field is only whitespace", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, city: "   " })).toThrow(/city/);
  });

  it("throws when a field is too long", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, fullName: "a".repeat(101) })).toThrow(/fullName/);
    expect(() => parseCheckoutPayload({ ...validPayload, addressLine1: "a".repeat(201) })).toThrow(/addressLine1/);
  });

  it("throws on an invalid phone without echoing the submitted value", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, phone: "5551234" })).toThrow(/phone/);
    try {
      parseCheckoutPayload({ ...validPayload, phone: "5551234" });
    } catch (error) {
      expect((error as Error).message).not.toContain("5551234");
    }
  });

  it("throws on an invalid PIN code", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, pinCode: "012345" })).toThrow(/pinCode/);
  });

  it("throws on an unknown state", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, state: "California" })).toThrow(/state/);
  });

  it("treats an empty or missing landmark as null", () => {
    expect(parseCheckoutPayload({ ...validPayload, landmark: "  " }).landmark).toBeNull();
    const { landmark: _landmark, ...rest } = validPayload;
    expect(parseCheckoutPayload(rest).landmark).toBeNull();
  });

  it("throws when landmark is not a string", () => {
    expect(() => parseCheckoutPayload({ ...validPayload, landmark: 42 })).toThrow(/landmark/);
  });

  it.each([null, "not an object", [validPayload]])("throws when the body itself is %j", (body) => {
    expect(() => parseCheckoutPayload(body)).toThrow();
  });
});
