# Feature: TICKET-3 — Quiz Flow UI (Landing Page → Multi-Step Quiz → Result)

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Build the actual user-facing quiz experience: a real landing page that replaces the `create-next-app` placeholder, a client-driven multi-step quiz under `app/quiz/` that walks the visitor through TICKET-2's questions one at a time, and a result screen that computes and shows the visitor's dosha-based skin type plus captures their email. This is the founder's explicit build priority (per the PRD's "Build-sequencing note") — the flow itself needs to feel smooth, not just be functional, since UX quality is exactly what the hypothesis is testing.

## User Story

As a new visitor arriving from an ad/social link
I want to answer a short set of questions about my skin and quickly see my Ayurvedic skin type
So that I can find out what's actually right for me instead of guessing with generic products

## Problem Statement

TICKET-2 built the scoring engine and question config, but there's no way for a real visitor to use it — the app still shows the `create-next-app` starter page, and `scoreQuiz`/`questions` aren't wired into any UI. Nothing can be demoed or user-tested until a visitor can actually click through the quiz and see a result.

## Solution Statement

Replace `app/page.tsx` with a real landing page (headline + CTA linking to `/quiz`). Add `app/quiz/page.tsx` as a thin Server Component route entry that renders a client-side `QuizFlow` component. `QuizFlow` holds all answer state in memory (per the architecture doc: "each answer is held in client state until the quiz is complete" — no partial persistence), steps through `lib/quiz/questions.ts` one question at a time via a `QuestionStep` component, and on the last question calls `scoreQuiz()` to compute the result, then swaps in a `ResultScreen` component showing the computed skin type and an email input. No network calls are made anywhere in this ticket — persistence is TICKET-4's job; the email input's submit handler is a clearly-marked local stub TICKET-4 will extend.

## Out of Scope / Non-Goals

