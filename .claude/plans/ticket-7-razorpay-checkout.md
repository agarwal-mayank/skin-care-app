# Feature: TICKET-7 — Razorpay Checkout + `Order`

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files etc.

## Feature Description

Let a visitor who has finished the quiz buy the product bundle recommended for their skin type. After the email step on the result screen, a **Buy Now** button opens a short form. It collects a phone number and an Indian shipping address. The server then creates an `Order` row and a matching Razorpay Order, priced from `lib/quiz/packages.ts` and never from the client, and Razorpay's hosted Standard Checkout modal opens. When the payment succeeds:

1. The checkout-success signature is verified server-side, the `Order` is marked `paid`, and the visitor sees the warm **thank-you screen** (copy fixed by the founder, "Option A").
2. The signature-verified **webhook** (`order.paid` / `payment.failed`) is the source of truth for `Order.status`. It is idempotent with path 1.
3. An **order-confirmation email** is sent exactly once, on the transition to `paid`.

No refunds, no fulfilment or shipping workflow, and no delivery-fee logic, because the price is one flat amount that includes shipping.

## User Story

As a visitor who just got my Ayurvedic skin type and recommended bundle
I want to enter my phone and delivery address and pay for the bundle right there
So that the products picked for my skin actually reach my door, without hunting for them elsewhere

## Problem Statement

The funnel currently ends at "Thanks! We'll be in touch." (`app/quiz/_components/ResultScreen.tsx:77-78`). There's no way to act on the priced bundle, so the PRD hypothesis's key signal can't be measured: "a meaningful share … clicking through to checkout", and completed purchases. The `Order` model, `lib/razorpay.ts`, the checkout route and the webhook route in the architecture map don't exist yet.

## Solution Statement

Follow the architecture's **Boundaries › Payments** exactly (Razorpay Standard Checkout, both signatures verified server-side, three swap-safety rules):

- **Schema:** add an `Order` model with provider-neutral columns (`paymentProvider`, `providerPaymentId` = the Razorpay **order** id), our own `OrderStatus` enum `pending | paid | failed`, and structured Indian address fields.
- **Provider code confined** to `lib/razorpay.ts` (lazy SDK client + HMAC signature helpers via `node:crypto`), `app/api/checkout/route.ts` (create the order), `app/api/checkout/verify/route.ts` (checkout-success signature), and `app/api/webhooks/razorpay/` (raw-body webhook). Components never import the SDK. They get `{ razorpayOrderId, keyId, amount, currency, prefill }` from our API and call `window.Razorpay` (loaded from `checkout.razorpay.com` via `next/script`).
- **Idempotency via one DB primitive:** `lib/orders.ts › markOrderPaid(providerPaymentId)` runs `updateMany({ where: { providerPaymentId, status: { not: "paid" } }, data: { status: "paid" } })`. Postgres row locking means exactly one caller gets `count === 1`, and only that caller sends the confirmation email. Both the verify route and the webhook call it. `markOrderFailed` only moves `pending → failed`, so a late `payment.failed` can never un-pay an order, and a retry that succeeds after a failed attempt still moves `failed → paid`.
- **Pure, unit-tested logic** lives next to the code that uses it, as in `app/api/quiz-response/validate.ts`: payload validation plus phone/PIN/state rules, signature verification, webhook event parsing, the email builder with HTML escaping, and first-name extraction.
- **UI:** everything stays inside the one multi-step quiz flow in `app/quiz/` (CLAUDE.md "Where new code goes"). There are two new client components, `CheckoutForm.tsx` and `ThankYouScreen.tsx`, and `ResultScreen.tsx` is edited to keep the `quizResponseId` and render them.

## Out of Scope / Non-Goals

- Not included: refunds (handled by hand in the Razorpay dashboard), fulfilment or shipping status, delivery fees, coupons, quantities, subscriptions, admin UI or user accounts (PRD non-goals, CLAUDE.md scope discipline).
- Not included: GST or tax invoices. The confirmation email is **not** a tax invoice, and it must not call itself one (still an open question with the founder).
- Not included: shipping outside India. The address is Indian-format only (6-digit PIN, Indian state/UT list).
- Not included: Razorpay Payment Links, and any Stripe code (Stripe is only a documented fallback).
- Not included: real bundle names or prices. `packages.ts` stays `[PLACEHOLDER]` at `9900` paise (₹99.00).
- Not included: a separate `/thank-you` route or page. The thank-you screen is a client-state step of the quiz flow, so a reload loses it (acceptable for v1).
- Not included: persisting the Razorpay **payment** id, `updatedAt`, or webhook event-id dedup tables. The architecture data model doesn't list them, and conditional updates already give idempotency (see Open Questions).
- Not changing: `lib/quiz/packages.ts`, `scoring.ts`, `questions.ts`, `app/api/quiz-response/*`, `lib/email/quizResultEmail.ts`, `lib/email/sendQuizResultEmail.ts`, and the email-first order of the result screen.
- Not changing: `QuizResponse` columns. It only gains the Prisma back-relation `orders Order[]`, which is not a DB column.

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High (money + webhook + tunnel-based testing; ~900–1300 lines incl. tests)
**Primary Systems Affected**: `prisma/schema.prisma` (+ migration), `lib/razorpay.ts`, `lib/orders.ts`, `lib/checkout/`, `lib/email/`, `app/api/checkout/**`, `app/api/webhooks/razorpay/**`, `app/quiz/_components/*`
**Dependencies**: `razorpay@2.9.8` (npm, latest, ships TypeScript types). `checkout.js` from `https://checkout.razorpay.com/v1/checkout.js`. A Razorpay **test-mode** account (Key ID, Key Secret, webhook secret). `zrok` for local webhook delivery.

## Related Work

**Implements**: TICKET-7 in `docs/tickets/ayurvedic-skin-quiz.md` ("Unblocked — not yet planned in detail")   ·   **Epic**: `ayurvedic-skin-quiz.architecture.md` (Boundaries › Payments, Boundaries › Resend, Data model, Spikes, Open questions resolved 2026-09-29)

**Back-references**:

- `.claude/plans/ticket-4-save-quiz-response.md`: Why: established the route plus co-located `validate.ts` pattern, and the "DB write never caught" rule that the checkout route mirrors.
- `.claude/plans/ticket-5-result-email.md`: Why: established the pure-builder plus never-throwing sender split (`quizResultEmail.ts` / `sendQuizResultEmail.ts`) that the confirmation email mirrors.
- `.claude/plans/ticket-6-package-definition-display.md`: Why: defined `SkinPackage` (`priceInCents` in minor units plus an ISO `currency`) and forward-referenced this ticket reading `getPackageForSkinType` **server-side**.

