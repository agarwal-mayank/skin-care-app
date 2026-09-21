# Feature: TICKET-4 — Save Quiz Response on Completion

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Add a POST endpoint (`app/api/quiz-response/route.ts`) that persists a completed quiz — email, gender, the full answer set, and the computed skin type — as a `QuizResponse` row, and wire TICKET-3's `ResultScreen` email-submit stub to call it instead of just showing a local confirmation. This is the first place real user data leaves the browser in this app, so validation and "fail loudly on a DB write failure" both matter more here than in TICKET-3.

## User Story

As a visitor who just completed the quiz
I want my email and computed skin type to actually be saved when I submit
So that the founder can follow up with me later (and, eventually, so the app can email me my result and offer to sell me something)

## Problem Statement

TICKET-3 built the full quiz UX end to end, but `ResultScreen`'s submit handler is a local-only stub (`// TODO(TICKET-4)`) — nothing is ever written to the database. `QuizResponse` exists in `prisma/schema.prisma` (from TICKET-1) but nothing writes to it yet. Until this ticket, every completed quiz is thrown away the moment the tab closes.

## Solution Statement

Add `app/api/quiz-response/route.ts`, a `POST` Route Handler that validates an incoming `{ email, gender, answers, skinType }` JSON body and writes it to `QuizResponse` via the existing `db` singleton (`lib/db.ts`). Validation is a small pure function in a sibling file so it can be unit-tested without touching Prisma. Widen `QuizFlow` → `ResultScreen`'s props so `ResultScreen` has the full answer set and gender (not just the `ScoringResult`), and replace its stub `setSubmitted(true)` with a real `fetch("/api/quiz-response", ...)` call that shows a visible error on failure instead of silently pretending to succeed.

## Out of Scope / Non-Goals

- Not included: sending the result email — that's TICKET-5, which depends on this ticket's save succeeding.
- Not included: Stripe/checkout/`Order` — TICKET-6/7, blocked on the founder's package-definition answer.
- Not included: any new Prisma migration — `QuizResponse` already exists (TICKET-1); this ticket only writes to it, no schema changes.
- Not included: rate limiting, spam protection, or CAPTCHA on this public endpoint — hobby scale, no auth in v1 (see Open Questions).
- Not included: retry queues or offline support for a failed save — on failure, the user sees an error and can click Submit again; no background retry mechanism.
- Not changing: `lib/quiz/types.ts`, `lib/quiz/questions.ts`, `lib/quiz/scoring.ts`, `prisma/schema.prisma`, `QuestionStep.tsx` — this ticket only adds `app/api/quiz-response/*` and edits `QuizFlow.tsx`/`ResultScreen.tsx`'s props and submit handler.

## Feature Metadata

**Feature Type**: New Capability (API + persistence)
**Estimated Complexity**: Low–Medium (one new route, one pure validation helper, a props change to already-working components)
**Primary Systems Affected**: `app/api/quiz-response/*` (new), `app/quiz/_components/QuizFlow.tsx` and `ResultScreen.tsx` (props + submit handler)
**Dependencies**: None new — uses `lib/db.ts` (TICKET-1), `lib/quiz/types.ts` (TICKET-2), and `ResultScreen`/`QuizFlow` (TICKET-3)

## Related Work

**Implements**: TICKET-4 in `docs/tickets/ayurvedic-skin-quiz.md` (lines 34-39) · **Epic**: `ayurvedic-skin-quiz.architecture.md`

**Back-references** (plans this builds on or inherits decisions from):

- `.claude/plans/ticket-3-quiz-flow-ui.md` — Why: this ticket's own "NOTES" section already spells out the handoff point — `ResultScreen.tsx`'s submit handler is the only place TICKET-4 needs to touch, and its props need widening beyond just `ScoringResult` to carry the full answer set.
- `.claude/plans/ticket-1-project-scaffold.md` — Why: `QuizResponse` model shape and `lib/db.ts` singleton this ticket writes through, unchanged.
- `.claude/plans/ticket-2-quiz-content-scoring.md` — Why: `Gender`/`SkinType`/`QuizAnswers` types this ticket's payload validation is checked against.

**Forward-references** (plans that extend or supersede this — append as follow-ups get created):

