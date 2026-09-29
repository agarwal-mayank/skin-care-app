import { createHmac, timingSafeEqual } from "node:crypto";

import Razorpay from "razorpay";

// Server-only. This file (plus the checkout/verify/webhook routes) is the only
// place allowed to know about Razorpay — see the architecture's
// "Boundaries › Payments" swap-safety rules.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

// Lazy: the Razorpay constructor throws when key_id is missing, which would
// break module import during tests and `next build`.
let client: Razorpay | undefined;

function getClient(): Razorpay {
  client ??= new Razorpay({
    key_id: requireEnv("RAZORPAY_KEY_ID"),
    key_secret: requireEnv("RAZORPAY_KEY_SECRET"),
  });
  return client;
}

// Public by design — the checkout modal needs it. Sent to the client via our
// API response, never via NEXT_PUBLIC_ env.
export function getRazorpayKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}

interface CreateRazorpayOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export async function createRazorpayOrder(params: CreateRazorpayOrderParams): Promise<{ id: string }> {
  const order = await getClient().orders.create(params);
  return { id: order.id };
}

function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

interface PaymentSignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

// Checkout-success handler: razorpay_signature = HMAC-SHA256(`${order_id}|${payment_id}`, key secret).
export function verifyPaymentSignature({ orderId, paymentId, signature }: PaymentSignatureParams): boolean {
  const expected = hmacSha256Hex(requireEnv("RAZORPAY_KEY_SECRET"), `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

// Webhook: X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret).
// Must be given the body exactly as received — re-serialized JSON won't match.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }
  const expected = hmacSha256Hex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), rawBody);
  return safeEqual(expected, signature);
}