**Forward-references**:

- TICKET-8 (Bolt.new integration, blocked): if the quiz ends up embedded in an iframe, the Razorpay modal and cross-origin behaviour must be re-checked (the architecture rejected the iframe approach for exactly this reason).

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `CLAUDE.md`: Ground rules (Types from Prisma, secrets server-only, no auth), "Fail loudly", scope discipline, and the Next.js-16 warning (read the docs in `node_modules/next/dist/docs/`).
- `ayurvedic-skin-quiz.architecture.md` "Boundaries & contracts › Payments" and "› Resend", "Data model › Order", "Spikes & experiments", and "Open questions": the thank-you copy verbatim, the phone format and the address fields. **These decisions are inherited, not re-decided.**
- `.claude/references/razorpay-integration.md`: both signature formulas, raw-body rule, PII rule for phone, zrok not ngrok, "test mode before done".
- `prisma/schema.prisma` (all): `QuizResponse` model. Add `Order` plus the back-relation here.
- `prisma.config.ts`: migrations run against `DIRECT_URL`. `DATABASE_URL` is the pooled connection used at runtime.
- `lib/db.ts` (1-9): the Prisma singleton `db`. Import it, never `new PrismaClient()`.
- `lib/resend.ts` (1-3): shape of a server-only third-party client module. `lib/razorpay.ts` follows it, but with a **lazy** client (see GOTCHA).
- `app/api/quiz-response/route.ts` (1-28): route shape. `request.json().catch(() => null)` → 400, parse via `validate.ts` → 400 with message, DB write **not** caught, then a side-effect email that never throws.
- `app/api/quiz-response/validate.ts` (1-44) and `validate.test.ts` (1-70): the hand-rolled validator (`throw new Error("<field> must …")`) and the test style (a `validPayload` fixture, one `toThrow(/field/i)` case per rule). **No zod.** zod exists only as a transitive dependency and isn't a project dependency.
- `lib/email/quizResultEmail.ts` (1-34) and `lib/email/sendQuizResultEmail.ts` (1-36): the builder/sender split, the `FROM_ADDRESS` sandbox sender, and the never-throw `try/catch` + `{ error }` check. **Note lines 24-25**: the existing builder does not escape HTML because all its values come from config. The confirmation email interpolates **user input** (name, address), so it must escape.
- `lib/email/quizResultEmail.test.ts`: assertions built from the public lookup (`getPackageForSkinType`) instead of literal placeholder strings. Mirror this.
- `lib/quiz/packages.ts` (36-44): `getPackageForSkinType`, `formatPrice` (en-IN, paise ÷ 100).
- `lib/quiz/types.ts` (5, 30-36): `SkinType`, `SkinPackage`.
- `app/quiz/_components/ResultScreen.tsx` (all 103 lines): the file to edit. Lines 36-47 POST and **ignore the returned `{ id }`**, lines 77-78 are the submitted branch, and 84-98 hold the Tailwind vocabulary for inputs and buttons that you should reuse verbatim.
- `app/quiz/_components/QuizFlow.tsx` (25-27): how ResultScreen is rendered. It needs no change.
- `app/quiz/_components/QuizFlow.test.ts`: pure helpers exported from a component file get tested from a `.test.ts` (node env; no React testing library in the repo).
- `vitest.config.ts`: `environment: "node"`, the `@` alias. Tests are `*.test.ts` next to their source.
- `.env.example`: add the three Razorpay vars.

