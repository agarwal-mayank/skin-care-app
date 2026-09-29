# Architecture — Personalized Ayurvedic Skin Quiz

*Companion to `ayurvedic-skin-quiz.prd.md`.*

## Problem & goals

Prove that a personalized Ayurvedic skin quiz — gender + skin questions → dosha-based skin type → a priced, custom package → email capture → Razorpay checkout — gets ad/social visitors to complete it and attempt to buy, validating that people want individualized Ayurvedic skincare over generic products. Every decision below is judged against: can we build and test this locally, at hobby scale, without unnecessary infrastructure, while still being a real, chargeable, production-usable flow.

## Approaches considered

1. **Standalone Next.js app, own deploy, linked via URL** *(recommended)* — a self-contained app (this repo) with its own domain/subdomain. The live Ayurvedic site just links to it. No dependency on code we can't access.
2. **Embed/integrate into the existing site's codebase** — rejected. The existing site's code isn't accessible from this environment (separate host, not on this machine), so there's nothing to integrate into directly.
3. **iframe embed of a hosted quiz into the existing site** — considered and rejected for v1: adds cross-origin complexity (styling, sizing, postMessage for the payment provider's checkout) for no real benefit when a plain link works fine for an ad/social landing page.

## Recommended approach

A standalone Next.js (App Router) + TypeScript app. A dedicated landing page is the entry point (linked from ads/social). The quiz is a client-driven, multi-step flow; each answer is held in client state until the quiz is complete. On completion, the app computes a dosha-based skin type, shows a matching package with a price, captures the user's email, sends the package by email, and offers a "Buy Now" that creates a Razorpay order and opens Razorpay's hosted checkout. A signature-verified webhook confirms payment and updates the stored record. Hosting is deliberately left open (any standard Node/Next.js host works — Vercel is the natural default later) so nothing in the app code assumes a specific platform.

## Key decisions

- **Stack & libraries:** Next.js (App Router) + TypeScript + Tailwind CSS. *Alternative considered:* plain CSS/CSS Modules — rejected only because Tailwind is faster to build and iterate a quiz UI with; either would work.
- **Database:** Postgres, hosted on **Supabase** (free tier) + **Prisma** as the ORM/migration tool. *(Updated 2026-09-20: originally recommended Neon for its dev/prod branching; switched to Supabase because the founder already has an account and familiarity with it — that outweighs the marginal branching convenience, and Supabase's extra features like auth/storage just go unused, not in the way.)* The app runs locally; the database is a free cloud instance, so there's no local Postgres install or Docker required, and dev and prod use the same engine (no drift). *Alternative considered:* SQLite for local simplicity — rejected because it would force an engine switch at deploy time; Docker-local Postgres — rejected as unnecessary extra infra for a hobby-scale project.
- **Data model** (shape-level):
  - `QuizResponse` — `id`, `email`, `gender`, `answers` (the full set of question→answer pairs), computed `skinType`, `createdAt`. Written **once, on quiz completion** — the app does not persist partial/in-progress sessions (see *Open questions* re: drop-off measurement).
  - `Order` — `id`, `quizResponseId` (FK → `QuizResponse`), `paymentProvider` (e.g. `"razorpay"`), `providerPaymentId` (the provider's order id), `status` (our own `pending` / `paid` / `failed`), `amount`, `currency`, `phone` + a structured Indian shipping address (full name, flat/house/building, area/street/locality, optional landmark, city, state, 6-digit PIN code — all captured at "Buy Now", see Open questions), `createdAt`. Created when a checkout starts, updated by the provider's webhook on payment success/failure. *(Updated 2026-09-29: provider-neutral column names instead of the original `stripeSessionId`, so switching payment providers needs no migration — see Boundaries › Payments.)*
  - Quiz questions, dosha-scoring rules, and skin-type→package mappings are **not** database tables — they live as plain config/code (e.g. `questions.ts`, `packages.ts`) since content isn't finalized yet and there's no admin UI in v1 (per the PRD's non-goals). When the real Ayurvedic framework is provided, it drops into these files directly.
- **Boundaries & contracts:**
  - **Payments — Razorpay, built to be swappable:** *(Decided 2026-09-29: the founder confirmed **Razorpay** as the payment provider, replacing the earlier Stripe plan — the merchant account is Indian, and new Stripe India accounts have been invite-only since May 2024.)* Use Razorpay **Standard Checkout**: the server creates a Razorpay Order (amount in paise — INR's smallest sub-unit — from `lib/quiz/packages.ts`), the client opens Razorpay's hosted checkout modal (`checkout.js`, loaded from `checkout.razorpay.com`) with that `order_id` and the customer's email + phone pre-filled, and the app never touches raw card data (no PCI scope). The **Key ID** is designed to be public and may reach the client; the **Key Secret** and **webhook secret** are server-only. Payment is confirmed two ways, both server-side: (a) the checkout success handler's `razorpay_signature` = HMAC-SHA256(`order_id|payment_id`, key secret), verified by our API before trusting it; (b) the webhook (`X-Razorpay-Signature` = HMAC-SHA256 of the **raw** request body with the webhook secret) is the source of truth for marking an `Order` paid/failed — both paths must be idempotent. *Alternative considered:* Razorpay Payment Links (a hosted page, closer to a redirect flow) — kept as a fallback if the modal proves awkward, not the default.
    To keep a future provider switch cheap, three rules:
    1. **Provider code is confined** to `lib/razorpay.ts`, `app/api/checkout/route.ts` (plus the small payment-verification route it needs), and `app/api/webhooks/razorpay/route.ts` — no provider SDK imports in components or elsewhere in `lib/` (the client component only receives an `order_id` + Key ID from our API and opens the modal).
    2. **Provider-neutral data:** `Order` uses `paymentProvider` / `providerPaymentId` (see Data model), never provider-named columns.
    3. **Our own status + prices:** `Order.status` is our `pending | paid | failed`, mapped from provider events inside the webhook route; prices come from `lib/quiz/packages.ts` server-side, never from a provider dashboard or from the client.
    *Side note — Stripe, if requirements change:* if the seller ever becomes a Singapore entity (Singapore business + bank account), **Stripe Singapore** (Stripe Checkout, hosted page) is the natural alternative. Thanks to the rules above that swap = a `lib/stripe.ts` client, a rewritten checkout route, and a Stripe webhook route; no schema change.
  - **Resend (email):** server-only API key; the app sends the package summary email after quiz completion, and **sends an order-confirmation email when an `Order` becomes `paid`** (TICKET-7). Send it only on the transition to `paid` so a repeated webhook can't send it twice; like the result email, a send failure is logged loudly but never undoes or fails the payment update. It's an order confirmation, **not a tax invoice** — the founder's business issues GST invoices separately by email.
  - **Database:** connection string in `.env`, gitignored before first commit (per your global security rule); Prisma schema/migrations are checked into the repo.
  - **Auth:** none. The flow is fully anonymous, identified only by the email captured at quiz completion — no login/accounts, matching the PRD's non-goals.
  - **Secrets inventory:** `DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY` — all server-side only, never exposed to the client bundle. `RAZORPAY_KEY_ID` is also kept in `.env` but is public by design (the checkout modal needs it).
- **Content-as-config pattern:** quiz questions, dosha-scoring weights, and skin-type→package mappings are plain TypeScript config, not database-driven — deliberately simple since there's no admin UI and content is still being finalized.

## Missing pieces

- The actual quiz questions and dosha-scoring logic (you're bringing a fuller Ayurvedic framework later — the domain research in the PRD is a starting point only).
- The actual package contents and pricing per skin type.
- ~~A Supabase Postgres project + Prisma schema/migrations set up.~~ Done in TICKET-1.
- A Resend account (their default sending domain is fine to start; a verified custom domain matters more once this goes live for real).
- A Razorpay account — test-mode keys (Key ID + Key Secret) are enough to build and test the full flow locally now; KYC/activation for live charges can happen later, in parallel. **International card payments must be separately requested from Razorpay support** after KYC, before customers outside India can pay.
- A hosting decision, whenever you're ready to deploy (kept out of scope for now).

## Spikes & experiments

- **Question:** Does the Razorpay order → checkout modal → signature check → webhook flow work cleanly end-to-end in test mode, locally? Razorpay **cannot deliver webhooks to `localhost`** (it needs a public URL), so local testing needs a tunnel — Razorpay recommends `zrok` (ngrok is blocked by Razorpay).
  **Spike:** Once quiz UX is solid and you move to checkout work (per your own sequencing preference), spend a small, timeboxed session wiring just the order creation, the checkout modal, signature verification and the webhook handler (through a tunnel) against a dummy package/price, before integrating it into the real quiz result screen.
  **Decision rule:** if the local test-mode flow (order → modal → verified payment → webhook → `Order` updated) works within that session, proceed to wire it into the real UI. If the webhook handling is unreliable or confusing locally, pause and get the tunnel/webhook setup right in isolation before touching the quiz UI.

No other calls here are risky/one-way enough to warrant a spike — everything else (stack, DB, email service) is a reversible, well-trodden choice.

## Open questions

- [ ] Quiz questions + dosha-scoring rules — TBD, you're providing a fuller framework later.
- [ ] Package contents + pricing per skin type — TBD.
- [ ] Hosting target — deferred; architecture stays host-agnostic in the meantime.
- [ ] Drop-off measurement: v1 only persists a `QuizResponse` on completion, per your call to keep it simple — which means the PRD's "WRONG" signal (mid-quiz drop-off) **can't be measured from the database alone** in this version. Worth revisiting (e.g. a lightweight client-side analytics event, or a later switch to session-based tracking) if that signal turns out to matter once ads are running.
- [x] ~~Live payment provider — Stripe (Singapore) or Razorpay (India)?~~ — resolved 2026-09-29: **Razorpay**, confirmed by the founder. Stripe Singapore stays documented as the fallback if the seller ever becomes a Singapore entity (see Boundaries › Payments).
- [x] ~~Charge currency — SGD or INR?~~ — resolved 2026-09-29: **INR**. `lib/quiz/packages.ts` prices are in paise and display as `₹` via `en-IN`; settlement is in INR, so no EEFC account is needed. Customers paying with a non-Indian card pay in INR and their bank converts.
- [x] ~~Collect a phone number?~~ — resolved 2026-09-29: **yes**. Capture the customer's phone for checkout and pass it to Razorpay as the pre-filled contact (format `+<country code><number>`). Placement (confirmed by the founder 2026-09-29): asked at "Buy Now", not in the quiz itself, so the free quiz stays email-only; stored on `Order`.
- [x] ~~Shipping address?~~ — resolved 2026-09-29: **collected at "Buy Now"** in standard Indian format, alongside the phone, stored as structured fields on `Order`. This implies shipping within India only (6-digit PIN code, Indian state list) — revisit if the founder wants to ship abroad. Collecting the address is in scope; fulfilment/shipping workflow still isn't (PRD non-goal).
- [x] ~~Does the price include shipping?~~ — resolved 2026-09-29: **yes, one flat price** per bundle, shipping included. The checkout amount is exactly the bundle price in `packages.ts`; no delivery-fee logic.
- [x] ~~Payment confirmation email?~~ — resolved 2026-09-29: **part of TICKET-7** (see Boundaries › Resend).
- [x] ~~What does the buyer see after paying?~~ — resolved 2026-09-29: a **warm, personal "thank you" screen** on our site after a verified payment. Copy chosen 2026-09-29 ("Option A"; `{firstName}` from the shipping name, `{email}` from the quiz):
  > **Thank you, {firstName}!**
  > Your bundle is being lovingly packed, just for you.
  > We've sent your order confirmation to {email}, and we'll let you know the moment it's on its way.
  > Here's to caring for your skin, gently and in its own way.
- [ ] GST / invoices — the user is checking with the founder; expected: the business emails GST invoices itself, outside this app. Needs confirming before taking real money, but doesn't block building.
- [x] ~~Refunds?~~ — resolved 2026-09-29: **out of scope for v1**; handled by hand in the Razorpay dashboard if ever needed. No refund logic in the app.
- [ ] Razorpay KYC/activation + international-payments approval — needed before accepting real (non-test-mode) payments; international payments are requested from Razorpay support after KYC (noted by the founder 2026-09-29), and cards issued outside India won't work until it's enabled.
- [x] ~~Neon vs. Supabase~~ — resolved 2026-09-20: Supabase, since the founder already has an account and familiarity with it.
