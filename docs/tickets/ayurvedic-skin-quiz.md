# Ticket Breakdown — Ayurvedic Skin Quiz

*Sliced from `ayurvedic-skin-quiz.prd.md` + `ayurvedic-skin-quiz.architecture.md`. No tracker configured — local breakdown.*

## Epic summary

A standalone Next.js quiz: gender + skin questions → dosha-based skin type → (eventually) a priced package → email capture → (eventually) Razorpay checkout, to test whether ad/social visitors want individualized Ayurvedic skincare enough to complete the flow and attempt a purchase.

**Note before you run any of this:** two of the PRD's open questions are load-bearing for half these tickets — what a "package" actually is (a physical product vs. a route into an existing consultation/program), and how integration via Bolt.new actually works. Tickets 1–5 below don't depend on either and are ready to build now. Tickets 6–8 are real but intentionally left as stubs — planning them in detail today would mean guessing at decisions that are the founder's to make, not the agent's. *(Update 2026-09-28: the "package" question is resolved — a physical product bundle — so TICKET-6 is now scoped below and TICKET-7 is unblocked; TICKET-8 remains blocked.)*

## Tickets

### TICKET-1 — Project scaffold + core data model
- **Scope / AC:** Initialize Next.js (App Router) + TypeScript + Tailwind CSS; set up Prisma against a Supabase Postgres project; define the `QuizResponse` model in `prisma/schema.prisma`; add `lib/db.ts` (Prisma client singleton); establish the `app/`, `lib/`, `prisma/` layout from the architecture map. Done when `npx prisma migrate dev` runs clean and `next dev` boots a placeholder page.
- **Context:** architecture doc → "Recommended approach," "Key decisions › Database," "Data model." CLAUDE.md → Architecture map.
- **Files (est.):** `package.json`, config files, `prisma/schema.prisma`, `lib/db.ts`, `app/layout.tsx`, `app/page.tsx` (placeholder), `.env.example`
- **Size:** ~300–500 lines, mostly scaffold/config
- **Depends on:** none

### TICKET-2 — Quiz content config + dosha-scoring engine
- **Scope / AC:** `lib/quiz/questions.ts` (gender + skin questions — placeholder content, clearly marked TBD), `lib/quiz/scoring.ts` (pure function: answers → dominant dosha/skin type), shared `lib/quiz/types.ts`. Done when `scoring.ts` has unit tests covering each dosha outcome and the question/answer types are the single source every other ticket imports.
- **Context:** `.claude/references/quiz-content.md`; PRD Evidence (dosha framework sources); architecture doc "Content-as-config pattern."
- **Files (est.):** `lib/quiz/questions.ts`, `lib/quiz/scoring.ts`, `lib/quiz/types.ts`, `lib/quiz/scoring.test.ts`
- **Size:** ~300–600 lines (30–40% tests)
- **Depends on:** TICKET-1

### TICKET-3 — Quiz flow UI (landing page → multi-step quiz → result)
- **Scope / AC:** Real landing page (`app/page.tsx`), multi-step quiz under `app/quiz/` driven by TICKET-2's config, client-side state across all questions, a result screen showing the computed skin type (package display is deferred to TICKET-6) plus an email input. This is the founder's explicit build priority — the flow needs to feel smooth and intuitive, not just functional. Done when a user can complete the full question set and see their skin type.
- **Context:** PRD → "Target User & JTBD," "Build-sequencing note." Architecture doc `app/quiz/` map entry. CLAUDE.md → "Where new code goes › New quiz step."
- **Files (est.):** `app/quiz/*` and shared quiz UI components
- **Size:** ~800–1500 lines, mostly UI — lighter on tests per CLAUDE.md's testing rule (UI is verified by running the flow)
- **Depends on:** TICKET-2

### TICKET-4 — Save quiz response on completion
- **Scope / AC:** `app/api/quiz-response/route.ts` — POST endpoint that persists `{email, gender, answers, skinType}` to `QuizResponse` when the quiz reaches the result screen; wire TICKET-3's completion step to call it. Done when completing the quiz in the browser produces a real row (check via `npx prisma studio`), and a failed save throws/logs visibly rather than being swallowed.
- **Context:** `.claude/references/quiz-content.md` (persistence-timing: write once, on completion). CLAUDE.md → Ground rules (Types, Secrets), "Fail loudly, never swallow."
- **Files (est.):** `app/api/quiz-response/route.ts`
- **Size:** ~150–300 lines
- **Depends on:** TICKET-1, TICKET-3 — can run in parallel with TICKET-3 if the save-payload shape is agreed upfront