- TICKET-5 (result email) depends on this ticket's save succeeding — it will send an email after a successful `POST /api/quiz-response`, likely triggered from inside this same route handler once `lib/resend.ts` exists.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `prisma/schema.prisma` (all 24 lines) — the `QuizResponse` model this ticket writes to: `id` (cuid, auto), `email` (String), `gender` (String), `answers` (Json), `skinType` (String), `createdAt` (auto). No migration needed — this model already exists and is migrated (a `prisma/migrations/` directory is already present).
- `lib/db.ts` (all 9 lines) — the Prisma client singleton to import as `db`; don't instantiate a second `PrismaClient`.
- `lib/quiz/types.ts` (all 28 lines) — `Gender` (`"female" | "male" | "other"`), `SkinType` (`"dry" | "sensitive" | "oily"`), `QuizAnswers`. Validate the incoming payload's `gender`/`skinType` against these exact literal unions.
- `node_modules/.prisma/client/index.d.ts` (search `QuizResponseCreateInput`, ~line 2047) — the generated Prisma input type: `{ id?, email: string, gender: string, answers: JsonNullValueInput | InputJsonValue, skinType: string, createdAt? }`. **Per `CLAUDE.md`'s "Types" ground rule, use this generated type directly — don't hand-write a parallel `QuizResponsePayload` interface duplicating its shape.**
- `app/quiz/_components/QuizFlow.tsx` (all ~73 lines) — owns `responses: Record<string, string>` (persists after `step` becomes `"result"` — never cleared) and `result: ScoringResult | null`. Currently renders `<ResultScreen result={result} />` with no other props; this ticket widens that call.
- `app/quiz/_components/ResultScreen.tsx` (all ~66 lines) — the stub to replace. Note its existing `EMAIL_PATTERN` regex and `error`/`submitted` state shape — mirror that style for the new network-error state rather than inventing a different pattern.
- `.claude/references/quiz-content.md` (all 5 lines) — confirms `QuizResponse` is written **once, on completion**, never incrementally; this ticket's single `POST` on submit is exactly that, don't add any earlier/partial write.
- `CLAUDE.md` ("Ground rules" → Types, Secrets; "Working principles" → "Fail loudly, never swallow") — the two rules this ticket must satisfy precisely (see Patterns below).
- `docs/tickets/ayurvedic-skin-quiz.md` (lines 34-39) — TICKET-4's exact scope/AC, including "a failed save throws/logs visibly rather than being swallowed."

### New Files to Create

- `app/api/quiz-response/route.ts` — `POST` Route Handler; parses + validates the body, writes to `QuizResponse` via `db`, returns the created row's `id`.
- `app/api/quiz-response/validate.ts` — pure `parseQuizResponsePayload(body: unknown): Prisma.QuizResponseCreateInput` — throws a descriptive `Error` on any invalid field; no imports beyond `@prisma/client` (for the `Prisma` namespace/type) and `@/lib/quiz/types`.
- `app/api/quiz-response/validate.test.ts` — unit tests for `parseQuizResponsePayload` covering every rejection path.

### Files to Update

- `app/quiz/_components/QuizFlow.tsx` — pass `gender` and `answers` (the full `responses` map) down to `ResultScreen`, not just `result`.
- `app/quiz/_components/ResultScreen.tsx` — widen `ResultScreenProps`; replace the local-only stub with a real `fetch("/api/quiz-response", ...)` call; add a submitting/error state for the network path (distinct from the existing client-side "invalid email format" error).

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Next.js — Route Handlers](node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md) — confirms `app/api/quiz-response/route.ts` with an exported `async function POST(request: Request)` is all that's needed; Route Handlers use the Web `Request`/`Response` APIs directly (`Response.json(...)` is fine, no `NextResponse` required for this simple a case); only `route.ts` is a routable filename inside `app/api/quiz-response/` — `validate.ts` beside it is automatically non-routable, no `_` prefix needed (unlike TICKET-3's `_components`, which held page-rendering components under a page route).
- **Note on the CLAUDE.md "This is NOT the Next.js you know" instruction**: this ticket is the first to add a Route Handler. The doc above was read for this plan; the one relevant behavior change from older mental models is that Route Handlers are **not cached by default** for non-`GET` methods (irrelevant here since this is `POST`), and there's no `NextApiRequest`/`NextApiResponse` (Pages Router) pattern to reach for — use the Web-standard `Request`/`Response` as shown above.

### Patterns to Follow