### Next.js 16 docs to read (local, authoritative for this version)

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` §"Webhooks" (≈line 559): read the raw body with `await request.text()`. No `bodyParser` config is needed.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md` §`strategy`, §`onReady`, §`onError`: load `checkout.js` from a client component with `strategy="afterInteractive"` or `"lazyOnload"`. **Not** `beforeInteractive`, which is root-layout only.
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`: non-`NEXT_PUBLIC_` vars are server-only. That's why `RAZORPAY_KEY_ID` reaches the client through our API response and not through the environment.

### New Files to Create

- `prisma/migrations/<timestamp>_add_order/migration.sql`: generated by `prisma migrate dev`.
- `lib/razorpay.ts`: lazy Razorpay client, `createRazorpayOrder`, `getRazorpayKeyId`, `verifyPaymentSignature`, `verifyWebhookSignature`.
- `lib/razorpay.test.ts`: signature tests.
- `lib/checkout/indianAddress.ts`: `INDIAN_STATES` (36 states/UTs), `normalizeIndianPhone`, `isValidPinCode`, `getFirstName`. Pure and client-safe, because the form and the server share it.
- `lib/checkout/indianAddress.test.ts`
- `lib/orders.ts`: `markOrderPaid`, `markOrderFailed` (DB plus confirmation-email trigger, provider-agnostic).
- `lib/email/escapeHtml.ts` + `lib/email/escapeHtml.test.ts`
- `lib/email/orderConfirmationEmail.ts` + `.test.ts`: the pure builder.
- `lib/email/sendOrderConfirmationEmail.ts`: the never-throw sender.
- `app/api/checkout/route.ts`: `POST` creates the Order and the Razorpay order.
- `app/api/checkout/validate.ts` + `validate.test.ts`: `parseCheckoutPayload`.
- `app/api/checkout/verify/route.ts`: `POST` verifies the checkout-success signature, calls `markOrderPaid`, and returns the thank-you data.
- `app/api/webhooks/razorpay/route.ts`: `POST` handles the raw-body webhook.
- `app/api/webhooks/razorpay/parseEvent.ts` + `parseEvent.test.ts`: event → `{ kind: "paid" | "failed" | "ignored" }`.
- `app/quiz/_components/CheckoutForm.tsx`: the phone and address form, loading `checkout.js` and opening the modal.
- `app/quiz/_components/ThankYouScreen.tsx`: the Option A copy.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Razorpay Standard Checkout — Web integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
  - Sections: "Create an Order in Server", "Integrate with Checkout on Client-Side" (handler function), "Verify Payment Signature"
  - Why: the order → modal → `handler(response)` flow and the `order_id|payment_id` HMAC.
- [Razorpay Checkout options](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/checkout-options/)
  - Why: `key`, `amount`, `currency`, `order_id`, `name`, `description`, `prefill.{name,email,contact}`, `modal.ondismiss`.
- [Razorpay Orders API — Create](https://razorpay.com/docs/api/orders/create/)
  - Why: `amount` (integer, smallest unit), `currency`, `receipt` (**max 40 chars**), `notes` (max 15 key/value pairs).
- [Razorpay Webhooks — Validate & test](https://razorpay.com/docs/webhooks/validate-test/) and [Payment webhook events/payloads](https://razorpay.com/docs/webhooks/payloads/payments/) / [Order payloads](https://razorpay.com/docs/webhooks/payloads/orders/)
  - Why: `X-Razorpay-Signature` over the raw body. `order.paid` → `payload.order.entity.id`. `payment.failed` → `payload.payment.entity.order_id`. Razorpay retries non-2xx responses, and **it cannot reach localhost**.
- [Razorpay test card / UPI details](https://razorpay.com/docs/payments/payments/test-card-details/)
  - Why: the test instruments for manual validation (for example UPI `success@razorpay`, or the test Visa/Mastercard numbers listed there).
- [Razorpay Node SDK (razorpay-node)](https://github.com/razorpay/razorpay-node)
  - Why: `new Razorpay({ key_id, key_secret })` and `instance.orders.create(...)`. Types ship in the package.
- [zrok public shares](https://docs.zrok.io/docs/concepts/sharing-public/)
  - Why: `zrok share public localhost:3000` gives a public HTTPS URL for the test-mode webhook. Razorpay blocks ngrok.

### Patterns to Follow

**Route shape (mirror `app/api/quiz-response/route.ts`):**
```ts
const body = await request.json().catch(() => null);
if (body === null) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
let data: ...;
try { data = parseXPayload(body); }
catch (error) {
  const message = error instanceof Error ? error.message : "Invalid request body";
  return Response.json({ error: message }, { status: 400 });
}
const row = await db.x.create({ data });   // NOT wrapped in try/catch: a DB failure must 500 loudly
```

**Validator shape (mirror `validate.ts`):** `typeof body !== "object" || body === null || Array.isArray(body)` → throw; destructure `as Record<string, unknown>`; per-field `throw new Error("<field> must …")`. **Never echo the submitted value** in an error message (PII).

**Never-throw side-effect email (mirror `sendQuizResultEmail.ts:18-35`):** try/catch around `resend.emails.send`, check the returned `{ error }`, `console.error("Failed to send order confirmation email:", error)`, and never rethrow. Reuse the same `FROM_ADDRESS` string.

**Naming:** camelCase functions, PascalCase default-exported components in `_components/`, `import type` for type-only imports, `@/` alias for cross-folder imports, relative `./` for siblings.

**Logging:** plain `console.error("<What failed>:", err)`. No logger library exists. The phone number is PII: never log it in full, and never log the address.

**Tailwind vocabulary (copy from `ResultScreen.tsx`):** primary button at line 95, input at line 89, label at line 81, error at line 91, card border at line 64 (`rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]`).

---

## IMPLEMENTATION PLAN

### Phase 0: Preconditions (human + housekeeping)

- The branch `feature/ticket-7-stripe-checkout` has **uncommitted Razorpay doc changes** (the rename from `stripe-integration.md` to `razorpay-integration.md`, plus CLAUDE.md, architecture, PRD, tickets, and the SGD → INR change in `packages.ts`). Commit them first as a separate "docs: switch payment provider to Razorpay" commit, so this ticket's diff stays clean. Optionally rename the branch to `feature/ticket-7-razorpay-checkout` (ask the user; don't rename on your own).
- The user needs a Razorpay **test-mode** account: Key ID + Key Secret (Dashboard → Account & Settings → API Keys), and later a webhook secret. Also confirm that **automatic payment capture** is on (Account & Settings → Payment capture). `order.paid` only fires on capture.

### Phase 1: Foundation (schema, provider module, pure helpers)

Schema + migration, `lib/razorpay.ts`, `lib/checkout/indianAddress.ts`, `lib/email/escapeHtml.ts`. The pure helpers are independent of the schema and can be written in any order.

### Phase 2: Server flow

**Depends on:** Phase 1.
`lib/orders.ts`, confirmation email builder/sender, `/api/checkout`, `/api/checkout/verify`, `/api/webhooks/razorpay`.

### Phase 3: Spike gate: end-to-end test mode through a tunnel (architecture "Spikes & experiments")

**Depends on:** Phase 2 plus a **minimal** `CheckoutForm` (it can be unstyled at first).
Run order → modal → test payment → verify → webhook → `Order` paid → one email, through zrok. **Decision rule (from the architecture):** if the webhook is unreliable or confusing, stop and fix the tunnel/webhook setup on its own before polishing any UI.

### Phase 4: UI integration and polish

`ResultScreen` wiring, the full address form, `ThankYouScreen`, error states.

### Phase 5: Docs + full validation

CLAUDE.md map/status, `.env.example`, tickets doc, then the full validation suite.

---

## STEP-BY-STEP TASKS

### 1. INSTALL `razorpay`

- **IMPLEMENT**: `npm install razorpay@2.9.8 --save-exact`. Confirm that `package.json` shows `"razorpay": "2.9.8"` and that `package-lock.json` is updated.
- **GOTCHA**: this is the only new dependency. Don't add zod, react-hook-form or `server-only`.
- **VALIDATE**: `node -e "require('razorpay'); console.log('ok')"` and `ls node_modules/razorpay/dist/*.d.ts`
- **SATISFIES**: AC #1

### 2. UPDATE `prisma/schema.prisma`: add `OrderStatus` + `Order`

- **IMPLEMENT**:
  ```prisma
  enum OrderStatus {
    pending
    paid
    failed
  }

  model Order {
    id                String       @id @default(cuid())
    quizResponseId    String
    quizResponse      QuizResponse @relation(fields: [quizResponseId], references: [id])
    paymentProvider   String       // "razorpay"
    providerPaymentId String       @unique // the provider's ORDER id (Razorpay "order_…")
    status            OrderStatus  @default(pending)
    amount            Int          // minor units (paise), copied from lib/quiz/packages.ts at creation
    currency          String
    phone             String       // E.164, e.g. +919876543210
    fullName          String
    addressLine1      String       // flat / house no. / building
    addressLine2      String       // area / street / locality
    landmark          String?
    city              String
    state             String
    pinCode           String
    createdAt         DateTime     @default(now())

    @@index([quizResponseId])
  }
  ```
  Add `orders Order[]` to `QuizResponse` (a relation field only, so it adds no column).
- **PATTERN**: the existing `QuizResponse` style (`String @id @default(cuid())`, `createdAt DateTime @default(now())`).
- **GOTCHA**: `providerPaymentId` must be `@unique`. Both the verify route and the webhook look orders up by it, and it guarantees one row per Razorpay order. Keep the column names provider-neutral (swap rule 2). A Prisma **enum** gives generated `OrderStatus` types, per CLAUDE.md "types come from Prisma", so never hand-write a status union.
- **VALIDATE**: `npx prisma validate && npx prisma format`
- **SATISFIES**: AC #2

### 3. RUN migration

- **IMPLEMENT**: `npx prisma migrate dev --name add_order`. This regenerates the client and creates `prisma/migrations/<ts>_add_order/`.
- **GOTCHA**: it runs against `DIRECT_URL` (`prisma.config.ts`). If it hangs, check that `.env` has `DIRECT_URL`, not the pooled URL. The migration is additive (new enum + table + FK), so no data is lost.
- **VALIDATE**: `npx prisma migrate status` reports "Database schema is up to date", and `npx tsc --noEmit` passes.
- **SATISFIES**: AC #2

### 4. UPDATE `.env.example` (and tell the user to fill in `.env`)

- **IMPLEMENT**: append
  ```
  RAZORPAY_KEY_ID="rzp_test_..."
  RAZORPAY_KEY_SECRET="..."
  RAZORPAY_WEBHOOK_SECRET="..."
  ```
- **GOTCHA**: no `NEXT_PUBLIC_` prefix, not even on the Key ID (CLAUDE.md: the client gets it from our API). `.env*` is already gitignored with `!.env.example`, so never write real values to `.env.example`.
- **VALIDATE**: `git check-ignore .env && ! git check-ignore .env.example`
- **SATISFIES**: AC #9

### 5. CREATE `lib/razorpay.ts`

- **IMPLEMENT**:
  - `function requireEnv(name: string): string`: throws `new Error(\`${name} is not set\`)` if the variable is missing or empty (fail loudly).
  - A lazy singleton client: `let client: Razorpay | undefined; function getClient() { return (client ??= new Razorpay({ key_id: requireEnv("RAZORPAY_KEY_ID"), key_secret: requireEnv("RAZORPAY_KEY_SECRET") })); }`
  - `export function getRazorpayKeyId(): string`
  - `export async function createRazorpayOrder(params: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<{ id: string }>`: `getClient().orders.create({ ...params })`, returns `{ id: order.id }`. Don't catch errors. Let them propagate so the route returns a 500.
  - `export function verifyPaymentSignature({ orderId, paymentId, signature }): boolean`: HMAC-SHA256 hex of `` `${orderId}|${paymentId}` `` with `RAZORPAY_KEY_SECRET`.
  - `export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean`: HMAC-SHA256 hex of the raw body with `RAZORPAY_WEBHOOK_SECRET`. Returns false for a null signature.
  - A private `safeEqualHex(a, b)`: `Buffer.from(…, "utf8")`. If the lengths differ, return false. Otherwise use `crypto.timingSafeEqual`.
- **PATTERN**: `lib/resend.ts` (a server-only client module in `lib/`, CLAUDE.md "New third-party integration").
- **IMPORTS**: `import Razorpay from "razorpay"; import { createHmac, timingSafeEqual } from "node:crypto";`
- **GOTCHA**: build the client **lazily**. Constructing `Razorpay` with a missing `key_id` throws, and that would break `vitest` imports of this module and `next build`. `timingSafeEqual` throws on unequal lengths, so check the length first. This file and the routes below are the **only** places that may import `razorpay` (swap rule 1).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #3, #5, #6

### 6. CREATE `lib/razorpay.test.ts`

- **IMPLEMENT**: use `vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret")` and `vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec_test")`, with `afterEach(() => vi.unstubAllEnvs())`. Compute the expected signatures **inside the test** with `createHmac`. Cases:
  - the payment signature is valid for the correct order and payment
  - it's invalid when the order id is swapped, the payment id is swapped, or the signature has a different length or is empty
  - the webhook signature is valid over the exact raw string
  - it's invalid if the body is re-serialized (`JSON.stringify(JSON.parse(raw))` with different whitespace), or if the signature is null or computed with the wrong secret
  - it throws `/RAZORPAY_KEY_SECRET is not set/` when the variable is unset
- **PATTERN**: `lib/quiz/scoring.test.ts` (plain describe/it).
- **VALIDATE**: `npx vitest run lib/razorpay.test.ts`
- **SATISFIES**: AC #5, #6

### 7. CREATE `lib/checkout/indianAddress.ts` + `.test.ts`

- **IMPLEMENT**:
  - `export const INDIAN_STATES = [...] as const`: all 28 states and 8 union territories, alphabetical. This is factual data, not invented content. `export type IndianState = (typeof INDIAN_STATES)[number]`.
  - `export function normalizeIndianPhone(input: string): string | null`: strip spaces, `-`, `(`, `)`. Accept an optional `+91`, `91` (only if 12 digits) or `0` prefix, then exactly 10 digits starting 6–9. Return `+91XXXXXXXXXX`, or `null`.
  - `export function isValidPinCode(input: string): boolean`: `/^[1-9]\d{5}$/` after trim.
  - `export function getFirstName(fullName: string): string`: `fullName.trim().split(/\s+/)[0] ?? ""`.
- **GOTCHA**: this module must stay **pure**, with no `@/lib/db` and no `process.env`, because `CheckoutForm.tsx` imports it for client-side hints and the state dropdown.
- **TESTS**: phone variants (`9876543210`, `+91 98765 43210`, `098765-43210`, `919876543210` → `+919876543210`; `12345`, `5876543210`, `+1 4155552671`, letters → `null`). PIN (`110001` ok; `011001`, `11001`, `1100011`, `abcdef` no). `getFirstName("  Priya  Sharma ")` → `"Priya"`. `INDIAN_STATES.length === 36`, with no duplicates.
- **VALIDATE**: `npx vitest run lib/checkout`
- **SATISFIES**: AC #4

### 8. CREATE `lib/email/escapeHtml.ts` + `.test.ts`

- **IMPLEMENT**: `escapeHtml(s)` replaces `& < > " '` with entities (`&` first).
- **VALIDATE**: `npx vitest run lib/email/escapeHtml.test.ts`
- **SATISFIES**: AC #8

### 9. CREATE `lib/email/orderConfirmationEmail.ts` + `.test.ts`

- **IMPLEMENT**: `buildOrderConfirmationEmail(input: { orderId: string; skinType: SkinType; shipping: { fullName; addressLine1; addressLine2; landmark: string | null; city; state; pinCode } }): { subject; html; text }`.
  - The package and price come from `getPackageForSkinType` / `formatPrice`, **never from input amounts**.
  - Subject: `"Your order is confirmed"`.
  - Body: greets `getFirstName(fullName)`, then reuses the founder-approved Option A sentences ("Your bundle is being lovingly packed, just for you." / "we'll let you know the moment it's on its way."), then an order reference (`orderId`), the bundle name, products, price, "Shipping to:" and the address block.
  - **Every user-supplied value goes through `escapeHtml` in `html`**. The `text` version stays raw.
  - Do **not** write "invoice", "tax" or "GST", and don't invent any Ayurvedic copy.
  - Comment the top of the file the same way `quizResultEmail.ts:4-6` is commented.
- **PATTERN**: `lib/email/quizResultEmail.ts`, `quizResultEmail.test.ts`.
- **TESTS**: for each skin type, the email contains that package's name, products and `formatPrice` output, and no other package's name. It contains the order id, first name, city, PIN and state. A `fullName` of `<script>alert(1)</script> X` appears escaped in `html` (`&lt;script&gt;`, and no raw `<script>`). It omits the landmark line when the landmark is `null`. `/invoice|gst/i` doesn't match either body.
- **VALIDATE**: `npx vitest run lib/email`
- **SATISFIES**: AC #8

### 10. CREATE `lib/email/sendOrderConfirmationEmail.ts`

- **IMPLEMENT**: `sendOrderConfirmationEmail({ to, ...buildInput }): Promise<void>`. It never throws and mirrors `sendQuizResultEmail.ts` exactly (same `FROM_ADDRESS`, try/catch, `{ error }` check, `console.error("Failed to send order confirmation email:", …)`).
- **GOTCHA**: log the error only. Don't log `to` or the address.
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #8

### 11. CREATE `lib/orders.ts`

- **IMPLEMENT**:
  ```ts
  // Provider-agnostic Order state transitions. Both the checkout-verify route and the
  // Razorpay webhook call these; the conditional updateMany makes them idempotent and
  // race-safe (Postgres re-checks the WHERE after acquiring the row lock), so exactly
  // one caller observes the transition to "paid" and sends the confirmation email.
  export async function markOrderPaid(providerPaymentId: string): Promise<"transitioned" | "already-paid" | "not-found">
  ```
  - `const { count } = await db.order.updateMany({ where: { providerPaymentId, status: { not: "paid" } }, data: { status: "paid" } });`
  - If `count === 1`: `findUniqueOrThrow({ where: { providerPaymentId }, include: { quizResponse: true } })`, then `await sendOrderConfirmationEmail(...)` (it never throws), and return `"transitioned"`.
  - If `count === 0`: `findUnique`. Return `"already-paid"` if the order exists, otherwise `"not-found"`.
  - `markOrderFailed(providerPaymentId)`: `updateMany({ where: { providerPaymentId, status: "pending" }, data: { status: "failed" } })`. Returns the count.
  - DB errors are **not** caught (fail loudly).
- **GOTCHA**: a `failed → paid` transition is allowed, because the customer can retry inside the modal on the same Razorpay order. A `paid → failed` transition must never happen. Cast `quizResponse.skinType as SkinType`, as `app/api/quiz-response/route.ts:25` does. This module must **not** import `razorpay` (swap rule 1).
- **VALIDATE**: `npx tsc --noEmit` (DB behaviour is checked manually in Level 4, since the repo has no DB-mocking pattern)
- **SATISFIES**: AC #6, #7, #8

### 12. CREATE `app/api/checkout/validate.ts` + `validate.test.ts`

- **IMPLEMENT**: `parseCheckoutPayload(body: unknown): CheckoutPayload`, where
  `CheckoutPayload = { quizResponseId: string; phone: string /* normalized E.164 */; fullName; addressLine1; addressLine2; landmark: string | null; city; state: IndianState; pinCode }`.
  - Trim every string. Required fields must be non-empty and ≤ 200 chars (`fullName` ≤ 100).
  - Pass `phone` through `normalizeIndianPhone`. A `null` result throws `"phone must be a valid 10-digit Indian mobile number"`.
  - `pinCode` must pass `isValidPinCode`. `state` must be in `INDIAN_STATES`.
  - `landmark` is optional: an empty string or a missing value becomes `null`.
  - `quizResponseId` must be a non-empty string.
- **PATTERN**: `app/api/quiz-response/validate.ts`. **Don't** take `amount`, `currency`, `email` or `skinType` from the body. If they're present, they're ignored and never read.
- **TESTS**: mirror `validate.test.ts`. Cover a valid fixture (checking normalization and trimming), one failing case per field, and body null/string/array. Assert that `parseCheckoutPayload({ ...valid, amount: 1 })` has no `amount` key. Assert that error messages don't contain the submitted phone.
- **VALIDATE**: `npx vitest run app/api/checkout`
- **SATISFIES**: AC #3, #4

### 13. CREATE `app/api/checkout/route.ts`

- **IMPLEMENT** (`POST`):
  1. Parse the JSON and call `parseCheckoutPayload`. Errors return 400 (same shape as quiz-response).
  2. `const quizResponse = await db.quizResponse.findUnique({ where: { id: payload.quizResponseId } })`. If it's missing, return **404** `{ error: "Quiz response not found" }`.
  3. `const pkg = getPackageForSkinType(quizResponse.skinType as SkinType)`. If `pkg` is undefined (bad stored data), throw `new Error("No package for stored skinType")`, which returns a 500 loudly.
  4. `const { id: razorpayOrderId } = await createRazorpayOrder({ amount: pkg.priceInCents, currency: pkg.currency, receipt: quizResponse.id, notes: { quizResponseId: quizResponse.id, packageId: pkg.id } })`
  5. `const order = await db.order.create({ data: { quizResponseId, paymentProvider: "razorpay", providerPaymentId: razorpayOrderId, amount: pkg.priceInCents, currency: pkg.currency, phone, fullName, addressLine1, addressLine2, landmark, city, state, pinCode } })`. This call is **not** caught.
  6. Return `201 { orderId: order.id, razorpayOrderId, keyId: getRazorpayKeyId(), amount: pkg.priceInCents, currency: pkg.currency, packageName: pkg.name, prefill: { name: fullName, email: quizResponse.email, contact: phone } }`
- **GOTCHA**: the price comes **only** from `packages.ts`, looked up by the stored skinType (swap rule 3). The `receipt` field has a 40-character limit, and a cuid is about 25, so it fits. If the DB write fails after the Razorpay order was created, the orphaned Razorpay order is harmless (nothing was paid). Let it 500 and don't try to compensate. Never log `payload.phone` or the address.
- **VALIDATE**: `npx tsc --noEmit`. Then with `npm run dev`, `curl -s -X POST localhost:3000/api/checkout -H "Content-Type: application/json" -d "{}"` returns 400, and a valid body with an unknown `quizResponseId` returns 404.
- **SATISFIES**: AC #3, #4

### 14. CREATE `app/api/checkout/verify/route.ts`

- **IMPLEMENT** (`POST`, body `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`, the exact keys Razorpay's `handler` passes):
  1. Non-object bodies and missing or non-string fields return 400.
  2. If `!verifyPaymentSignature({ orderId, paymentId, signature })`, call `console.error("Checkout signature verification failed for order", orderId)` and return **400** `{ error: "Payment verification failed" }`.
  3. `const outcome = await markOrderPaid(orderId)`. `"not-found"` → `console.error` + 404.
  4. `const order = await db.order.findUniqueOrThrow({ where: { providerPaymentId: orderId }, include: { quizResponse: true } })`
  5. Return `200 { firstName: getFirstName(order.fullName), email: order.quizResponse.email }`
- **GOTCHA**: verify the signature **before** touching the DB. Idempotent: calling it twice returns 200 both times and sends the email once (via `markOrderPaid`). This is the "(a)" path in the architecture. The webhook stays the source of truth, but marking paid here as well is explicitly allowed ("both paths must be idempotent").
- **VALIDATE**: `npx tsc --noEmit`. A forged body (any strings) returns 400.
- **SATISFIES**: AC #5, #7

### 15. CREATE `app/api/webhooks/razorpay/parseEvent.ts` + `.test.ts`

- **IMPLEMENT**: `parseRazorpayWebhookEvent(json: unknown): { kind: "paid"; providerOrderId: string } | { kind: "failed"; providerOrderId: string } | { kind: "ignored"; event: string }`.
  - `event === "order.paid"`: read `payload.order.entity.id`.
  - `event === "payment.failed"`: read `payload.payment.entity.order_id`.
  - Any other event: ignored.
  - Throw on a malformed shape, meaning the event isn't a string, or it's a known event with the id missing or not a string.
- **TESTS**: minimal realistic fixtures for `order.paid` and `payment.failed`; `payment.captured` → ignored; a known event missing its id → throws; a non-object → throws.
- **VALIDATE**: `npx vitest run app/api/webhooks`
- **SATISFIES**: AC #6

### 16. CREATE `app/api/webhooks/razorpay/route.ts`

- **IMPLEMENT** (`POST`):
  1. `const rawBody = await request.text();`, the **raw** text, read before any parsing.
  2. If `!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))`, call `console.error("Razorpay webhook signature verification failed")` and return 400.
  3. `JSON.parse(rawBody)` inside a try block, then `parseRazorpayWebhookEvent`. Malformed input → `console.error` + 400.
  4. `paid`: `markOrderPaid(id)`. `failed`: `markOrderFailed(id)`. `ignored`: return 200.
  5. A `"not-found"` result or a count of 0 on failed isn't fatal. Log with `console.warn` (it could be an order from another integration, or a stale event) and return **200**, so Razorpay doesn't retry for 24h and eventually disable the webhook.
  6. DB errors are **not** caught, so they return a 500 and Razorpay retries. That's the loud and correct outcome.
- **GOTCHA**: don't call `request.json()`, because re-serialized JSON breaks the HMAC. Header names are case-insensitive through `Headers.get`. In the dashboard, subscribe to **`order.paid`** and **`payment.failed`** only.
- **VALIDATE**: `npx tsc --noEmit`. `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/webhooks/razorpay -d "{}"` returns `400`.
- **SATISFIES**: AC #6

### 17. CREATE `app/quiz/_components/ThankYouScreen.tsx`

- **IMPLEMENT**: props `{ firstName: string; email: string }`. Render the **verbatim** Option A copy from the architecture's Open questions:
  - `<h2>`: `Thank you, {firstName}!`
  - `Your bundle is being lovingly packed, just for you.`
  - `We've sent your order confirmation to {email}, and we'll let you know the moment it's on its way.`
  - `Here's to caring for your skin, gently and in its own way.`

  Use `&apos;` in JSX (ESLint `react/no-unescaped-entities`, as in `ResultScreen.tsx:78`). If `firstName` is empty, fall back to `Thank you!`.
