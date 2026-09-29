# Feature: TICKET-6 — Package Definition + Display

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files etc.

## Feature Description

Define what a "package" is in code and show it to the visitor. Following the founder's answer to the PRD's load-bearing open question, a package is a **physical product bundle**. Each skin type maps to one priced bundle of skincare products, which the visitor buys once (checkout itself is TICKET-7). This ticket adds:

1. A `SkinPackage` type in `lib/quiz/types.ts`.
2. `lib/quiz/packages.ts`: a content-as-config `Record<SkinType, SkinPackage>`, a lookup `getPackageForSkinType`, and a pure `formatPrice`. The real product names and prices aren't known yet, so all content is **clearly marked `[PLACEHOLDER]`**.
3. A package card on the result screen (`ResultScreen.tsx`) showing the bundle's name, its products and its price, placed after the skin type and before the email form.
4. The package in the result email (`lib/email/quizResultEmail.ts`). This fulfils the architecture's "sends the package summary email after quiz completion," which TICKET-5 deliberately deferred to this ticket.
5. Doc bookkeeping: record the founder's decision in the PRD and unblock TICKET-6 in the ticket breakdown.

## User Story

As a visitor who just finished the skin quiz
I want to see the specific product bundle recommended for my skin type and what it costs, and get it in my inbox
So that I know exactly what to buy instead of guessing with generic products

## Problem Statement

The quiz currently ends on "Your skin type: dry" plus an email form, with no recommendation and no price. That leaves out MVP step 4 in the PRD ("a custom skincare package shown to the user, with a price"), and TICKET-7 (Stripe Checkout) has nothing to charge for. `lib/quiz/packages.ts` is in the CLAUDE.md architecture map but doesn't exist. Until now the ticket was blocked because nobody knew whether a "package" was a product or a service. **That's resolved as of 2026-09-28: it's a physical product bundle.**

## Solution Statement

Model a package as plain TypeScript config, following the architecture's content-as-config pattern (the same approach as `lib/quiz/questions.ts`). The price is an **integer in minor units (`priceInCents`) plus an ISO currency code**. That's the shape Stripe's `unit_amount` and `currency` expect in TICKET-7, and it avoids floating-point money. Because `packages.ts` is pure (no I/O, no secrets), both the client component (`ResultScreen.tsx`) and the server-side email builder can import it. Display formatting goes through one pure `formatPrice` so the screen and the email always show the same string.

`buildQuizResultEmail(skinType)` **keeps its signature** and looks up the package internally. `sendQuizResultEmail.ts` and `app/api/quiz-response/route.ts` therefore need **no changes**. TICKET-5's forward-reference said the same: "TICKET-6 can edit `lib/email/quizResultEmail.ts` directly."

## Out of Scope / Non-Goals

- Not included: a "Buy Now" button, `app/api/checkout/route.ts`, `lib/stripe.ts`, the `Order` model, or any Stripe code. That's TICKET-7, and it's also the founder's explicit build order (quiz UX first, checkout second; see `.claude/references/stripe-integration.md`). Don't add a disabled or placeholder "Buy" button either.
- Not included: real product names, descriptions or prices. Per `.claude/references/quiz-content.md`, don't invent plausible Ayurvedic products. Use `[PLACEHOLDER]` content only. The PRD open question "What are the actual skincare packages/products … and their pricing?" is still open.
- Not included: product images, per-product prices, quantities, stock or variants. A bundle has one price and a list of product names. Adding more fields ahead of real content would mean guessing.
- Not included: gender-specific packages. The mapping is keyed on `SkinType` only, matching `scoring.ts`'s output. The PRD's "should this target women specifically?" question is unresolved and isn't this ticket's to decide.
- Not changing: `prisma/schema.prisma`. No `packageId` on `QuizResponse`, and no migration. The package can be derived from the stored `skinType` (see Open Questions).
- Not changing: `app/api/quiz-response/route.ts`, `validate.ts`, `lib/email/sendQuizResultEmail.ts`, `lib/resend.ts`, `lib/quiz/scoring.ts` and `lib/quiz/questions.ts`.
- Not changing: the post-submit "Thanks! We'll be in touch." copy (see Open Questions).

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Low
**Primary Systems Affected**: `lib/quiz/` (types + new `packages.ts`), `app/quiz/_components/ResultScreen.tsx`, `lib/email/quizResultEmail.ts`
**Dependencies**: None new. `Intl.NumberFormat` is built into Node 22 and browsers.

