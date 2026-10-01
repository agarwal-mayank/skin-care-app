import { describe, expect, it } from "vitest";

import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";

import { buildOrderConfirmationEmail, type OrderShippingDetails } from "./orderConfirmationEmail";

const SKIN_TYPES: SkinType[] = ["dry", "sensitive", "oily"];

const shipping: OrderShippingDetails = {
  fullName: "Priya Sharma",
  addressLine1: "Flat 4B, Lotus Apartments",
  addressLine2: "MG Road, Indiranagar",
  landmark: "Near City Park",
  city: "Bengaluru",
  state: "Karnataka",
  pinCode: "560038",
};

const charged = { amount: 9900, currency: "INR" };

describe("buildOrderConfirmationEmail", () => {
  it.each(SKIN_TYPES)("includes the %s package's name, products and price, and no other package's name", (skinType) => {
    const pkg = getPackageForSkinType(skinType);
    const content = buildOrderConfirmationEmail({
      orderId: "ord_1",
      skinType,
      amount: pkg.priceInCents,
      currency: pkg.currency,
      shipping,
    });
    const price = formatPrice(pkg.priceInCents, pkg.currency);

    for (const body of [content.html, content.text]) {
      expect(body).toContain(pkg.name);
      expect(body).toContain(price);
      for (const product of pkg.products) {
        expect(body).toContain(product);
      }
      for (const other of SKIN_TYPES.filter((t) => t !== skinType)) {
        expect(body).not.toContain(getPackageForSkinType(other).name);
      }
    }
  });

  it("shows the amount actually charged, not the package's current config price", () => {
    const pkg = getPackageForSkinType("dry");
    const chargedAmount = pkg.priceInCents + 12345;
    const content = buildOrderConfirmationEmail({
      orderId: "ord_1",
      skinType: "dry",
      amount: chargedAmount,
      currency: "INR",
      shipping,
    });

    for (const body of [content.html, content.text]) {
      expect(body).toContain(formatPrice(chargedAmount, "INR"));
      expect(body).not.toContain(formatPrice(pkg.priceInCents, pkg.currency));
    }
  });

  it("includes the order reference, first name and full shipping address", () => {
    const content = buildOrderConfirmationEmail({ ...charged, orderId: "ord_abc123", skinType: "dry", shipping });

    expect(content.subject).toMatch(/order/i);
    for (const body of [content.html, content.text]) {
      expect(body).toContain("ord_abc123");
      expect(body).toContain("Thank you, Priya!");
      expect(body).toContain("Lotus Apartments");
      expect(body).toContain("Indiranagar");
      expect(body).toContain("Near City Park");
      expect(body).toContain("Bengaluru, Karnataka 560038");
    }
  });

  it("omits the landmark line when there is no landmark", () => {
    const content = buildOrderConfirmationEmail({
      ...charged,
      orderId: "ord_1",
      skinType: "dry",
      shipping: { ...shipping, landmark: null },
    });

    expect(content.html).not.toContain("Landmark");
    expect(content.text).not.toContain("Landmark");
  });

  it("HTML-escapes user-supplied values in the html body", () => {
    const content = buildOrderConfirmationEmail({
      ...charged,
      orderId: "ord_1",
      skinType: "dry",
      shipping: { ...shipping, fullName: "<script>alert(1)</script> X", addressLine1: `"Tom & Jerry's"` },
    });

    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain("&quot;Tom &amp; Jerry&#39;s&quot;");
  });

  it("does not present itself as an invoice", () => {
    const content = buildOrderConfirmationEmail({ ...charged, orderId: "ord_1", skinType: "oily", shipping });

    for (const body of [content.subject, content.html, content.text]) {
      expect(body).not.toMatch(/invoice|gst|tax/i);
    }
  });
});