- **PATTERN**: heading and paragraph classes from `ResultScreen.tsx:58-61`.
- **VALIDATE**: `npm run lint`
- **SATISFIES**: AC #7

### 18. CREATE `app/quiz/_components/CheckoutForm.tsx`

- **IMPLEMENT** (`"use client"`), props `{ quizResponseId: string; onPaid: (data: { firstName: string; email: string }) => void }`:
  - `<Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => setError("Couldn't load the payment window. Please refresh and try again.")} />`
  - Fields, each with a `<label htmlFor>`:
    - Full name
    - Phone (`type="tel"`, `inputMode="numeric"`, `autoComplete="tel"`, hint "10-digit mobile number")
    - Flat / House no. / Building (`autoComplete="address-line1"`)
    - Area / Street / Locality (`address-line2`)
    - Landmark (optional)
    - City (`address-level2`)
    - State (`<select>` over `INDIAN_STATES`, `address-level1`)
    - PIN code (`inputMode="numeric"`, `maxLength={6}`, `postal-code`)
  - Client-side pre-checks with `normalizeIndianPhone` / `isValidPinCode` show friendly errors. The server re-validates anyway.
  - Submit: POST `/api/checkout`. If the response isn't OK, show the error, using the same fetch/error pattern as `ResultScreen.tsx:35-53`. On OK, store the response and call `openCheckout(data)`.
  - `openCheckout`: `new window.Razorpay({ key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.razorpayOrderId, name: "Savyasachi Ayurveda", description: data.packageName, prefill: data.prefill, handler: async (resp) => { POST /api/checkout/verify with resp; if ok → onPaid(json) else setError("We couldn't confirm your payment yet. If money was deducted, you'll get a confirmation email shortly.") }, modal: { ondismiss: () => setIsPaying(false) } }).open()`
  - After the order exists, replace the form with a summary plus a **"Complete payment"** button. That button reopens the modal for the **same** Razorpay order instead of creating a new `Order` each time it's clicked.
  - Disable submit while submitting, or while `!scriptReady`.
  - Add a minimal `declare global { interface Window { Razorpay: new (options: RazorpayCheckoutOptions) => { open(): void } } }` with a small local options interface in this file. This is a type for the global, not a provider SDK import, so it respects swap rule 1.