## Related Work

**Implements**: TICKET-6 in `docs/tickets/ayurvedic-skin-quiz.md` ("Blocked" section, now unblocked) · **Epic**: `ayurvedic-skin-quiz.architecture.md`

**Back-references** (plans this builds on or inherits decisions from):

- `.claude/plans/ticket-2-quiz-content-scoring.md`: Why: established the `SkinType` union (`"dry" | "sensitive" | "oily"`), `lib/quiz/types.ts` as the single source of shared quiz types, and the `[PLACEHOLDER]` content convention in `questions.ts`.
- `.claude/plans/ticket-3-quiz-flow-ui.md`: Why: built `ResultScreen.tsx` and explicitly deferred package display to this ticket.
- `.claude/plans/ticket-5-result-email.md`: Why: built `buildQuizResultEmail` and forward-referenced this ticket extending it in place (no "content sections" abstraction).

**Forward-references** (plans that extend or supersede this; append as follow-ups get created):

- TICKET-7 (Stripe Checkout + `Order`): will read `getPackageForSkinType(skinType)` **server-side** to build the Checkout line item (`unit_amount: priceInCents`, `currency: currency.toLowerCase()`, `product_data.name: name`). It must never trust a price sent from the client.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `lib/quiz/types.ts` (all 28 lines): Why: the `SkinType` union and interface style (`export interface`, no `I` prefix). `SkinPackage` goes here.
- `lib/quiz/questions.ts` (lines 1-8): Why: the top-of-file PLACEHOLDER comment block and `[PLACEHOLDER]` string prefix convention that `packages.ts` must mirror exactly.
- `lib/quiz/scoring.ts` (lines 9-15): Why: the `Record<Dosha, SkinType>` lookup-table style. `PACKAGES: Record<SkinType, SkinPackage>` mirrors it, and the `Record` type forces every skin type to be covered at compile time.
- `lib/quiz/scoring.test.ts` (lines 1-30): Why: the vitest style and the "tests independent of placeholder content" philosophy (lines 5-7). The new tests should assert structure and behaviour, not literal placeholder strings.
- `app/quiz/_components/ResultScreen.tsx` (all 88 lines): Why: the file you'll edit. Note the Tailwind class vocabulary (`text-zinc-700 dark:text-zinc-300`, `border-black/[.08] dark:border-white/[.145]`, `rounded-lg`) to reuse for the package card, and the `result.skinType` prop that's already available.
- `lib/email/quizResultEmail.ts` (all 26 lines): Why: the file you'll edit. Its comment on lines 3-5 says "no package/pricing (still TBD, see TICKET-6)" and must be updated.
- `lib/email/quizResultEmail.test.ts` (all 25 lines): Why: the existing "excludes the other skin-type labels" assertion **constrains the placeholder names** (see GOTCHA in the packages task).
- `.claude/references/quiz-content.md`: Why: the "don't invent placeholder Ayurvedic content" rule. `packages.ts` is explicitly named there as content-as-config.
- `.claude/references/stripe-integration.md`: Why: confirms checkout is a separate, later step, so there's no Buy button here.
- `ayurvedic-skin-quiz.prd.md` (lines 74-80): Why: the Open Questions to update (line 76 is now resolved; line 80 stays open).
- `docs/tickets/ayurvedic-skin-quiz.md` (lines 51-58 "Blocked" section): Why: TICKET-6's stub, to be replaced with real scope.