- Not included: any network call / API route / persistence. `QuizResponse` is never written to in this ticket — that's TICKET-4, which will extend `ResultScreen`'s email-submit handler (see Notes).
- Not included: package/pricing display on the result screen — explicitly deferred to TICKET-6 (blocked on an unresolved PRD question about what a "package" even is).
- Not included: sending the result email — that's TICKET-5, which depends on TICKET-4's persistence existing first.
- Not included: editing or "fixing" `lib/quiz/questions.ts`'s placeholder content — TICKET-2 deliberately left it as clearly-marked placeholder pending the founder's real framework; this ticket renders whatever `questions.ts` currently exports, unchanged.
- Not included: drop-off/analytics tracking — flagged as an open architecture question (mid-quiz drop-off can't be measured in v1), not this ticket's problem to solve.
- Not changing: `lib/quiz/types.ts`, `lib/quiz/questions.ts`, `lib/quiz/scoring.ts`, `prisma/schema.prisma`, `lib/db.ts` — this ticket only adds `app/` files.

## Feature Metadata

**Feature Type**: New Capability (UI)
**Estimated Complexity**: Medium (no new backend/data-model work, but a real multi-step client state machine plus the landing page)
**Primary Systems Affected**: `app/` (new `app/quiz/*`, rewritten `app/page.tsx`)
**Dependencies**: None new — uses `lib/quiz/*` (TICKET-2) and the Tailwind v4 setup already in the project (TICKET-1)

## Related Work

**Implements**: TICKET-3 in `docs/tickets/ayurvedic-skin-quiz.md` (lines 27-32) · **Epic**: `ayurvedic-skin-quiz.architecture.md`

**Back-references** (plans this builds on or inherits decisions from):

- `.claude/plans/ticket-2-quiz-content-scoring.md` — Why: this ticket consumes `lib/quiz/types.ts`, `questions.ts`, and `scoring.ts` exactly as TICKET-2 defined them; no changes to that contract.
- `.claude/plans/ticket-1-project-scaffold.md` — Why: the `app/` layout, Tailwind v4 setup, and TypeScript config this ticket's new files must match.

**Forward-references** (plans that extend or supersede this — append as follow-ups get created):

- TICKET-4 (save on completion) will replace `ResultScreen`'s local-only email-submit stub with a real `fetch` to `app/api/quiz-response/route.ts`, sending `{ email, gender, answers, skinType }`.
- TICKET-5 (result email) depends on TICKET-4, which depends on this ticket's `ResultScreen` shape.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `lib/quiz/types.ts` (all 28 lines) — `QuizQuestion`, `QuizOption`, `QuizAnswers`, `ScoringResult`, `Dosha`, `Gender`, `SkinType`. **Read the gotcha under Patterns below about `QuizAnswers.gender` before writing `QuizFlow`'s state.**
- `lib/quiz/questions.ts` (all ~55 lines) — the exact question set to render: one `gender` question (options `female`/`male`/`other`, no dosha weights) followed by skin questions. All prompts/labels are prefixed `[PLACEHOLDER]` — render them as-is, don't clean up the prefix.
- `lib/quiz/scoring.ts` (all ~35 lines) — `scoreQuiz(answers: QuizAnswers, questions: QuizQuestion[]): ScoringResult`. Pure, throws on an unknown `questionId`/`optionId` — call it only once every question has been answered, with `responses` built entirely from real selections (never a partial/guessed answer).
- `app/layout.tsx` (all ~24 lines) — the existing root layout: uses the `LayoutProps<"/">` global helper type, sets `min-h-full flex flex-col` on `body`. New pages render inside this; don't duplicate `<html>`/`<body>`.
- `app/page.tsx` (all ~57 lines) — the current `create-next-app` placeholder to be **replaced entirely** with real landing content. Note its Tailwind class patterns (e.g. `dark:` variants, `zinc` palette) if you want visual consistency, though a from-scratch, simpler layout is fine too.
- `app/globals.css` (all ~19 lines) — Tailwind v4 `@import "tailwindcss"` + `@theme inline` token setup already in place. Don't add a `tailwind.config` file — this project uses Tailwind v4's CSS-first config; don't "fix" that.
- `docs/tickets/ayurvedic-skin-quiz.md` (lines 27-32) — TICKET-3's exact scope/AC.
- `ayurvedic-skin-quiz.prd.md` (lines 33-39, "Target User & JTBD") — who's landing on this page and why, for landing-page copy tone.
- `ayurvedic-skin-quiz.prd.md` (line 53, "Build-sequencing note") — confirms UX polish here is a founder priority, not a nice-to-have.
- `ayurvedic-skin-quiz.architecture.md` (line 17, "Recommended approach") — "each answer is held in client state until the quiz is complete" — the load-bearing constraint on `QuizFlow`'s state design.
- `CLAUDE.md` ("Where new code goes › New quiz step") — new quiz UI goes inside `app/quiz/`, not a new top-level route; the quiz is one multi-step flow, not one route per question.

### New Files to Create

- `app/quiz/page.tsx` — thin Server Component route entry; renders `<QuizFlow />`.
- `app/quiz/_components/QuizFlow.tsx` — `"use client"`; owns all state (current step, `responses`), renders `QuestionStep` or `ResultScreen`, handles Back/Next.
- `app/quiz/_components/QuestionStep.tsx` — renders one `QuizQuestion`'s prompt + selectable options.
- `app/quiz/_components/ResultScreen.tsx` — renders the computed `ScoringResult` + an email input with a local-only submit stub.

### Files to Update

- `app/page.tsx` — replaced with a real landing page: headline, short description, a `<Link href="/quiz">` CTA. Remove the `create-next-app` boilerplate (Next.js/Vercel logos, "Deploy Now"/"Documentation" links) — none of it is relevant to this app.

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Next.js — Layouts and Pages](node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md) — confirms `app/quiz/page.tsx` is all that's needed to create the `/quiz` route (no `layout.tsx` needed there — it inherits the root layout), and how `<Link>` works for the landing page's CTA.
- [Next.js — Server and Client Components](node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md) — confirms the pattern this plan uses: `app/quiz/page.tsx` stays a Server Component (no interactivity needed there) and only `QuizFlow`/`QuestionStep`/`ResultScreen` need `"use client"` since they hold state and handle events. Keep the `"use client"` boundary as low as possible per this doc's "Reducing JS bundle size" section — it's already about as low as it can go here (the whole quiz needs interactivity), so a single boundary at `QuizFlow` (with `QuestionStep`/`ResultScreen` as its children, not separately marked) is correct and sufficient.
- [Next.js — Project Structure, "Private folders"](node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md#L257-L282) — files inside `app/quiz/` that aren't `page`/`layout`/etc. are already non-routable by default (colocation); this plan uses `app/quiz/_components/` anyway for clarity now that there are 3 component files, not because it's required.
- **Note on the CLAUDE.md "This is NOT the Next.js you know" instruction**: this ticket is the first to touch real App Router surface (`app/quiz/*`, rewritten `app/page.tsx`). The two docs above were read as part of producing this plan; the one concrete behavior change from older mental models that matters here is confirmed in `app/layout.tsx` itself — the project already uses the Next 16 `LayoutProps<"/">` / `PageProps<'/route'>` global helper types instead of hand-written `{ params, children }` prop types. Neither new page in this ticket has dynamic params, so plain, prop-less `function Page()` (matching `app/page.tsx`'s existing `Home()`) is correct for `app/quiz/page.tsx` too — no `PageProps` needed.

### Patterns to Follow

**Component structure** (`.claude/references/frontend-component-best-practices.md`): one component per file, filename matches the exported component name (PascalCase); order within a file is imports → types/interfaces → component → helpers → exports; props typed via a `<ComponentName>Props` interface, never `React.FC`; keep each component under ~150 lines (split further if `QuizFlow` starts growing — e.g. don't inline the progress text as a separate component, just a `<p>`, but do keep option-rendering in `QuestionStep`, not inlined in `QuizFlow`).

**Testing — deliberately NOT following this same reference's testing section in full:** that file's "Testing" section asks for a `getByRole`/`getByLabelText`-driven test file per component. This project's own, more specific sources say otherwise for this ticket: the global `CLAUDE.md` ("Pure logic ... should have unit tests. One-off scripts and pure UI don't need exhaustive coverage") and this exact ticket's own sizing note in `docs/tickets/ayurvedic-skin-quiz.md` ("lighter on tests ... UI is verified by running the flow"). `frontend-component-best-practices.md` isn't one of the two files CLAUDE.md's own "On-demand context" section points to for this project (only `quiz-content.md` and `stripe-integration.md` are) — it reads as generic starter-kit boilerplate (its sibling `vertical-slice-architecture.md`/`backend-api-best-practices.md` reference a FastAPI/SQLAlchemy stack this project doesn't use). Given the more specific, more clearly project-authored sources agree with each other, this plan follows them: **no mandatory component test files for this ticket**; manual dev-server verification is the validation (see Testing Strategy). Flagged explicitly rather than silently dropped — say so if you disagree.

**Accessibility** (same reference, kept — this part is sound general practice with no conflicting project-specific guidance): use real `<button>` elements for quiz options (not clickable `<div>`s), visible focus states (Tailwind's default `focus-visible` ring is enough — don't strip it with `outline-none` unless replacing it with an equally visible one), and a `<label htmlFor>` for the email `<input>` rather than a placeholder-only label.

**`QuizAnswers.gender` gotcha (from TICKET-2's committed shape, don't redesign):** `lib/quiz/types.ts`'s `QuizAnswers` has both a top-level `gender: Gender` field **and** a `gender` entry inside `responses` (since `questions.ts`'s first question has `id: "gender"` with option ids `"female"/"male"/"other"` that are literally valid `Gender` values). Build the `QuizAnswers` passed to `scoreQuiz` as `{ gender: responses.gender as Gender, responses }` at the point of scoring — don't invent a second, separate gender-selection UI distinct from the `gender` question in `questions.ts`; there's exactly one gender question, and its answer fills both fields.

**Styling:** Tailwind v4 utility classes only, matching `app/globals.css`'s existing `@theme inline` tokens (`--color-background`, `--color-foreground`) — don't introduce CSS Modules or inline `style={}` (except genuinely dynamic values, e.g. a progress-bar width percentage).

**Landing-page copy vs. "don't invent content" (important distinction):** `.claude/references/quiz-content.md`'s "don't invent plausible Ayurvedic content" rule governs *quiz questions, dosha-scoring weights, and skin-type/package descriptions* — it does not forbid writing the landing page's own marketing copy (headline, subhead, CTA button text). Write straightforward, generic copy describing the app itself (e.g. "Discover your Ayurvedic skin type" / "Answer a few quick questions to find out what's actually right for your skin") — fine, since it's not asserting any specific dosha fact or fabricated product claim. Do not invent specific Ayurvedic claims, testimonials, or brand-voice copy mimicking the live site (savyasachiayurveda.com) — that's a design/content decision for the founder, not this ticket.

---

## IMPLEMENTATION PLAN

### Phase 1: Landing page

Independent of Phases 2-4 below — the landing page doesn't depend on the quiz flow existing, just needs a `<Link href="/quiz">` target.

**Tasks:**
- Replace `app/page.tsx`'s `create-next-app` placeholder with real landing content: headline, one-paragraph description, a prominent CTA linking to `/quiz`.

### Phase 2: Question step UI

**Tasks:**
- Build `QuestionStep`: renders a `QuizQuestion`'s `prompt` and its `options` as selectable buttons, reporting the selected `optionId` to its parent via a callback prop. Purely presentational/controlled — no state of its own beyond maybe a hover/focus style.

### Phase 3: Quiz flow state machine

**Depends on:** Phase 2 (renders `QuestionStep`)

**Tasks:**
- Build `QuizFlow`: holds `responses: Record<string, string>` and a `step` (question index, or a `"result"` sentinel) in `useState`.
- Renders the current question via `QuestionStep`, with Back/Next controls (Next only enabled once the current question has an answer in `responses`).
- On the last question's Next: build `QuizAnswers` (see the gotcha in Patterns), call `scoreQuiz(answers, questions)`, store the `ScoringResult`, and switch `step` to `"result"`.
- Show a simple progress indicator (e.g. "Question 2 of 5") derived from `step` and `questions.length` — don't add a separate component for this, it's one line of JSX.

### Phase 4: Result screen

**Depends on:** Phase 3 (needs a `ScoringResult` to render)

**Tasks:**
- Build `ResultScreen`: displays the computed `dominantDosha`/`skinType` from the `ScoringResult` prop, plus a controlled email `<input>` and a submit button.
- The submit handler is a clearly-commented **local-only stub** for now (e.g. validates the email looks well-formed, sets a local "submitted" state showing a confirmation message) — no `fetch` call. Comment it clearly as the extension point TICKET-4 will wire up.

### Phase 5: Wire the route + manual validation

**Depends on:** Phases 1-4

**Tasks:**
- Create `app/quiz/page.tsx` rendering `<QuizFlow />`.
- Run `npm run dev` and manually click through: landing page → CTA → answer every question (including using Back to change an earlier answer) → result screen shows a skin type → email input accepts text and the local submit stub shows a confirmation.

---

## STEP-BY-STEP TASKS

### UPDATE `app/page.tsx`

- **IMPLEMENT**: Replace the entire file with a landing page: a `<main>` with a headline (`<h1>`), a short descriptive paragraph, and a `<Link href="/quiz">` styled as a prominent button-like CTA (e.g. "Take the Quiz"). Remove all `create-next-app` boilerplate (Next.js/Vercel `<Image>` logos, external "Deploy Now"/"Documentation" links).
- **PATTERN**: Keep it a Server Component (no `"use client"` needed — a `<Link>` requires no client state). Reuse the existing Tailwind palette/spacing conventions from the current file if you want visual continuity (e.g. `bg-zinc-50 dark:bg-black`, centered `max-w-*` container), or simplify — either is fine, this is a fresh design.
- **IMPORTS**: `import Link from "next/link"`.
- **GOTCHA**: Don't reference `/next.svg` or `/vercel.svg` from `public/` anymore — they're template branding, irrelevant here.
- **VALIDATE**: `npm run dev` → `/` shows the new landing content, no console errors; clicking the CTA navigates to `/quiz`.
- **SATISFIES**: TICKET-3 AC — "Real landing page (`app/page.tsx`)."

### CREATE `app/quiz/_components/QuestionStep.tsx`

- **IMPLEMENT**: `"use client"` component with props `{ question: QuizQuestion; selectedOptionId: string | undefined; onSelect: (optionId: string) => void }` (typed via a `QuestionStepProps` interface). Renders `question.prompt` as a heading and `question.options` as a list of `<button>`s; the selected option gets a distinct visual state (e.g. a border/background change) and `aria-pressed={true}`.
- **PATTERN**: One component per file, PascalCase filename matching the export, `<ComponentName>Props` interface (per `.claude/references/frontend-component-best-practices.md`).
- **IMPORTS**: `import type { QuizQuestion } from "@/lib/quiz/types"`.
- **GOTCHA**: Render `question.prompt`/`option.label` verbatim — including the `[PLACEHOLDER]` prefix. Don't strip it or "clean up" the placeholder text.
- **VALIDATE**: `npx tsc --noEmit` passes; manually confirm (Phase 5) options are clickable and show a selected state.
- **SATISFIES**: TICKET-3 AC — "multi-step quiz under `app/quiz/` driven by TICKET-2's config."

### CREATE `app/quiz/_components/ResultScreen.tsx`

- **IMPLEMENT**: `"use client"` component with props `{ result: ScoringResult }` (typed via `ResultScreenProps`). Displays `result.skinType` and `result.dominantDosha` in plain factual terms (e.g. "Your skin type: dry" / "Dominant dosha: vata" — don't invent descriptive Ayurvedic copy about what that means, since that content doesn't exist yet). Below that, a `<form>` with a `<label htmlFor="email">`, a controlled `<input type="email" id="email">`, and a submit button. On submit: `event.preventDefault()`, do a basic well-formed-email check, and set local state to show a confirmation message (e.g. "Thanks! We'll be in touch."). No network call.
- **PATTERN**: Same component conventions as `QuestionStep`. Comment the submit handler clearly, e.g. `// TODO(TICKET-4): replace this local stub with a POST to /api/quiz-response`.
- **IMPORTS**: `import type { ScoringResult } from "@/lib/quiz/types"`.
- **GOTCHA**: Don't display anything about a package or price here — explicitly out of scope (TICKET-6, blocked).
- **VALIDATE**: `npx tsc --noEmit` passes; manually confirm (Phase 5) the email input accepts text and submitting shows the confirmation message without a page reload or network request (check via browser devtools Network tab if in doubt).
- **SATISFIES**: TICKET-3 AC — "a result screen showing the computed skin type ... plus an email input."

### CREATE `app/quiz/_components/QuizFlow.tsx`

- **IMPLEMENT**: `"use client"` component, no props. `const [responses, setResponses] = useState<Record<string, string>>({})`, `const [step, setStep] = useState<number | "result">(0)`, `const [result, setResult] = useState<ScoringResult | null>(null)`. Renders `questions[step]` via `QuestionStep` when `step` is a number, or `ResultScreen` when `step === "result"`. "Next" is disabled until `responses[questions[step].id]` exists; on the last question's Next, build `{ gender: responses.gender as Gender, responses }`, call `scoreQuiz(answers, questions)`, `setResult(...)`, `setStep("result")`. "Back" decrements `step` (hidden/disabled on the first question). Show `` `Question ${step + 1} of ${questions.length}` `` when `step` is a number.
- **PATTERN**: Owns all quiz state (per the architecture doc's "held in client state until complete" constraint) and passes it down — no context needed, this is a two-level tree (`QuizFlow` → `QuestionStep`/`ResultScreen`), well within the "avoid prop-drilling beyond two levels" guidance.
- **IMPORTS**: `import { useState } from "react"`; `import { questions } from "@/lib/quiz/questions"`; `import { scoreQuiz } from "@/lib/quiz/scoring"`; `import type { Gender, QuizAnswers, ScoringResult } from "@/lib/quiz/types"`; `QuestionStep`, `ResultScreen` from the sibling files.
- **GOTCHA**: Build the `QuizAnswers` object exactly as documented in Patterns (`gender` duplicated from `responses.gender`) — `scoreQuiz` throws on a malformed `responses` map, so double-check every question in `questions` has a corresponding `responses` entry before calling it (which the Next-button-disabled-until-answered logic already guarantees, if implemented correctly).
- **VALIDATE**: `npx tsc --noEmit` passes; manually confirm (Phase 5) the full click-through works, including Back navigation preserving previously-selected answers.
- **SATISFIES**: TICKET-3 AC — "client-side state across all questions"; "done when a user can complete the full question set and see their skin type."

### CREATE `app/quiz/page.tsx`

- **IMPLEMENT**: A Server Component that imports and renders `<QuizFlow />` inside a simple `<main>` wrapper (matching the landing page's container styling for visual continuity).
- **PATTERN**: Thin route-entry pattern — no logic here, matches `app/page.tsx`'s existing prop-less `function Page()` shape (no `PageProps` needed, no dynamic params).
- **IMPORTS**: `import QuizFlow from "./_components/QuizFlow"`.
- **VALIDATE**: `npm run dev` → navigating to `/quiz` renders the first question.
- **SATISFIES**: TICKET-3 AC — the `/quiz` route existing at all; enables the full click-through in Phase 5.

---

## TESTING STRATEGY

Per this ticket's own sizing note and the global `CLAUDE.md` testing philosophy (see the explicit reconciliation in Patterns above), this is a UI ticket verified by **running the flow**, not by a component test suite. No new test files are required. `lib/quiz/scoring.test.ts` (from TICKET-2) is untouched and must still pass — this ticket adds no new pure logic to `lib/`, only UI that calls the already-tested `scoreQuiz`.

### Unit Tests
None new. If a genuinely reusable pure helper emerges while building `QuizFlow` (e.g. a `buildQuizAnswers(responses, questions)` function) beyond the one-liner in Patterns, consider whether it belongs in `lib/quiz/` with its own test — but don't manufacture one just to have something to test.

### Integration Tests
None — no API routes in this ticket.

### Edge Cases (cover manually in Phase 5's walkthrough)
- Clicking Back after answering, then re-selecting a different option — the new selection should overwrite the old one in `responses`, not append.
- Trying to click Next before selecting an option on the current question — must be prevented (disabled button), not silently allowed through to `scoreQuiz` with a missing answer.
- Submitting the email form with an obviously invalid value (e.g. empty, or no `@`) — should not show the "submitted" confirmation.
- Reaching the result screen, then using the browser Back button — acceptable to lose quiz state (no persistence in this ticket); just confirm it doesn't crash (e.g. show a broken result screen with `result: null`). If `QuizFlow`'s own step returns to a question, this isn't a real concern since there's no separate `/quiz/result` route to browser-back into — the whole flow lives on one `/quiz` page.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — no lint errors (covers React/JSX rules via `eslint-config-next`).

### Level 2: Unit Tests
- `npm test` — existing `lib/quiz/scoring.test.ts` suite still passes (no regressions; this ticket doesn't touch `lib/quiz/`).

### Level 3: Integration Tests
N/A — no API routes in this ticket.

### Level 4: Manual Validation
- `npm run dev` → open `/` → confirm the new landing page renders (no leftover `create-next-app` content) → click the CTA → lands on `/quiz`.
- Answer every question in order, using Next; confirm Next is disabled until an option is selected.
- Go Back at least once mid-quiz, change the answer, go forward again — confirm the new answer sticks.
- Reach the last question, click Next → confirm the result screen renders a `skinType`/`dominantDosha` (not a crash, not "undefined").
- Type an email into the input and submit → confirm a local confirmation message appears, and (via browser devtools Network tab) confirm **no network request was made** — this ticket must not accidentally call an API that doesn't exist yet.

### Level 5: Additional Validation
N/A.

---

## ACCEPTANCE CRITERIA

- [ ] `app/page.tsx` is a real landing page (no `create-next-app` boilerplate) with a CTA linking to `/quiz`.
- [ ] `app/quiz/page.tsx` renders a multi-step quiz driven entirely by `lib/quiz/questions.ts` (no hardcoded question content in the UI layer).
- [ ] All answers are held in client state (`QuizFlow`'s `responses`) — no network calls anywhere in this ticket.
- [ ] A user can navigate Back and Next through every question, with Next disabled until the current question is answered.
- [ ] On completing the last question, `scoreQuiz` is called and its result is shown on a result screen (`skinType` and `dominantDosha` visible).
- [ ] The result screen includes an email input with a working (local-only) submit interaction, clearly marked as TICKET-4's extension point.
- [ ] No package/pricing content appears anywhere (out of scope, TICKET-6).
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm test` all pass with zero errors/regressions.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task's validation command passed
- [ ] `tsc --noEmit` and `npm run lint` both clean
- [ ] `npm test` still passes (TICKET-2's scoring tests, untouched)
- [ ] Full manual click-through completed per Level 4, including the Back/re-answer edge case and the "no network call on email submit" check
- [ ] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumption — auto-advance vs. explicit Next:** this plan uses an explicit "Next" button (disabled until answered) rather than auto-advancing on option selection. Auto-advance can feel snappier but makes "Back to fix a mistake" more jarring (the screen changes the instant you tap) and is a step-9 polish call, not a correctness one — easy to switch later if the founder tries it and prefers auto-advance.
- **Assumption — result screen has no "start over" control.** Not requested by the AC; the whole quiz lives on one `/quiz` page, so a refresh is the only current way to restart. Worth adding if user testing shows people want to redo it, but not manufacturing it speculatively now.
- **Assumption — email submit stub shows a generic confirmation, not the actual computed package/next steps** (since package content is TICKET-6, blocked). If the founder wants a different placeholder message here, it's a one-line copy change in `ResultScreen.tsx`.
- **Flagged, not blocking:** the testing-strategy reconciliation in Patterns (this plan deliberately doesn't follow `.claude/references/frontend-component-best-practices.md`'s component-test-per-file guidance, favoring the more specific project/ticket sources instead). Surface this to the user if they want that reference file's testing section followed literally in future frontend tickets.
- **Not blocking this ticket:** the PRD's broader open questions (package definition, Bolt.new integration, whether to target women specifically, ad channel choice) — none affect this ticket's scope.

## NOTES (open canvas)

**Why one `/quiz` route instead of one route per question (e.g. `/quiz/1`, `/quiz/2`):** the architecture doc is explicit that the quiz is "a client-driven, multi-step flow; each answer is held in client state until the quiz is complete" — a route-per-step design would mean either persisting partial state across navigations (contradicts the "write once, on completion" persistence model in `.claude/references/quiz-content.md`) or re-deriving it from URL params awkwardly. A single route with in-memory `step` state is simpler, matches the explicit architectural constraint, and avoids needing `loading.tsx`/dynamic-segment machinery the Next.js docs describe for route-per-step flows — none of which this content-as-config, client-only quiz needs.

**Why `QuizFlow` owns all state instead of e.g. a reducer or external state library:** the state shape is small (`responses: Record<string,string>`, a `step`, a `result`) and lives in exactly one component tree with no siblings needing it — `useState` is proportionate. A `useReducer` would be reasonable too if the number of state transitions grows during implementation (e.g. if Back/Next/Submit logic gets tangled), but isn't needed to start.

**TICKET-4 handoff point, spelled out:** `ResultScreen.tsx`'s submit handler is the *only* place TICKET-4 needs to touch to wire up real persistence — it already has the computed `ScoringResult` and the captured email in scope. TICKET-4's own plan should pass `QuizFlow`'s `responses`/computed `Gender` down to `ResultScreen` too (or have `QuizFlow` pass a `QuizAnswers` object) if the API payload needs the full answer set (`{ email, gender, answers, skinType }` per the architecture doc's `QuizResponse` shape) — currently `ResultScreen` only receives `ScoringResult`, not the raw answers, so TICKET-4 will need to widen its props. Noted here so it isn't a surprise.

**Reference-file precedence, for future frontend tickets:** this plan treats `.claude/references/frontend-component-best-practices.md` as generic/unvetted for this project (see Patterns) except where it doesn't conflict with anything more specific. If the user actually wants its testing section enforced, that's worth fixing at the CLAUDE.md level (adding it to "On-demand context") rather than re-litigating per ticket.

## AMENDMENTS

(none yet)
