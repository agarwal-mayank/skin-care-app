# Razorpay integration

Build this after the quiz flow/UX is polished, not before — the founder's explicit sequencing preference is to get the questions and result screen feeling right first, then wire up checkout.

Razorpay is the payment provider (founder decision, 2026-09-29). Use **Standard Checkout** — Razorpay's hosted checkout modal — so this app never handles raw card data. `app/api/checkout/route.ts` creates a Razorpay Order server-side with the server-only `RAZORPAY_KEY_SECRET`; the amount is in the currency's smallest sub-unit (`priceInCents` from `lib/quiz/packages.ts`) and always comes from server-side config, never from the request. We charge in **INR** (amounts in paise). The client gets back only the `order_id` and the public `RAZORPAY_KEY_ID` and opens the modal, pre-filling the customer's email and phone (`prefill.contact`, format `+<country code><number>`) — the phone is collected at "Buy Now" and stored on `Order`; treat it as PII like the email (never log it in full).

Two signatures, both verified server-side before anything is trusted — skipping either is a payment-spoofing hole:
- **Checkout success:** `razorpay_signature` must equal HMAC-SHA256 of `` `${order_id}|${razorpay_payment_id}` `` using `RAZORPAY_KEY_SECRET`.
- **Webhook** (`app/api/webhooks/razorpay/route.ts`): `X-Razorpay-Signature` must equal HMAC-SHA256 of the **raw** request body using `RAZORPAY_WEBHOOK_SECRET` — read the body as text, verify, *then* parse it. The webhook is the source of truth for an `Order`'s status. Both paths can report the same payment, so updates must be idempotent.

Keep provider code confined to `lib/razorpay.ts`, the checkout/verify routes and the webhook route. `Order` uses provider-neutral columns (`paymentProvider`, `providerPaymentId`) and our own `pending | paid | failed` status — see the architecture doc's "Boundaries › Payments".

Test in Razorpay **test mode** before considering any payment work done — reading the code isn't enough. Razorpay can't deliver webhooks to `localhost`, so run a tunnel to `localhost:3000` (Razorpay recommends `zrok`; ngrok is blocked) and point a test-mode webhook at `<tunnel-url>/api/webhooks/razorpay`. Confirm the full loop (order → modal → test payment → signature verified → webhook → `Order` updated) actually completes, not just that the code compiles. International cards only work once Razorpay has enabled international payments on the account.

Side note — Stripe: if the seller ever becomes a Singapore entity, Stripe Singapore (Stripe Checkout + `stripe listen` for local webhooks) is the documented fallback. The rules above keep that swap to the same three files, with no schema change.
