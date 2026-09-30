# Implementation Report — TICKET-7: Razorpay Checkout + `Order`

**Plan**: `.claude/plans/ticket-7-razorpay-checkout.md`   **Branch**: `feature/ticket-7-razorpay-checkout`   **Status**: PARTIAL. The code is complete and Levels 1–3 pass. The Level 4 end-to-end test-mode run is still pending, because it needs Razorpay test keys, a webhook secret and zrok from the user.

## Summary
Built the full checkout path. After the email step, **Buy Now** collects an Indian phone number and shipping address. `/api/checkout` then creates a Razorpay order priced only from `lib/quiz/packages.ts` and a `pending` `Order`, and the client opens Razorpay Standard Checkout. On success, `/api/checkout/verify` checks the HMAC signature and marks the order paid, and the founder's "Option A" thank-you screen is shown. `/api/webhooks/razorpay` verifies the raw-body signature and drives `paid`/`failed`. Both paths go through `lib/orders.ts`, whose conditional `updateMany` makes the transition idempotent and sends the order-confirmation email exactly once.

## Tasks completed
1. Installed `razorpay@2.9.8` with an exact pin → `package.json`, `package-lock.json` (UPDATE)
2. `Order` model, `OrderStatus` enum, `QuizResponse.orders` back-relation → `prisma/schema.prisma` (UPDATE)
3. Migration → `prisma/migrations/20260929022041_add_order/migration.sql` (CREATE, applied to Supabase)
4. Razorpay env placeholders → `.env.example` (UPDATE)
5. Lazy client plus timing-safe HMAC helpers → `lib/razorpay.ts` (CREATE)
6. → `lib/razorpay.test.ts` (CREATE)
7. → `lib/checkout/indianAddress.ts` + `.test.ts` (CREATE)
8. → `lib/email/escapeHtml.ts` + `.test.ts` (CREATE)
9. → `lib/email/orderConfirmationEmail.ts` + `.test.ts` (CREATE)
10. → `lib/email/sendOrderConfirmationEmail.ts` (CREATE)
11. → `lib/orders.ts` (CREATE)
12. → `app/api/checkout/validate.ts` + `.test.ts` (CREATE)
13. → `app/api/checkout/route.ts` (CREATE)
14. → `app/api/checkout/verify/route.ts` (CREATE)
15. → `app/api/webhooks/razorpay/parseEvent.ts` + `.test.ts` (CREATE)
16. → `app/api/webhooks/razorpay/route.ts` (CREATE)
17. → `app/quiz/_components/ThankYouScreen.tsx` (CREATE)
18. → `app/quiz/_components/CheckoutForm.tsx` (CREATE)
19. → `app/quiz/_components/ResultScreen.tsx` (UPDATE: keeps `quizResponseId`, adds Buy Now, CheckoutForm and ThankYouScreen)
20. Spike gate (Level 4): **not run**. It's blocked on user-provided credentials (see below).
21. → `CLAUDE.md` (status and map), `docs/tickets/ayurvedic-skin-quiz.md` (UPDATE)

## Tests added
73 new tests, all passing:
- `lib/razorpay.test.ts` (11): valid/tampered/wrong-secret/length-mismatch payment signatures; webhook raw-body vs re-serialized, null header, key-vs-webhook secret; missing env throws.
- `lib/checkout/indianAddress.test.ts` (22): phone normalization variants and rejects, PIN rules, 36 unique states, `isIndianState`, `getFirstName`.
- `app/api/checkout/validate.test.ts` (20): every required field, whitespace, length caps, phone/PIN/state, landmark → null, client `amount/currency/email/skinType` dropped, no PII echoed in errors, non-object bodies.
- `app/api/webhooks/razorpay/parseEvent.test.ts` (9): `order.paid`, `payment.failed`, ignored events, missing ids, malformed bodies.
- `lib/email/escapeHtml.test.ts` (3); `lib/email/orderConfirmationEmail.test.ts` (7): per-skin-type package/price and no other package, address plus order ref, landmark omitted, XSS escaped, no invoice/GST/tax wording.

## Validation results
| Check | Result |
|---|---|
| `npx prisma validate` / `migrate dev` | Pass; migration applied |
| `npx tsc --noEmit` | Pass, 0 errors |
| `npm run lint` | 0 errors, 4 warnings. 2 are new, from the same `_omitted` rest-destructure idiom already used in `quiz-response/validate.test.ts` |
| `npm test` | Pass, 111/111 in 11 files (baseline 38) |
| `npm run build` | Pass; `/api/checkout`, `/api/checkout/verify`, `/api/webhooks/razorpay` built as dynamic |
| Secrets in `.next/static` | None |
| `razorpay` SDK imports | Only `lib/razorpay.ts`. `@/lib/razorpay` is imported only by the three provider routes |
| Level 3 curl | checkout `{}` → 400; unknown quizResponseId → 404; verify missing fields → 400; webhook without signature → 400. Verify with a bad signature → **500**, because `RAZORPAY_KEY_SECRET` isn't set yet (`requireEnv` failing loudly, as intended). It will return 400 once keys exist. |
| Level 4 (test-mode e2e via zrok) | **Pending**: needs keys, webhook secret and zrok |

## Deviations from the plan
- Added `isIndianState()` to `lib/checkout/indianAddress.ts` as a type guard, so the validator narrows `state` to `IndianState` without a cast.
- The verify route validates its three fields inline instead of in a separate `validate.ts`. The plan didn't specify a file, and the check is 3 `typeof`s.
- `CheckoutForm` renders `<Script>` once, outside both the form view and the "Complete payment" view, so the script doesn't remount when the view switches. It also shows a "Loading payment…" button label until `checkout.js` is ready.
- `sendOrderConfirmationEmail` logs the order id (not PII) with failures, for traceability. `sendQuizResultEmail` logs no identifier.

## Issues encountered
- `prisma migrate dev` applied the migration and generated the TypeScript client, but it couldn't swap `query_engine-windows.dll.node`, because the user's running `next dev` holds it (EPERM). The engine version didn't change, so types and runtime are fine. **Restart `npm run dev`** so the running server loads the new client with `Order`.
- `node_modules/.prisma/client/` contains a leftover `query_engine-windows.dll.node.tmp*` file. It's untracked and harmless, and was left alone.
- The Razorpay doc switch (Stripe→Razorpay in CLAUDE.md/architecture/PRD/references/packages.ts) was already uncommitted on this branch before this work began. The plan's Phase 0 suggests committing it separately first. That wasn't done, because nothing gets committed without being asked.