### TICKET-5 — Result email
- **Scope / AC:** `lib/resend.ts` (server-only Resend client); send an email after a successful save summarizing the user's computed skin type. Deliberately ships skin-type-only content — no priced package — since that's still undefined (see TICKET-6). Done when completing the quiz sends a real email with the correct skin type.
- **Context:** architecture doc → "Boundaries & contracts › Resend." CLAUDE.md → Secrets rule.
- **Files (est.):** `lib/resend.ts`, an email template
- **Size:** ~150–350 lines
- **Depends on:** TICKET-4

### TICKET-6 — Package definition + display
- **Scope / AC:** `SkinPackage` type in `lib/quiz/types.ts`; `lib/quiz/packages.ts` mapping each skin type to one physical product bundle (name, products, price in minor units + currency) — content clearly marked `[PLACEHOLDER]` until the founder provides real bundles/prices; the result screen shows the matching bundle's name, products, and price (no Buy button yet); the result email includes the package. Done when completing the quiz shows and emails the package matching the computed skin type.
- **Context:** PRD Open Questions (package = physical product bundle, resolved 2026-09-28). `.claude/references/quiz-content.md` (no invented content). Architecture doc "Content-as-config pattern."
- **Files (est.):** `lib/quiz/types.ts`, `lib/quiz/packages.ts`, `lib/quiz/packages.test.ts`, `app/quiz/_components/ResultScreen.tsx`, `lib/email/quizResultEmail.ts` (+ test)
- **Size:** ~200–350 lines
- **Depends on:** TICKET-2, TICKET-3, TICKET-5

## Unblocked — not yet planned in detail

### TICKET-7 — Razorpay Checkout + `Order`
**Planned + implemented 2026-09-29:** see `.claude/plans/ticket-7-razorpay-checkout.md` and `.claude/reports/ticket-7-razorpay-checkout-report.md`. The manual test-mode loop is still pending Razorpay keys.

The product-vs-service question is resolved (2026-09-28: physical product bundle → a one-time payment). **Provider decision (2026-09-29): Razorpay**, confirmed by the founder, replacing the earlier Stripe plan (Stripe stays documented as a fallback). Scope decided 2026-09-29: at "Buy Now" collect phone + Indian-format shipping address; one flat price including shipping; Razorpay payment; a warm thank-you screen after payment; an order-confirmation email when the order is paid. No refunds or fulfilment logic. Needs its own detailed plan, which must follow the architecture doc's "Boundaries › Payments" (Razorpay Standard Checkout, both signatures verified server-side, webhook through a tunnel for local testing, and the three swap-safety rules). Depends on TICKET-6.

## Blocked — do not plan in detail until the founder resolves these

### TICKET-8 — Site integration via Bolt.new (BLOCKED)
Blocked on PRD open question: *"How does integration via Bolt.new actually work?"* Determines whether this stays a standalone linked app or something embedded — which could also reshape TICKET-3's landing page.

## Dependency graph

```
TICKET-1
  └─→ TICKET-2
        └─→ TICKET-3 ─→ TICKET-4 ─→ TICKET-5
                 (TICKET-4 parallel to TICKET-3 if the save-payload contract is fixed first)

TICKET-5 ─→ TICKET-6 ─→ TICKET-7
TICKET-8 (blocked, independent of 6/7)
```

## Suggested execution order

- **Wave 1:** TICKET-1
- **Wave 2:** TICKET-2
- **Wave 3:** TICKET-3 (+ TICKET-4 in parallel, once its API contract is agreed)
- **Wave 4:** TICKET-5
- **Wave 5:** TICKET-6
- **Wave 6:** TICKET-7 (plan in detail first)
- **Then:** resolve the Bolt.new integration question with the founder, and re-slice TICKET-8 with real detail.
