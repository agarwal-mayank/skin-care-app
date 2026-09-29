import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";

import { parseRazorpayWebhookEvent, type RazorpayWebhookEvent } from "./parseEvent";

// Source of truth for Order status. Razorpay retries any non-2xx response, so:
// bad signature / malformed body -> 400; unknown order -> warn + 200 (retrying
// won't help); DB errors are NOT caught -> 500 so Razorpay retries.
export async function POST(request: Request) {
  // Raw text first: the signature is over the exact bytes Razorpay sent.
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))) {
    console.error("Razorpay webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = parseRazorpayWebhookEvent(JSON.parse(rawBody));
  } catch (error) {
    console.error("Malformed Razorpay webhook body:", error);
    return Response.json({ error: "Malformed webhook body" }, { status: 400 });
  }

  if (event.kind === "paid") {
    const outcome = await markOrderPaid(event.providerOrderId);
    if (outcome === "not-found") {
      console.warn("Razorpay order.paid webhook for an unknown order", event.providerOrderId);
    }
  } else if (event.kind === "failed") {
    const changed = await markOrderFailed(event.providerOrderId);
    if (changed === 0) {
      console.warn("Razorpay payment.failed webhook changed nothing (unknown, paid or already failed)", event.providerOrderId);
    }
  }

  return Response.json({ received: true });
}