- **GOTCHA**:
  - Never import from `razorpay` or `@/lib/razorpay` here, and never read `process.env` here.
  - The amount displayed and passed to the modal is the server's response, not a client-side constant.
  - Don't `console.log` the phone number.
  - The `name` "Savyasachi Ayurveda" is the business name from the PRD's live site. It's factual, not invented.
- **VALIDATE**: `npm run lint && npx tsc --noEmit`
- **SATISFIES**: AC #3, #4, #7

### 19. UPDATE `app/quiz/_components/ResultScreen.tsx`

- **IMPLEMENT**:
  - Lines 42-47: after `response.ok`, `const { id } = await response.json(); setQuizResponseId(id);`. Replace the `submitted` boolean with `quizResponseId: string | null`, or keep both.
  - Add state `checkoutOpen: boolean` and `paid: { firstName; email } | null`.
  - Render:
    - If `paid` is set: return `<ThankYouScreen {...paid} />`, replacing the whole result view.
    - Otherwise, in the submitted branch (lines 77-78), keep the "Thanks! We'll be in touch." line and add a primary **"Buy Now"** button (same classes as line 95). Clicking it sets `checkoutOpen`, which renders `<CheckoutForm quizResponseId={quizResponseId} onPaid={setPaid} />` below the package card.
  - Before email submit, there's no Buy button.
