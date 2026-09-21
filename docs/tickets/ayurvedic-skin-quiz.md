# Ticket Breakdown — Ayurvedic Skin Quiz

*Sliced from `ayurvedic-skin-quiz.prd.md` + `ayurvedic-skin-quiz.architecture.md`. No tracker configured — local breakdown.*

## Epic summary

A standalone Next.js quiz: gender + skin questions → dosha-based skin type → (eventually) a priced package → email capture → (eventually) Stripe checkout, to test whether ad/social visitors want individualized Ayurvedic skincare enough to complete the flow and attempt a purchase.

**Note before you run any of this:** two of the PRD's open questions are load-bearing for half these tickets — what a "package" actually is (a physical product vs. a route into an existing consultation/program), and how integration via Bolt.new actually works. Tickets 1–5 below don't depend on either and are ready to build now. Tickets 6–8 are real but intentionally left as stubs — planning them in detail today would mean guessing at decisions that are the founder's to make, not the agent's.

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

## Blocked — do not plan in detail until the founder resolves these

### TICKET-6 — Package definition + display (BLOCKED)
Blocked on PRD open question: *"What does 'custom skincare package' actually mean, given the live site sells services, not products?"* The shape of `lib/quiz/packages.ts`, whether there's even a "price" field, and what the result screen shows all depend on the answer (physical product bundle vs. a route into an existing consultation/program).

### TICKET-7 — Stripe Checkout + `Order` (BLOCKED)
Blocked on the same question — charging for a one-time product and booking a paid service are different Stripe integrations entirely. Also depends on TICKET-6.

### TICKET-8 — Site integration via Bolt.new (BLOCKED)
Blocked on PRD open question: *"How does integration via Bolt.new actually work?"* Determines whether this stays a standalone linked app or something embedded — which could also reshape TICKET-3's landing page.

## Dependency graph

```
TICKET-1
  └─→ TICKET-2
        └─→ TICKET-3 ─→ TICKET-4 ─→ TICKET-5
                 (TICKET-4 parallel to TICKET-3 if the save-payload contract is fixed first)

TICKET-6 (blocked) ─→ TICKET-7 (blocked)
TICKET-8 (blocked, independent of 6/7)
```

## Suggested execution order

- **Wave 1:** TICKET-1
- **Wave 2:** TICKET-2
- **Wave 3:** TICKET-3 (+ TICKET-4 in parallel, once its API contract is agreed)
- **Wave 4:** TICKET-5
- **Then:** resolve the two open questions with the founder, and re-slice TICKET-6/7/8 with real detail.
