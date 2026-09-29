import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";

const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

beforeEach(() => {
  vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET);
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyPaymentSignature", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const signature = sign(KEY_SECRET, `${orderId}|${paymentId}`);

  it("accepts the signature for the matching order and payment", () => {
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects when the order id differs", () => {
    expect(verifyPaymentSignature({ orderId: "order_OTHER", paymentId, signature })).toBe(false);
  });

  it("rejects when the payment id differs", () => {
    expect(verifyPaymentSignature({ orderId, paymentId: "pay_OTHER", signature })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const forged = sign("wrong_secret", `${orderId}|${paymentId}`);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: forged })).toBe(false);
  });

  it("rejects a signature of a different length without throwing", () => {
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "abc" })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "" })).toBe(false);
  });

  it("throws loudly when the key secret is not configured", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    expect(() => verifyPaymentSignature({ orderId, paymentId, signature })).toThrow(/RAZORPAY_KEY_SECRET is not set/);
  });
});

describe("verifyWebhookSignature", () => {
  const rawBody = '{"event":"order.paid","payload":{"order":{"entity":{"id":"order_ABC123"}}}}';
  const signature = sign(WEBHOOK_SECRET, rawBody);

  it("accepts the signature over the exact raw body", () => {
    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects when the body was re-serialized differently", () => {
    const reserialized = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(verifyWebhookSignature(reserialized, signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature(rawBody, null)).toBe(false);
  });

  it("rejects a signature made with the key secret instead of the webhook secret", () => {
    expect(verifyWebhookSignature(rawBody, sign(KEY_SECRET, rawBody))).toBe(false);
  });

  it("throws loudly when the webhook secret is not configured", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    expect(() => verifyWebhookSignature(rawBody, signature)).toThrow(/RAZORPAY_WEBHOOK_SECRET is not set/);
  });
});