- **GOTCHA**: keep the email-first order. `Order` requires a `QuizResponse` FK, and the email comes from it. Keep the package card where it is (outside the ternary, as PR #4 noted).
- **VALIDATE**: `npm run lint && npx tsc --noEmit && npm test`
- **SATISFIES**: AC #3, #7

### 20. SPIKE GATE: run the end-to-end test-mode loop (Level 4 below) before any further UI polish

- **IMPLEMENT**: run the full Level 4 manual flow through zrok. If the webhook step fails, fix the tunnel and webhook config in isolation (architecture decision rule) before continuing.
- **VALIDATE**: all of Level 4's checks pass.
- **SATISFIES**: AC #5, #6, #7, #8, #10

### 21. UPDATE docs

- **IMPLEMENT**:
  - `CLAUDE.md`: fix the **Status** line, which says "pre-code" and is stale. In the Architecture map, add `api/checkout/verify/route.ts`, `lib/orders.ts`, `lib/checkout/indianAddress.ts`, `lib/email/`, and `app/api/quiz-response/` if it's missing. Add `OrderStatus` to the schema line. Keep the file terse.
  - `docs/tickets/ayurvedic-skin-quiz.md`: move TICKET-7 into the planned/done list with a one-line pointer to this plan.
  - Only touch the architecture doc if something diverged. Record it in AMENDMENTS here too.
- **VALIDATE**: `git diff --stat` shows only the intended docs.
- **SATISFIES**: AC #11

---

## TESTING STRATEGY

### Unit Tests (vitest, node env, `*.test.ts` co-located)

| File | Covers |
|---|---|
| `lib/razorpay.test.ts` | both HMACs: valid, tampered, wrong secret, length mismatch, null header, re-serialized body; missing env throws |
| `lib/checkout/indianAddress.test.ts` | phone normalization variants, PIN rules, state list integrity, `getFirstName` |
| `app/api/checkout/validate.test.ts` | every field rule, trimming, landmark → null, extra `amount` ignored, no PII in messages |
| `app/api/webhooks/razorpay/parseEvent.test.ts` | `order.paid` / `payment.failed` extraction, ignored events, malformed → throw |
| `lib/email/escapeHtml.test.ts` | all five characters, `&` ordering |
| `lib/email/orderConfirmationEmail.test.ts` | right package/price per skin type and no other package, address + order id present, XSS escaped, no "invoice/GST" |

Assertions are built from `getPackageForSkinType` / `formatPrice`, not from literal `[PLACEHOLDER]` strings, so the tests survive real content (same approach as `quizResultEmail.test.ts`).

### Integration Tests

The repo has no DB or HTTP integration harness, and adding one is out of proportion for this project (global CLAUDE.md). Route plus DB behaviour is verified with the Level 3 curl checks and the Level 4 end-to-end run against Razorpay test mode and the real Supabase DB.

### Edge Cases

- A forged verify request (random signature) → 400, and the Order stays `pending`.
- A webhook with a bad or missing signature → 400. A body re-serialized after signing → 400.
- The verify route and the `order.paid` webhook arrive at the same moment: status ends `paid`, and **exactly one** email is sent.
- The same webhook is delivered twice (Razorpay retry) → 200 both times, one email.
- `payment.failed` followed by a successful retry in the same modal → `failed → paid`, one email.
- `order.paid` followed by a late `payment.failed` → stays `paid`.
- The customer dismisses the modal, then clicks "Complete payment": the same Razorpay order is reused and no second `Order` row is created.
- A webhook for an unknown order id → warn plus 200. A DB outage → 500, so Razorpay retries.
- A client posts `amount: 1` to `/api/checkout` → the charged amount is still `packages.ts`'s value.
- An unknown `quizResponseId` → 404.
- Required env vars are missing → a loud 500 with "`X is not set`" in the server log.
- The customer's name contains HTML → it's escaped in the email.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
```
npx prisma validate
npx tsc --noEmit
npm run lint
```

### Level 2: Unit Tests
```
npm test
```
(All existing tests plus the new ones. The baseline before this ticket is 38 passing tests.)

### Level 3: Route smoke checks (with `npm run dev` running on localhost:3000)
```
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/checkout -H "Content-Type: application/json" -d "{}"                # 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/checkout/verify -H "Content-Type: application/json" -d '{"razorpay_order_id":"order_x","razorpay_payment_id":"pay_x","razorpay_signature":"bad"}'  # 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/webhooks/razorpay -d "{}"                                          # 400
npm run build
```
Confirm that the client bundle doesn't contain the secret: after the build, `grep -r "RAZORPAY_KEY_SECRET\|RAZORPAY_WEBHOOK_SECRET" .next/static` returns nothing.

### Level 4: Manual end-to-end, Razorpay **test mode** (required: "reading the code isn't enough")

1. Fill in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `.env` (test keys start with `rzp_test_`). Confirm that auto-capture is on.
2. `npm run dev`. In a second terminal: `zrok share public localhost:3000`, and copy the HTTPS URL.
3. Razorpay Dashboard (Test Mode) → Webhooks → add `<zrok-url>/api/webhooks/razorpay`, set a secret, and subscribe to `order.paid` and `payment.failed`. Put the secret in `RAZORPAY_WEBHOOK_SECRET` and restart dev.
4. In the browser, complete the quiz, submit an email you can read, click **Buy Now**, and fill in a valid address and a `98765 43210`-style phone number.
5. Pay with UPI `success@razorpay` or a test card from Razorpay's test-card docs. Check that the **thank-you screen** shows your first name and email.
6. `npx prisma studio`: the `Order` row has `status = paid`, `amount = 9900`, `currency = INR`, `providerPaymentId = order_…`, and the phone is stored as `+91…`.
7. Dashboard → Webhooks → the delivery log shows `order.paid` with **200**.
8. Inbox: exactly **one** order-confirmation email, with the bundle, ₹99.00 and the address.
9. Failure path: start a new order and pay with `failure@razorpay` (or a failing test card), then close the modal. The Order becomes `failed` via the webhook, no email is sent, and "Complete payment" retries on the same order. A successful retry moves it to `paid` with one email.
10. Idempotency: in the Dashboard, **resend** the `order.paid` webhook. It returns 200, and no second email arrives.
11. Security: in Dashboard → Webhooks, temporarily change the secret without updating `.env`, then trigger an event. It returns 400 and the server logs "signature verification failed". Restore the secret afterwards.

### Level 5: Additional

- Optional: use the `claude-in-chrome` / `agent-browser` skill to drive steps 4–5 and record a GIF of the checkout flow for the PR.

---

## ACCEPTANCE CRITERIA

1. [ ] `razorpay@2.9.8` is installed with an exact pin, and it's the only new dependency.
2. [ ] The `Order` model plus the `OrderStatus` enum are migrated, with provider-neutral columns, a unique `providerPaymentId`, structured Indian address fields, phone, amount (paise) and currency. `QuizResponse` columns are unchanged.
3. [ ] After email submit, **Buy Now** collects phone and address, creates an `Order` (`pending`) plus a Razorpay order priced **only** from `lib/quiz/packages.ts`, and opens the Razorpay modal with the email, phone and name pre-filled.
4. [ ] The server rejects invalid phone numbers (anything that isn't a 10-digit Indian mobile), invalid PINs, unknown states, missing required fields, and unknown quiz responses. The phone is stored as `+91XXXXXXXXXX`.
5. [ ] The checkout-success `razorpay_signature` is verified server-side (HMAC of `order_id|payment_id`, timing-safe) before anything is trusted.
6. [ ] The webhook verifies `X-Razorpay-Signature` over the **raw** body. `order.paid` → `paid`, `payment.failed` → `failed` (only from `pending`). Duplicates and races are idempotent.
7. [ ] After a verified payment, the buyer sees the thank-you screen with the exact Option A copy, their first name and their email.
8. [ ] Exactly one order-confirmation email is sent, only on the transition to `paid`, with user input HTML-escaped and no invoice or GST wording. A send failure is logged and never affects the payment update.
9. [ ] The secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are server-only. The Key ID reaches the client only through the API. The `razorpay` import appears only in `lib/razorpay.ts` (check with `grep -rn "from \"razorpay\"" app lib`).
10. [ ] The Level 4 test-mode loop, including the tunnel webhook, completed successfully by hand.
11. [ ] `tsc`, lint, all tests and `next build` pass. CLAUDE.md and the tickets doc are updated.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes
- [ ] No linting or type checking errors
- [ ] Level 4 test-mode loop confirmed (not just compiled)
- [ ] Acceptance criteria all met
- [ ] Code reviewed for quality and maintainability

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumption: Indian mobile numbers only** (10 digits starting 6–9, stored as `+91…`). This follows from India-only shipping. If the founder wants overseas buyers to use non-Indian phone numbers while shipping to India, loosen `normalizeIndianPhone` to general E.164. It's a small change.
- **Assumption: Buy Now appears only after the email is submitted.** `Order` needs the `QuizResponse` FK and the email for the prefill and the confirmation email. This matches the PRD's step order (email capture → checkout).
- **Assumption: the verify route also marks the order `paid`**, not just the webhook. This gives the buyer an immediate, correct thank-you screen and a confirmation email even when the webhook is slow. The architecture allows it ("both paths must be idempotent"), and the webhook stays the source of truth for the `failed` state and for payments where the browser closed mid-flow.
- **Not stored: the Razorpay payment id (`pay_…`).** The architecture's data model doesn't include it. The dashboard shows it under the order, which is enough for handling refunds by hand. Add a `providerTransactionId` column later if reconciliation gets painful.
- **Open (founder): GST / invoices.** The confirmation email avoids invoice wording until this is confirmed. It doesn't block building, but it must be settled before real money is taken.
- **Open (founder): real bundle names and prices.** Still `[PLACEHOLDER]` at ₹99.00. The Razorpay minimum is ₹1, so ₹99 is fine for test mode.
- **Open (founder/ops): Razorpay KYC plus international payments.** Needed before live mode, not for this ticket.
- **Housekeeping:** the branch name says "stripe". Ask the user whether to rename it before opening the PR.

## NOTES (open canvas)

**Why an `updateMany` with a status guard, not an events table:** Razorpay can deliver the same `order.paid` more than once, and the verify route reports the same payment too. Instead of storing `x-razorpay-event-id`s, the only state that matters is "did *this* call flip the row to paid?". In Postgres, `UPDATE … WHERE status <> 'paid'` makes a concurrent second updater block on the row lock, re-evaluate the predicate after the first commits, and match 0 rows. So "send the email iff `count === 1`" is exactly-once for the email without any extra table. The one gap: if the process crashes after the update but before the email is sent, the email is lost and won't be retried. That's acceptable at hobby scale, and the log line makes it visible.

**Why create the Razorpay order before the DB row:** `providerPaymentId` is required and unique, and it only exists after `orders.create`. The reverse order would need a nullable column plus a second update. If the DB insert then fails, the orphaned Razorpay order just expires unpaid. Nothing was charged, so a loud 500 is fine.

**Why `node:crypto` rather than the SDK's `validateWebhookSignature`:** it's the same algorithm, but written out it's about 10 visible lines, can be unit-tested without network or SDK internals, and makes the timing-safe comparison explicit. It still lives in `lib/razorpay.ts`, so swap rule 1 holds.

**Data flow:**
```
ResultScreen ──POST /api/quiz-response──▶ {id}
   └─Buy Now─▶ CheckoutForm ──POST /api/checkout {quizResponseId, phone, address}
                    │            └─ price from packages.ts → razorpay.orders.create → db.order.create(pending)
                    ◀── {razorpayOrderId, keyId, amount, currency, prefill}
                    └─ window.Razorpay(...).open()  ──(customer pays in modal)──
                           handler ──POST /api/checkout/verify──▶ HMAC(order|payment) ✔ → markOrderPaid ─┐
Razorpay ──order.paid / payment.failed──▶ /api/webhooks/razorpay ─ HMAC(raw body) ✔ → markOrderPaid/Failed ┤
                                                                     exactly one transition → confirmation email
                    ◀── {firstName, email} ──▶ ThankYouScreen
```

**Rejected: a separate `/quiz/thank-you` route using `?order=` in the URL.** It survives a reload, but it would need an unauthenticated order lookup that leaks PII by id, or a signed token. Client state is simpler and is enough for v1.

## AMENDMENTS

- (none yet)
