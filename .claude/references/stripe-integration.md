# Stripe integration

Build this after the quiz flow/UX is polished, not before — the founder's explicit sequencing preference is to get the questions and result screen feeling right first, then wire up checkout.

Use Stripe Checkout (the hosted payment page), not Stripe Elements — this app never handles raw card data. `app/api/checkout/route.ts` creates the Checkout session server-side (using the server-only `STRIPE_SECRET_KEY`); `app/api/webhooks/stripe/route.ts` receives the result. Always verify incoming webhook requests against `STRIPE_WEBHOOK_SECRET` before trusting the payload and updating an `Order`'s status — an unverified webhook handler is a payment-spoofing hole.

Test locally in Stripe test mode before considering any payment work done — reading the code isn't enough here. Forward webhooks to your local server with:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Confirm the full loop (Checkout session → redirect → webhook → `Order` updated) actually completes, not just that the code compiles.
