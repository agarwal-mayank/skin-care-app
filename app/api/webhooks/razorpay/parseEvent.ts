// Maps a (signature-verified, parsed) Razorpay webhook body to our own event
// kinds. Subscribe the dashboard webhook to order.paid + payment.failed only.
export type RazorpayWebhookEvent =
  | { kind: "paid"; providerOrderId: string }
  | { kind: "failed"; providerOrderId: string }
  | { kind: "ignored"; event: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntity(json: Record<string, unknown>, key: "order" | "payment"): Record<string, unknown> {
  const payload = json.payload;
  const wrapper = isObject(payload) ? payload[key] : undefined;
  const entity = isObject(wrapper) ? wrapper.entity : undefined;
  if (!isObject(entity)) {
    throw new Error(`Webhook payload is missing payload.${key}.entity`);
  }
  return entity;
}

export function parseRazorpayWebhookEvent(json: unknown): RazorpayWebhookEvent {
  if (!isObject(json) || typeof json.event !== "string") {
    throw new Error("Webhook body must be an object with a string event");
  }

  if (json.event === "order.paid") {
    const id = readEntity(json, "order").id;
    if (typeof id !== "string" || id === "") {
      throw new Error("order.paid webhook is missing payload.order.entity.id");
    }
    return { kind: "paid", providerOrderId: id };
  }

  if (json.event === "payment.failed") {
    const orderId = readEntity(json, "payment").order_id;
    if (typeof orderId !== "string" || orderId === "") {
      throw new Error("payment.failed webhook is missing payload.payment.entity.order_id");
    }
    return { kind: "failed", providerOrderId: orderId };
  }

  return { kind: "ignored", event: json.event };
}