### New Files to Create

- `lib/quiz/packages.ts`: `PACKAGES` config, `getPackageForSkinType`, `formatPrice`.
- `lib/quiz/packages.test.ts`: unit tests for the mapping's integrity and for `formatPrice`.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [MDN — Intl.NumberFormat, `style: "currency"`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#style): Why: `formatPrice`'s implementation. Verified locally on Node 22.14: `new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(99)` → `"$99.00"`, and `"en-US"` → `"SGD 99.00"`.
- [Stripe — Price `unit_amount` (smallest currency unit)](https://docs.stripe.com/api/prices/object#price_object-unit_amount) and [zero-decimal currencies](https://docs.stripe.com/currencies#zero-decimal): Why: justifies `priceInCents` as an integer and the `/ 100` in `formatPrice`. SGD is a two-decimal currency.
- **Next.js note (CLAUDE.md "This is NOT the Next.js you know")**: this ticket uses no new Next.js API. `ResultScreen.tsx` is already a `"use client"` component and only gains plain JSX. No route, layout or data-fetching change, so no `node_modules/next/dist/docs/` guide applies. If you find yourself touching a route or a server component, stop and read the relevant guide first.

### Patterns to Follow

**Content-as-config with a loud PLACEHOLDER banner (mirror `lib/quiz/questions.ts:1-8`):**

```ts
// PLACEHOLDER CONTENT — not the real product bundles or prices.
// The founder decided (2026-09-28) that a "package" is a physical product
// bundle, but hasn't provided the actual products/prices yet (see the PRD's
// Open Questions and .claude/references/quiz-content.md). Every name below is
// prefixed "[PLACEHOLDER]" so it's never mistaken for real content. Replace the
// data here when the real bundles arrive — callers should not need to change.
```

**Lookup `Record` keyed on a literal union (mirror `lib/quiz/scoring.ts:11-15`):** `const PACKAGES: Record<SkinType, SkinPackage> = { dry: {...}, sensitive: {...}, oily: {...} };` The `Record` type makes a missing skin type a compile error, so there's no runtime "not found" branch to write.

**Shared types live in `lib/quiz/types.ts` (TICKET-2 AC: "the single source every other ticket imports"):** put `SkinPackage` there, not in `packages.ts`. This is **not** a Prisma model, so the CLAUDE.md rule "never hand-write parallel interfaces for Prisma models" doesn't apply.

**Money:** an integer in minor units plus an uppercase ISO 4217 code. Never a float price, and never format prices with string concatenation (`"$" + price`). Always use `formatPrice`.

**Pure/I-O split (TICKET-4/5 precedent):** `packages.ts` imports only types. No `@/lib/db`, `@/lib/resend` or `process.env`. This is what makes it safe to import from the client component `ResultScreen.tsx` without leaking anything server-only into the client bundle.

**Tests independent of placeholder literals (mirror `scoring.test.ts:5-7`):** assert against `getPackageForSkinType(...)`'s returned values, not hard-coded strings like `"[PLACEHOLDER] Bundle A"`, so the tests still pass when real content replaces the placeholders.

**Error handling:** there are no new failure paths. The lookup is total over `SkinType` at the type level, and `formatPrice` on a valid ISO code can't fail. Don't add try/catch or fallbacks. If `Intl` throws on a bad currency code, that's a config bug and should surface loudly (CLAUDE.md "Fail loudly").

---

## IMPLEMENTATION PLAN

### Phase 1: Record the decision (docs)

**Independent of:** Phases 2-4 (docs only; can be done in any order, but do it first so the repo reflects why this ticket is no longer blocked).

**Tasks:**
- Check off and annotate the PRD open question about what a "package" is.
- Replace TICKET-6's BLOCKED stub in the ticket breakdown with real scope and AC.

### Phase 2: Package model + config (pure, tested)

**Tasks:**
- Add the `SkinPackage` interface to `lib/quiz/types.ts`.
- Create `lib/quiz/packages.ts` with placeholder config, `getPackageForSkinType` and `formatPrice`.
- Create `lib/quiz/packages.test.ts`.

### Phase 3: Display surfaces

**Depends on:** Phase 2.
**Independent of each other:** 3a (result screen) and 3b (email) touch different files and can be done in either order.

**Tasks:**
- 3a: Add the package card to `ResultScreen.tsx`.
- 3b: Add the package section to `buildQuizResultEmail`, and extend its tests.

### Phase 4: Manual end-to-end validation

**Depends on:** Phases 2-3.

---

## STEP-BY-STEP TASKS

### UPDATE `ayurvedic-skin-quiz.prd.md`

- **IMPLEMENT**: On the Open Questions line starting `- [ ] **What does "custom skincare package" actually mean...` (line 76), change `[ ]` to `[x]` and append `**Resolved 2026-09-28:** a physical product bundle per skin type, bought once via Stripe Checkout (the original MVP shape), not a route into a consultation/program.` Leave line 80 ("What are the actual skincare packages/products … and their pricing?") **unchecked**. That question is still open.
- **PATTERN**: Mirror the architecture doc's resolved-item style (`ayurvedic-skin-quiz.architecture.md` line 59: `- [x] ~~Neon vs. Supabase~~ — resolved 2026-09-20: ...`).
- **VALIDATE**: `grep -n "Resolved 2026-09-28" ayurvedic-skin-quiz.prd.md` returns one line.
- **SATISFIES**: AC #7 (the decision is recorded).

### UPDATE `docs/tickets/ayurvedic-skin-quiz.md`

- **IMPLEMENT**: Move TICKET-6 out of "Blocked" into "Tickets" with the same field layout as TICKET-1..5: **Scope / AC** (SkinPackage type + `lib/quiz/packages.ts` placeholder config; result screen shows bundle name/products/price; result email includes the package; done when completing the quiz shows and emails the matching package), **Context**, **Files (est.)**, **Size** (~200-350 lines), **Depends on:** TICKET-2, TICKET-3, TICKET-5. Under TICKET-7, replace the text "Blocked on the same question" with a note that the product-vs-service question is resolved (physical product → one-time Checkout payment). TICKET-7 still depends on TICKET-6, and its detailed planning is a separate step. Leave TICKET-8 blocked.
- **GOTCHA**: Don't detail-plan TICKET-7 here. Just remove the stale blocker text.
- **VALIDATE**: The file no longer contains `TICKET-6 — Package definition + display (BLOCKED)`: `grep -c "(BLOCKED)" docs/tickets/ayurvedic-skin-quiz.md` → `1` (TICKET-8 only).
- **SATISFIES**: AC #7.

### UPDATE `lib/quiz/types.ts`

- **IMPLEMENT**: Append:
  ```ts
  export interface SkinPackage {
    id: string;
    name: string;
    products: string[];
    priceInCents: number;
    currency: string;
  }
  ```
  `products` is a plain list of product names. There's no per-product object until real content shows it's needed (YAGNI). `currency` is an uppercase ISO 4217 code (e.g. `"SGD"`).
- **PATTERN**: `export interface`, matching `QuizOption` and `QuizQuestion` in the same file.
- **GOTCHA**: Name it `SkinPackage`, not `Package`. `package` is a reserved word in strict-mode JS, and a bare `Package` identifier reads ambiguously next to npm "packages."
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1.

### CREATE `lib/quiz/packages.ts`

- **IMPLEMENT**:
  - The top-of-file PLACEHOLDER banner (exact text in Patterns above).
  - `const PACKAGES: Record<SkinType, SkinPackage>` with three entries:
    - `dry`: `{ id: "bundle-a", name: "[PLACEHOLDER] Bundle A", products: ["[PLACEHOLDER] Product A1", "[PLACEHOLDER] Product A2", "[PLACEHOLDER] Product A3"], priceInCents: 9900, currency: "SGD" }`
    - `sensitive`: the same shape with `bundle-b` / `Bundle B` / `Product B1..B3`
    - `oily`: the same shape with `bundle-c` / `Bundle C` / `Product C1..C3`
    - Add a one-line comment on `priceInCents`/`currency`: placeholder amount; SGD assumed because the practice is in Singapore (see plan Open Questions).
  - `export function getPackageForSkinType(skinType: SkinType): SkinPackage { return PACKAGES[skinType]; }`
  - `export function formatPrice(priceInCents: number, currency: string): string { return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(priceInCents / 100); }`. Add a one-line comment that `/ 100` assumes a two-decimal currency (true for SGD and USD; Stripe's zero-decimal currencies like JPY would need changes here).
  - **Don't export `PACKAGES` itself.** Callers go through `getPackageForSkinType`. Tests that need to iterate all skin types should iterate a local `SkinType[]` list (see test task).
- **PATTERN**: `lib/quiz/questions.ts` (banner + `[PLACEHOLDER]` prefix) and `lib/quiz/scoring.ts:11-15` (`Record` lookup).
- **IMPORTS**: `import type { SkinPackage, SkinType } from "@/lib/quiz/types";`. Nothing else.
- **GOTCHA 1 (don't break the existing email test)**: `lib/email/quizResultEmail.test.ts` asserts the dry email does **not** contain `"Sensitive"` or `"Oily"`, and so on. That's why placeholder names use neutral letters (`Bundle A/B/C`). **Never** name them "Dry Skin Bundle", "Oil-Control Set" and the like. `"Oil-Control"` doesn't contain `"Oily"` today, but a later real name such as "Oily Skin Kit" would break the cross-contamination check. Neutral placeholders keep this ticket green.
- **GOTCHA 2 (no invented content)**: no Ayurvedic ingredient names (e.g. "Kumkumadi oil", "Neem cleanser") and no marketing descriptions. They'd read like real recommendations. Placeholders only.
- **GOTCHA 3 (locale)**: `"en-SG"` renders SGD as `"$99.00"` (verified on Node 22.14). Keep the locale hard-coded rather than using the browser default. That keeps the server-rendered email and the client screen identical, and makes test output deterministic.
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1, AC #2.

### CREATE `lib/quiz/packages.test.ts`

- **IMPLEMENT**: `const SKIN_TYPES: SkinType[] = ["dry", "sensitive", "oily"];`
  - `describe("getPackageForSkinType")`:
    - `it.each(SKIN_TYPES)` "returns a well-formed package for %s": `name` is non-empty, `products.length > 0`, `Number.isInteger(priceInCents) && priceInCents > 0`, and `currency` matches `/^[A-Z]{3}$/`.
    - "maps each skin type to a distinct package": the set of `id`s has size 3, and so does the set of `name`s. This catches a copy-paste error where two skin types point at the same bundle.
  - `describe("formatPrice")`:
    - `formatPrice(9900, "SGD")` → `"$99.00"`
    - `formatPrice(1050, "SGD")` → `"$10.50"`. This proves minor units are divided rather than shown raw.
    - `formatPrice(0, "SGD")` → `"$0.00"`
    - `expect(() => formatPrice(100, "not-a-currency")).toThrow()`. A bad config should fail loudly, not render garbage.
- **PATTERN**: `lib/quiz/scoring.test.ts`. Use `describe`/`it`/`expect` from `vitest` and the `@/lib/...` import alias. Don't assert literal `[PLACEHOLDER]` strings.
- **IMPORTS**: `import { describe, expect, it } from "vitest"; import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages"; import type { SkinType } from "@/lib/quiz/types";`
- **GOTCHA**: If the exact `"$99.00"` assertions fail on a different Node/ICU build, check the actual output first. On Node 22 with full ICU it's verified. Don't loosen to a regex unless you've confirmed ICU differences are the cause.
- **VALIDATE**: `npm test` (expect 27 existing + the new cases, all passing)
- **SATISFIES**: AC #2, AC #6.

### UPDATE `app/quiz/_components/ResultScreen.tsx`

- **IMPLEMENT**:
  - Import `formatPrice` and `getPackageForSkinType` from `@/lib/quiz/packages`.
  - At the top of the component body: `const skinPackage = getPackageForSkinType(result.skinType);`
  - Between the existing skin-type/dosha `<div>` (lines 57-60) and the `{submitted ? ... : <form>}` block, add a package card:
    ```tsx
    <section className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
      <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Your recommended package</h3>
      <p className="text-base font-medium text-black dark:text-zinc-50">{skinPackage.name}</p>
      <ul className="list-disc pl-5 text-base text-zinc-700 dark:text-zinc-300">
        {skinPackage.products.map((product) => (
          <li key={product}>{product}</li>
        ))}
      </ul>
      <p className="text-lg font-semibold text-black dark:text-zinc-50">
        {formatPrice(skinPackage.priceInCents, skinPackage.currency)}
      </p>
    </section>
    ```
  - Keep the card visible both before and after email submit. It sits outside the `submitted ? ... : ...` ternary.
- **PATTERN**: Reuse the class vocabulary already in this file: the border colours from the `<input>` (line 74) and the text colours from lines 56-58. Don't introduce new colours or a component library.
- **IMPORTS**: `import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";` in the existing `@/lib/...` import group, below the `@/lib/quiz/types` import.
- **GOTCHA 1**: No "Buy Now" or checkout button, not even a disabled one (TICKET-7).
- **GOTCHA 2**: Don't send the package or price in the `POST /api/quiz-response` body. The server doesn't need it, and a client-sent price must never be trusted (it matters for TICKET-7).
- **GOTCHA 3**: `key={product}` relies on product names being unique within a bundle. That's true for the placeholders. If real content ever repeats a name, switch to an index key.
- **VALIDATE**: `npx tsc --noEmit && npm run lint`, then manual check in Phase 4.
- **SATISFIES**: AC #3.

### UPDATE `lib/email/quizResultEmail.ts`

- **IMPLEMENT**:
  - Import `formatPrice` and `getPackageForSkinType` from `@/lib/quiz/packages`.
  - Replace the comment on lines 3-5 with: factual, minimal content only. It shows the computed skin type plus the mapped package (currently `[PLACEHOLDER]` content from `lib/quiz/packages.ts`), with no invented dosha/Ayurvedic copy.
  - In `buildQuizResultEmail`, `const skinPackage = getPackageForSkinType(skinType); const price = formatPrice(skinPackage.priceInCents, skinPackage.currency);`
  - `html`: keep the existing two paragraphs. Then add `<p>Your recommended package: <strong>${skinPackage.name}</strong> (${price})</p><ul>${skinPackage.products.map((p) => `<li>${p}</li>`).join("")}</ul>` and keep the closing "We'll be in touch soon." paragraph.
  - `text`: the matching plain-text lines, i.e. `Your recommended package: ${name} (${price})` followed by the products as `- ${p}` lines.
  - The `subject` and the function signature stay unchanged.
- **PATTERN**: TICKET-5's plain template-string approach. No templating library.
- **GOTCHA 1**: No HTML escaping is needed, because every interpolated value comes from our own `packages.ts` config and never from user input. Leave a short comment saying so, so a future change that interpolates user input (such as the email address) knows it needs escaping.
- **GOTCHA 2**: `sendQuizResultEmail.ts` and `route.ts` stay untouched, since the signature is the same. If you find yourself editing them, you've gone off-plan.
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #4.

### UPDATE `lib/email/quizResultEmail.test.ts`

- **IMPLEMENT**: Keep the existing `it.each` unchanged. It must still pass, and it proves the neutral placeholder names didn't break the cross-contamination check. Add a second `it.each(Object.keys(LABELS))` titled "includes the %s skin type's package name, products and price, and no other package's name":
  - `const pkg = getPackageForSkinType(skinType)` and `const price = formatPrice(pkg.priceInCents, pkg.currency)`.
  - Expect `html` and `text` to each contain `pkg.name`, `price`, and every entry of `pkg.products`.
  - For each *other* skin type's package, expect `html` and `text` **not** to contain that package's `name`.
- **PATTERN**: The existing `it.each` + cross-contamination style in the same file.
- **IMPORTS**: Add `import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";`, and cast `skinType as keyof typeof LABELS` the same way the existing test does.
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #4, AC #6.

### Manual validation (Phase 4)

- **IMPLEMENT**: Follow Level 4 below.
- **VALIDATE**: All Level 4 checks pass.
- **SATISFIES**: AC #3, AC #4, AC #5.

---

## TESTING STRATEGY

Following the global CLAUDE.md rule, pure logic gets unit tests and UI is verified by running it. `packages.ts` (mapping integrity + `formatPrice`) and `buildQuizResultEmail` (content) are pure, so they're fully unit-tested. `ResultScreen.tsx` is UI and is verified manually. The project has no React testing library, and adding one for a card of static JSX would be disproportionate.

### Unit Tests

- `lib/quiz/packages.test.ts`: well-formed package per skin type, distinct packages, `formatPrice` rounding/minor-units/zero/invalid-currency cases.
- `lib/email/quizResultEmail.test.ts`: existing skin-label test unchanged, plus a new package-content test with cross-contamination checks.

### Integration Tests

None automated. The manual flow in Level 4 covers screen → save → email end to end, the same as TICKET-4/5.

### Edge Cases

- Each of the three skin types shows **its own** bundle on screen and in the email, never another's (unit-tested for the email; checked manually for the screen by driving answers to each outcome).
- A price that isn't a whole-dollar amount displays with cents (`1050` → `$10.50`).
- An invalid currency code in config throws instead of rendering (unit-tested).
- The package card stays visible after email submit, and the submit failure path (existing) still shows the error without hiding the card.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

- `npx tsc --noEmit`
- `npm run lint`

### Level 2: Unit Tests

- `npm test`: all suites pass (baseline before this ticket: 4 files, 27 tests).

### Level 3: Integration Tests

N/A (see Testing Strategy).

### Level 4: Manual Validation

1. `npm run dev` (binds to localhost by default), then open `http://localhost:3000/quiz`.
2. Answer every skin question with the first option (vata-weighted in the placeholder questions, so the result is `dry`). The result screen should show "Your skin type: dry", a "Your recommended package" card with `[PLACEHOLDER] Bundle A`, three products and `$99.00`, and **no** Buy button.
3. Repeat with all second options (→ `sensitive` → Bundle B) and all third options (→ `oily` → Bundle C). Confirm each shows its own bundle.
4. On one run, submit a real email you can check (the Resend account owner's own address, per TICKET-5's sandbox caveat). Confirm the card is still visible after "Thanks! We'll be in touch." and that the received email contains the skin type, the bundle name, the price and the three products.
5. `npx prisma studio`: confirm the new `QuizResponse` row looks exactly as before (no new columns or data).
6. `git status`: confirm only the files listed in this plan changed, and `.env` isn't staged.

### Level 5: Additional Validation (Optional)

- `npm run build` to confirm the production build succeeds with `packages.ts` imported into a client component.

---

## ACCEPTANCE CRITERIA

1. [ ] `SkinPackage` is defined in `lib/quiz/types.ts`, and `lib/quiz/packages.ts` maps every `SkinType` to exactly one package whose content is clearly marked `[PLACEHOLDER]`.
2. [ ] Prices are integer minor units plus an ISO currency code, and are displayed only through `formatPrice`.
3. [ ] The result screen shows the matching package's name, product list and formatted price, before and after email submit, with no checkout/Buy button.
4. [ ] The result email includes the matching package's name, products and price alongside the skin type.
5. [ ] No changes to `prisma/schema.prisma`, `route.ts`, `validate.ts`, `sendQuizResultEmail.ts` or the POST payload.
6. [ ] `npx tsc --noEmit`, `npm run lint` and `npm test` all pass, including the new tests, with zero regressions.
7. [ ] The PRD records the 2026-09-28 "physical product bundle" decision, and the ticket breakdown no longer lists TICKET-6 as blocked.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes
- [ ] No linting or type checking errors
- [ ] Manual testing confirms feature works (all three skin types + email)
- [ ] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Resolved during planning (2026-09-28):** a "package" is a **physical product bundle** (the user answered for the founder). This unblocks TICKET-6 and removes TICKET-7's product-vs-service blocker.
- **Still open, doesn't block this ticket: real bundle contents and prices.** All three bundles use `[PLACEHOLDER]` names/products and a placeholder `9900` (S$99.00). When the founder provides real content, it's a data-only edit to `lib/quiz/packages.ts`. Warn the founder that a real product name containing "Dry", "Sensitive" or "Oily" will trip `quizResultEmail.test.ts`'s cross-contamination check. That test would then need to compare against labels more precisely, but that's a follow-up, not a reason to change the design now.
- **Assumption: currency is SGD.** Based on the PRD's evidence that the practice is in Singapore. `en-SG` displays SGD as a bare `$`, which Singapore visitors read correctly but international ad traffic could mistake for USD. If ads target outside Singapore, consider `currencyDisplay: "code"` or a different locale. It's a one-line change in `formatPrice`.
- **Assumption: one bundle per skin type, no gender variation.** Matches `scoring.ts`'s output. If the founder wants gender-specific bundles, `getPackageForSkinType` becomes `(skinType, gender)`. That's a contained change.
- **Assumption: nothing about the package is persisted on `QuizResponse`.** The package can be derived from the stored `skinType` today. If package content changes over time and you later need to know "what did this lead actually see?", add a `packageId` column then, or let TICKET-7's `Order` carry the price paid. That isn't needed for this ticket's AC.
- **Assumption: the "Thanks! We'll be in touch." copy stays.** A "We've emailed you your package" message is a one-line follow-up if the founder wants it.

## NOTES (open canvas)

**Why `priceInCents` + `currency` rather than a float `price`:** TICKET-7 passes this straight to Stripe (`unit_amount`, `currency`), which only accepts integer minor units. Storing a float now would mean a conversion (and a rounding bug surface) later. Naming it `priceInCents` rather than `priceMinor`/`amount` keeps the unit unambiguous at every call site.

**Why `buildQuizResultEmail` looks up the package itself instead of taking it as an argument:** keeping the `(skinType)` signature means `sendQuizResultEmail.ts` and `route.ts` stay untouched, which keeps the diff to the files that actually change. It's still pure (`packages.ts` is static config), so testability isn't affected.

**Why the package isn't in the POST payload or DB:** the server already knows `skinType` and can derive the package. Sending it from the client adds nothing and sets a bad precedent for TICKET-7, where the price used for Checkout must come from server-side config, never from the request.

**Rejected: a `lib/money.ts` module for `formatPrice`.** There's one money helper and it's only used for packages, so it lives next to them. Move it if TICKET-7 needs money helpers beyond this.

**Note, CLAUDE.md drift:** the root CLAUDE.md still says "Status: pre-code — nothing is scaffolded yet," which has been stale since TICKET-1. That's out of scope here, but worth a `rules-check-drift` pass before or after this merges.

## AMENDMENTS

(none yet)
