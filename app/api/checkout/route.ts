import { db } from "@/lib/db";
import { getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/razorpay";

import { parseCheckoutPayload, type CheckoutPayload } from "./validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let payload: CheckoutPayload;
  try {
    payload = parseCheckoutPayload(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return Response.json({ error: message }, { status: 400 });
  }

  const quizResponse = await db.quizResponse.findUnique({ where: { id: payload.quizResponseId } });
  if (!quizResponse) {
    return Response.json({ error: "Quiz response not found" }, { status: 404 });
  }

  // The price comes only from our config, looked up by the stored skin type —
  // never from the request or a provider dashboard.
  const skinPackage = getPackageForSkinType(quizResponse.skinType as SkinType);
  if (!skinPackage) {
    throw new Error(`No package for stored skinType on QuizResponse ${quizResponse.id}`);
  }

  // Razorpay order first: its id is the Order's required, unique
  // providerPaymentId. If the DB insert below then fails, the Razorpay order
  // simply expires unpaid — nothing was charged — and this request 500s loudly.
  const { id: razorpayOrderId } = await createRazorpayOrder({
    amount: skinPackage.priceInCents,
    currency: skinPackage.currency,
    receipt: quizResponse.id,
    notes: { quizResponseId: quizResponse.id, packageId: skinPackage.id },
  });

  const { quizResponseId, ...shippingAndPhone } = payload;
  const order = await db.order.create({
    data: {
      quizResponseId,
      paymentProvider: "razorpay",
      providerPaymentId: razorpayOrderId,
      amount: skinPackage.priceInCents,
      currency: skinPackage.currency,
      ...shippingAndPhone,
    },
  });

  return Response.json(
    {
      orderId: order.id,
      razorpayOrderId,
      keyId: getRazorpayKeyId(),
      amount: skinPackage.priceInCents,
      currency: skinPackage.currency,
      packageName: skinPackage.name,
      prefill: { name: payload.fullName, email: quizResponse.email, contact: payload.phone },
    },
    { status: 201 },
  );
}
