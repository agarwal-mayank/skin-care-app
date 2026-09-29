import { describe, expect, it } from "vitest";

import { parseRazorpayWebhookEvent } from "./parseEvent";

const orderPaid = {
  entity: "event",
  event: "order.paid",
  payload: {
    payment: { entity: { id: "pay_1", order_id: "order_ABC", status: "captured" } },
    order: { entity: { id: "order_ABC", status: "paid" } },
  },
};

const paymentFailed = {
  entity: "event",
  event: "payment.failed",
  payload: {
    payment: { entity: { id: "pay_2", order_id: "order_ABC", status: "failed" } },
  },
};

describe("parseRazorpayWebhookEvent", () => {
  it("maps order.paid to paid with the order id", () => {
    expect(parseRazorpayWebhookEvent(orderPaid)).toEqual({ kind: "paid", providerOrderId: "order_ABC" });
  });

  it("maps payment.failed to failed with the payment's order id", () => {
    expect(parseRazorpayWebhookEvent(paymentFailed)).toEqual({ kind: "failed", providerOrderId: "order_ABC" });
  });

  it("ignores events we don't handle", () => {
    expect(parseRazorpayWebhookEvent({ ...orderPaid, event: "payment.captured" })).toEqual({
      kind: "ignored",
      event: "payment.captured",
    });
  });

  it("throws when order.paid has no order entity id", () => {
    expect(() => parseRazorpayWebhookEvent({ event: "order.paid", payload: { order: { entity: {} } } })).toThrow(
      /order\.entity\.id/,
    );
    expect(() => parseRazorpayWebhookEvent({ event: "order.paid", payload: {} })).toThrow(/payload\.order\.entity/);
  });

  it("throws when payment.failed has no order_id", () => {
    expect(() =>
      parseRazorpayWebhookEvent({ event: "payment.failed", payload: { payment: { entity: { id: "pay_2" } } } }),
    ).toThrow(/order_id/);
  });

  it.each([null, "order.paid", [orderPaid], { payload: {} }])("throws on a malformed body %j", (body) => {
    expect(() => parseRazorpayWebhookEvent(body)).toThrow();
  });
});
