import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email/sendOrderConfirmationEmail";
import type { SkinType } from "@/lib/quiz/types";

// Provider-agnostic Order state transitions. Both the checkout-verify route and
// the payment webhook call these. The conditional updateMany makes them
// idempotent and race-safe: Postgres re-checks the WHERE clause after taking
// the row lock, so exactly one caller sees count === 1 for the transition to
// "paid" — and only that caller sends the confirmation email.
// DB errors are deliberately not caught (fail loudly).

export type MarkOrderPaidOutcome = "transitioned" | "already-paid" | "not-found";

export async function markOrderPaid(providerPaymentId: string): Promise<MarkOrderPaidOutcome> {
  // failed -> paid is allowed: the customer can retry inside the modal on the
  // same provider order after a failed attempt.
  const { count } = await db.order.updateMany({
    where: { providerPaymentId, status: { not: "paid" } },
    data: { status: "paid" },
  });

  if (count === 0) {
    const existing = await db.order.findUnique({ where: { providerPaymentId }, select: { id: true } });
    return existing ? "already-paid" : "not-found";
  }

  const order = await db.order.findUniqueOrThrow({
    where: { providerPaymentId },
    include: { quizResponse: true },
  });

  await sendOrderConfirmationEmail({
    to: order.quizResponse.email,
    orderId: order.id,
    skinType: order.quizResponse.skinType as SkinType,
    shipping: {
      fullName: order.fullName,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      landmark: order.landmark,
      city: order.city,
      state: order.state,
      pinCode: order.pinCode,
    },
  });

  return "transitioned";
}

// Only pending -> failed: a late failure event must never un-pay an order.
// Returns the number of rows changed (0 or 1).
export async function markOrderFailed(providerPaymentId: string): Promise<number> {
  const { count } = await db.order.updateMany({
    where: { providerPaymentId, status: "pending" },
    data: { status: "failed" },
  });
  return count;
}
