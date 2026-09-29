import { getFirstName } from "@/lib/checkout/indianAddress";
import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";
import { verifyPaymentSignature } from "@/lib/razorpay";

// Called by the client with the exact fields Razorpay Checkout's success
// handler provides. The signature is verified before anything is trusted; the
// webhook remains the source of truth, and markOrderPaid is idempotent across
// both paths.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body as Record<string, unknown>;
  if (
    typeof razorpay_order_id !== "string" ||
    typeof razorpay_payment_id !== "string" ||
    typeof razorpay_signature !== "string"
  ) {
    return Response.json(
      { error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" },
      { status: 400 },
    );
  }

  const isValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!isValid) {
    console.error("Checkout signature verification failed for order", razorpay_order_id);
    return Response.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const outcome = await markOrderPaid(razorpay_order_id);
  if (outcome === "not-found") {
    console.error("Verified payment for an unknown order", razorpay_order_id);
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await db.order.findUniqueOrThrow({
    where: { providerPaymentId: razorpay_order_id },
    include: { quizResponse: true },
  });

  return Response.json({ firstName: getFirstName(order.fullName), email: order.quizResponse.email });
}