**Fail loudly, never swallow (`CLAUDE.md`):** validation errors (bad shape/missing field) are the *only* thing this route catches — they become a `400` with a descriptive message, since that's a client mistake, not a system failure. The `db.quizResponse.create(...)` call itself is **never wrapped in try/catch** — let a Prisma/DB error propagate and let Next's own Route Handler error handling log it and return a `500`. Don't add a catch-all `try { ... } catch { return Response.json({error: "failed"}) }` around the whole handler — that's exactly the "silently swallowed failed write" CLAUDE.md warns against.

**Types (`CLAUDE.md`):** `parseQuizResponsePayload` returns `Prisma.QuizResponseCreateInput` (imported from `@prisma/client`), not a hand-written interface — this *is* "importing the type from Prisma's generated client," satisfying the ground rule literally.

**Client-side error style (mirror `ResultScreen.tsx`'s existing pattern):** the existing `error: string | null` state + conditional `<p className="text-sm text-red-600 ...">` rendering is the established pattern for showing a validation problem — reuse the same state variable and styling for a network/save failure, don't introduce a second error-display mechanism (e.g. a toast library) for one message.

**Naming — `answers` vs. `responses` (don't get this backwards):** `QuizFlow`'s internal state variable is named `responses` (per TICKET-3 and the architecture doc's scoring-time naming), but the wire format / `QuizResponse.answers` column / API payload field is named `answers` (per the architecture doc's `{email, gender, answers, skinType}` shape and TICKET-4's own AC text). `QuizFlow` passes its `responses` state as a prop named `answers` to `ResultScreen`; `ResultScreen` sends it in the fetch body as `answers`. Don't rename `QuizFlow`'s internal `responses` state — only the prop/wire name changes.

**Server-only secrets (`CLAUDE.md`):** this route only touches `DATABASE_URL`/`DIRECT_URL` (already server-only via `lib/db.ts`, unchanged) — no new secrets are introduced by this ticket.

---

## IMPLEMENTATION PLAN

### Phase 1: Payload validation (pure, testable)

Independent of Phase 2 — `validate.ts` has no dependency on the route handler or the DB.

**Tasks:**
- Build `parseQuizResponsePayload`: validates `email` (regex, mirroring `ResultScreen.tsx`'s existing `EMAIL_PATTERN`), `gender` (must be exactly `"female" | "male" | "other"`), `skinType` (must be exactly `"dry" | "sensitive" | "oily"`), `answers` (must be a non-empty plain object whose every value is a string). Throws a descriptive `Error` naming the offending field on any failure.

### Phase 2: Route handler

**Depends on:** Phase 1 (imports `parseQuizResponsePayload`)

**Tasks:**
- Build `app/api/quiz-response/route.ts`: parse JSON body → `400` on unparseable JSON or on a validation error from Phase 1 → `db.quizResponse.create({ data: payload })` (uncaught) → `201` with the created row's `id`.

### Phase 3: Wire `QuizFlow` → `ResultScreen`

**Independent of** Phases 1-2 (a prop-plumbing change; only needs to land before Phase 4 can call the real endpoint end-to-end).

**Tasks:**
- Widen `ResultScreenProps` to `{ result: ScoringResult; gender: Gender; answers: Record<string, string> }`.
- Update `QuizFlow.tsx`'s render to pass `gender={responses.gender as Gender}` and `answers={responses}` alongside `result={result}`.

### Phase 4: Real submit handler

**Depends on:** Phase 2 (endpoint must exist) and Phase 3 (props must be available)

**Tasks:**
- Replace `ResultScreen.tsx`'s stub `setSubmitted(true)` with an async handler: on client-side email-format failure, behave exactly as before (existing `error` state, no network call); otherwise `fetch("/api/quiz-response", { method: "POST", ... })` with `{ email, gender, answers, skinType: result.skinType }`; on a non-OK response or thrown error, `console.error` the real error and set the existing `error` state to a user-facing message (e.g. "Something went wrong saving your result. Please try again."); on success, `setSubmitted(true)` as before. Add an `isSubmitting` state to disable the Submit button and show "Submitting…" while the request is in flight.

### Phase 5: Manual end-to-end validation

**Depends on:** Phases 1-4

**Tasks:**
- Run `npm run dev`, complete the quiz, submit a valid email, and confirm a new row appears via `npx prisma studio` with the correct `email`/`gender`/`answers`/`skinType`.
- Confirm an invalid email still shows the existing client-side error with no network request (unchanged TICKET-3 behavior).
- Confirm a deliberately broken `DATABASE_URL` (temporarily, in a throwaway local edit — revert after) makes the save fail loudly: the terminal running `next dev` logs the Prisma error, the browser shows the new failure message, and no fake "Thanks!" confirmation appears.

---

## STEP-BY-STEP TASKS

### CREATE `app/api/quiz-response/validate.ts`

- **IMPLEMENT**: `export function parseQuizResponsePayload(body: unknown): Prisma.QuizResponseCreateInput`. Guard `body` is a non-null, non-array object. Destructure `email`, `gender`, `answers`, `skinType` as `unknown`. Validate each: `email` — `typeof === "string"` and matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; `gender` — `typeof === "string"` and is one of `["female", "male", "other"]`; `skinType` — `typeof === "string"` and is one of `["dry", "sensitive", "oily"]`; `answers` — `typeof === "object"`, non-null, not an array, `Object.keys(answers).length > 0`, and every value in it is a `string`. Throw `new Error("<field> ...")` with a specific, distinct message per failing field (needed for the unit tests to assert on which validation fired). Return `{ email, gender, answers, skinType }` typed as `Prisma.QuizResponseCreateInput`.
- **PATTERN**: Mirror `ResultScreen.tsx`'s existing `EMAIL_PATTERN` regex exactly (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) so client and server agree on what "valid email" means.
- **IMPORTS**: `import { Prisma } from "@prisma/client"`; `import type { Gender, SkinType } from "@/lib/quiz/types"` (for the literal-union arrays, e.g. `const VALID_GENDERS: Gender[] = ["female", "male", "other"]`).
- **GOTCHA**: Don't import `@/lib/db` here — this file must stay import-light and DB-free so its unit tests never touch Prisma's runtime/connection.
- **VALIDATE**: `npx tsc --noEmit` passes.
- **SATISFIES**: TICKET-4 AC — request validation exists before any DB write is attempted.

### CREATE `app/api/quiz-response/validate.test.ts`

- **IMPLEMENT**: `describe("parseQuizResponsePayload")` with cases: (1) a fully valid payload returns the expected object unchanged; (2) missing/non-string `email` throws; (3) malformed `email` (no `@`, e.g. `"foo"`) throws; (4) `gender` outside the three valid values (e.g. `"nonbinary"` or `123`) throws; (5) `skinType` outside the three valid values throws; (6) `answers` missing / not an object / an array / `{}` (empty) throws; (7) `answers` with a non-string value (e.g. `{ q1: 5 }`) throws; (8) `body` itself is `null`/a string/an array throws.
- **PATTERN**: `describe`/`it`/`expect` from `vitest`, matching `lib/quiz/scoring.test.ts`'s style; use `expect(() => parseQuizResponsePayload(badInput)).toThrow()` (optionally `.toThrow(/gender/i)` etc. where asserting *which* field failed adds value).
- **IMPORTS**: `import { describe, expect, it } from "vitest"`; `import { parseQuizResponsePayload } from "./validate"`.
- **VALIDATE**: `npm test` — all new cases pass.
- **SATISFIES**: TICKET-4 AC — validation is unit-tested (pure logic, per `CLAUDE.md`'s testing rule).

### CREATE `app/api/quiz-response/route.ts`

- **IMPLEMENT**: `export async function POST(request: Request)`. `const body = await request.json().catch(() => null); if (body === null) return Response.json({ error: "Invalid JSON body" }, { status: 400 });`. Then `let data: Prisma.QuizResponseCreateInput; try { data = parseQuizResponsePayload(body); } catch (error) { const message = error instanceof Error ? error.message : "Invalid request body"; return Response.json({ error: message }, { status: 400 }); }`. Then, **outside any try/catch**: `const quizResponse = await db.quizResponse.create({ data }); return Response.json({ id: quizResponse.id }, { status: 201 });`.
- **PATTERN**: Route Handler using plain `Request`/`Response.json` per the Next.js docs read above — no `NextRequest`/`NextResponse` needed for this simple case.
- **IMPORTS**: `import { db } from "@/lib/db"`; `import type { Prisma } from "@prisma/client"`; `import { parseQuizResponsePayload } from "./validate"`.
- **GOTCHA**: The `db.quizResponse.create` call must NOT be inside the same (or any) try/catch — see "Fail loudly" in Patterns. If a future edit adds error handling here, it must re-throw or log, never return a fabricated success response.
- **VALIDATE**: `npx tsc --noEmit` passes; manually (Phase 5) `POST` a valid body via the browser flow and confirm a `201` + a real row.
- **SATISFIES**: TICKET-4 AC — "POST endpoint that persists `{email, gender, answers, skinType}` to `QuizResponse`."

### UPDATE `app/quiz/_components/ResultScreen.tsx`

- **IMPLEMENT**: Widen props to `interface ResultScreenProps { result: ScoringResult; gender: Gender; answers: Record<string, string>; }`. Add `const [isSubmitting, setIsSubmitting] = useState(false);`. Rewrite `handleSubmit` to be `async`: keep the existing email-regex check and early return unchanged; on passing, `setError(null); setIsSubmitting(true);` then `try { const response = await fetch("/api/quiz-response", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, gender, answers, skinType: result.skinType }) }); if (!response.ok) { const errorBody = await response.json().catch(() => null); throw new Error(errorBody?.error ?? \`Request failed with status ${response.status}\`); } setSubmitted(true); } catch (err) { console.error("Failed to save quiz response:", err); setError("Something went wrong saving your result. Please try again."); } finally { setIsSubmitting(false); }`. Update the submit `<button>` to `disabled={isSubmitting}` and show `{isSubmitting ? "Submitting…" : "Submit"}`.
- **PATTERN**: Reuse the existing `error`/`<p className="text-sm text-red-600 ...">` rendering for the new failure path — don't add a second error UI element.
- **IMPORTS**: Add `import type { Gender } from "@/lib/quiz/types"` (alongside the existing `ScoringResult` import).
- **GOTCHA**: Don't remove the `// TODO(TICKET-4)` comment by leaving stale text — replace it with the real call; don't leave a dangling comment referencing a still-future ticket.
- **VALIDATE**: `npx tsc --noEmit` passes; manually (Phase 5) confirm submit shows "Submitting…" briefly, then either the confirmation or a visible error.
- **SATISFIES**: TICKET-4 AC — "a failed save throws/logs visibly rather than being swallowed"; "completing the quiz in the browser produces a real row."

### UPDATE `app/quiz/_components/QuizFlow.tsx`

- **IMPLEMENT**: Change `return result ? <ResultScreen result={result} /> : null;` to `return result ? <ResultScreen result={result} gender={responses.gender as Gender} answers={responses} /> : null;`.
- **PATTERN**: `Gender` is already imported in this file (used to build `QuizAnswers` for `scoreQuiz`) — no new import needed.
- **GOTCHA**: `responses` is the same state object already used to compute `result` — don't create a second copy or re-derive it; it's still in scope and unchanged at the point `step === "result"`.
- **VALIDATE**: `npx tsc --noEmit` passes.
- **SATISFIES**: TICKET-4 AC — enables `ResultScreen` to send the full `{email, gender, answers, skinType}` payload.

---

## TESTING STRATEGY

Per `CLAUDE.md`'s testing rule ("Pure logic ... should have unit tests"), `parseQuizResponsePayload` gets full unit coverage since it's pure validation logic. The route handler itself (I/O: parses a request, calls Prisma) and the `ResultScreen`/`QuizFlow` wiring (UI) are verified manually per Level 4, consistent with how TICKET-3 verified its UI — this ticket doesn't introduce a component-test suite or a test-database/integration-test harness, which would be disproportionate at this project's hobby scale.

### Unit Tests
`app/api/quiz-response/validate.test.ts` — see the CREATE task above for the full case list.

### Integration Tests
None automated (no test-DB harness in this project). The manual Phase 5 walkthrough (`npm run dev` → complete quiz → submit → confirm the row via `npx prisma studio`) is this ticket's real integration check, matching how TICKET-4's own AC in `docs/tickets/ayurvedic-skin-quiz.md` describes "done."

### Edge Cases (cover manually in Phase 5, plus the equivalent unit-test cases in Phase 1)
- Submitting with `answers` missing the `gender` question's entry (shouldn't happen given `QuizFlow`'s Next-disabled-until-answered gating, but `parseQuizResponsePayload` should still reject an empty/malformed `answers` defensively rather than trust the caller).
- A slow/failed network request — confirm the button shows "Submitting…" and doesn't allow a second concurrent submit (the `disabled={isSubmitting}` guard).
- A deliberately broken `DATABASE_URL` (temporary local-only test) — confirm the failure is visible in both the server log and the browser, not swallowed into a fake success.
- Re-submitting after a failed attempt (e.g. after temporarily fixing `DATABASE_URL`) — confirm a second click retries successfully; no leftover disabled/broken state.

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — no lint errors.

### Level 2: Unit Tests
- `npm test` — `lib/quiz/scoring.test.ts` (unchanged, TICKET-2) and the new `app/api/quiz-response/validate.test.ts` both pass.

### Level 3: Integration Tests
N/A — no test-DB harness; see manual validation below.

### Level 4: Manual Validation
- `npm run dev` → complete the full quiz → submit a valid email → confirm the confirmation message appears → open `npx prisma studio` and confirm a new `QuizResponse` row with the correct `email`, `gender`, `answers` (JSON matching every question id → selected option id), and `skinType`.
- Submit an invalid email → confirm the existing client-side error still fires with **no network request** (check via browser devtools Network tab) — this must be unchanged from TICKET-3.
- Temporarily break `DATABASE_URL` in `.env`, restart `next dev`, repeat a valid submission → confirm the terminal logs a clear Prisma error and the browser shows the new failure message (not a fake "Thanks!") → revert `.env` and confirm it works again.

### Level 5: Additional Validation
N/A.

---

## ACCEPTANCE CRITERIA

- [ ] `app/api/quiz-response/route.ts` accepts `POST` requests and persists `{email, gender, answers, skinType}` to `QuizResponse`.
- [ ] Invalid request bodies (bad email/gender/skinType/answers shape) are rejected with a `400` and a descriptive error, before any DB write is attempted.
- [ ] A DB write failure is never silently caught — it propagates and is visibly logged, per `CLAUDE.md`'s "Fail loudly" rule.
- [ ] `ResultScreen.tsx`'s submit handler makes a real `fetch` call instead of the TICKET-3 local-only stub.
- [ ] Completing the quiz in the browser and submitting a valid email produces a real `QuizResponse` row, confirmed via `npx prisma studio`.
- [ ] The existing TICKET-3 client-side email-format validation (no network call for an obviously invalid email) still works unchanged.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm test` all pass with zero errors/regressions.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task's validation command passed
- [ ] `tsc --noEmit` and `npm run lint` both clean
- [ ] `npm test` passes (TICKET-2's scoring tests + this ticket's new validation tests)
- [ ] Full manual walkthrough completed per Level 4, including the deliberate `DATABASE_URL`-break check
- [ ] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumption — no rate limiting/spam protection.** This is a public, unauthenticated `POST` endpoint (per the PRD's "no auth" non-goal). At hobby scale this is acceptable; worth revisiting only once real ad traffic is live and abuse is observed, not speculatively now.
- **Assumption — `answers` stores the full `responses` map, including the `gender` question's own entry** (i.e. the same object passed to `scoreQuiz`), even though `gender` is *also* stored as its own top-level column. This duplication mirrors the existing `QuizAnswers.gender`-duplication gotcha from TICKET-2/3 and matches the architecture doc's stated `QuizResponse.answers` = "the full set of question→answer pairs."
- **Assumption — no retry/queue for a failed save.** A failed submit shows an error and lets the user click Submit again manually; no exponential backoff or offline queue. Proportionate for a hobby-scale v1; flag if real users report silent data loss after this ships.
- **Not blocking this ticket:** TICKET-5's email-sending is a natural next step after a successful save but is explicitly out of scope here — don't add a Resend call speculatively.

## NOTES (open canvas)

**Why validation lives in a separate `validate.ts` instead of inline in `route.ts`:** the global `CLAUDE.md` testing philosophy asks for unit tests on pure logic. A Route Handler file that imports `lib/db.ts` triggers Prisma client construction on module load; keeping the pure validation function in its own file with zero Prisma import means its test file never touches Prisma at all — faster, more isolated tests, and it makes the "pure logic vs. I/O" boundary the CLAUDE.md testing rule cares about literally visible as a file boundary.

**Why the DB write is never wrapped in try/catch:** this is the plan's single most load-bearing design choice, directly implementing `CLAUDE.md`'s "a failed webhook, DB write, or email send should throw or log clearly, not be silently caught... a 'successful' checkout that silently didn't record is worse than a visible error." Next.js's own Route Handler error boundary already logs an uncaught throw and returns a 500 — reaching for a try/catch here would be *adding* a swallow point, not removing a gap.

**Why `Prisma.QuizResponseCreateInput` instead of a hand-written type:** directly satisfies `CLAUDE.md`'s explicit "never hand-write parallel interfaces for these models" rule — this is the one place in the codebase so far where that rule bites (TICKET-1/2/3 never constructed a `QuizResponse` value).

## AMENDMENTS

(none yet)
