# Feature: TICKET-5 — Result Email

The following plan should be complete, but it's important to validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Add `lib/resend.ts` (a server-only Resend client, following the `lib/db.ts` singleton pattern already established) and a small email module that sends the visitor a summary of their computed skin type immediately after their `QuizResponse` is saved. The email is deliberately skin-type-only — no priced package, no "Buy Now" — since the package/pricing question (TICKET-6) is still blocked on the founder.

## User Story

As a visitor who just completed the quiz
I want to receive an email confirming my computed skin type
So that I have a record of my result even after I close the tab, and the founder's brand stays in my inbox for a future follow-up

## Problem Statement

TICKET-4 persists a completed quiz to `QuizResponse`, but nothing is sent back to the visitor — the only feedback they get is the on-screen "Thanks! We'll be in touch." confirmation, which disappears the moment they navigate away. There's no `lib/resend.ts` yet, and `RESEND_API_KEY` isn't wired into `.env`/`.env.example`.

## Solution Statement

Add `lib/resend.ts` (Resend client singleton, mirroring `lib/db.ts`), a pure email-content builder (`lib/email/quizResultEmail.ts`, unit-tested per one case per `SkinType`), and `lib/email/sendQuizResultEmail.ts` (the I/O wrapper that calls `resend.emails.send(...)`). Wire it into `app/api/quiz-response/route.ts`: after `db.quizResponse.create(...)` succeeds, call `sendQuizResultEmail({ to: quizResponse.email, skinType: quizResponse.skinType as SkinType })` before returning the `201`.

**Email-failure behavior (confirmed with the user before writing this plan):** unlike the DB write (never caught, lets Next.js's error boundary fail the whole request per TICKET-4's precedent), an email-send failure must **not** fail the request. `sendQuizResultEmail` itself catches any thrown error *and* checks the SDK's returned `{ error }` field, `console.error`s the full detail either way, and returns normally. The `QuizResponse` row is the record of the lead; losing it to a retry-after-email-failure (which would insert a duplicate row, since there's no upsert/idempotency) is worse than a lead who occasionally doesn't get the email. `route.ts` calls `sendQuizResultEmail` with no try/catch of its own — the function's contract is "never throws."

## Out of Scope / Non-Goals

- Not included: any package/pricing content in the email — TICKET-6 (package definition) is still blocked; the email is skin-type-only per this ticket's explicit AC.
- Not included: a payment-confirmation email (post-Stripe-webhook) — that's TICKET-7, blocked with TICKET-6.
- Not included: a React Email / `@react-email/components` template — plain HTML + text strings are proportionate for one factual email at this scale; don't add a templating dependency for this.
- Not included: retry queues, delivery-status tracking, or a `sentAt`/email-log column on `QuizResponse` — a failed send is logged server-side and the flow moves on; no persistence of send state.
- Not included: real Ayurvedic/dosha descriptive copy about what each skin type *means* — per `.claude/references/quiz-content.md`'s explicit rule, don't invent placeholder Ayurvedic content. The email states the computed skin type as a fact; it doesn't editorialize.
- Not changing: `app/quiz/_components/ResultScreen.tsx`'s UI/copy (still shows "Thanks! We'll be in touch.") — this ticket is server-side only; no new on-screen "check your email" messaging is required by the AC (flagged as an open question below in case the founder wants it).
- Not changing: `prisma/schema.prisma`, `lib/quiz/*`, `app/api/quiz-response/validate.ts` — this ticket only adds `lib/resend.ts` + `lib/email/*` and edits `app/api/quiz-response/route.ts` + `.env.example`.

## Feature Metadata

**Feature Type**: New Capability (third-party integration)
**Estimated Complexity**: Low–Medium (one new server-only client, one pure template function, one I/O wrapper, a two-line addition to an existing route)
**Primary Systems Affected**: `lib/resend.ts` (new), `lib/email/*` (new), `app/api/quiz-response/route.ts` (edit), `.env.example` (edit), `package.json` (new dependency)
**Dependencies**: `resend` npm package (not yet installed); a `RESEND_API_KEY` in `.env` (not yet present — the founder needs a Resend account per the architecture doc's "Missing pieces")

## Related Work

**Implements**: TICKET-5 in `docs/tickets/ayurvedic-skin-quiz.md` (lines 41-46) · **Epic**: `ayurvedic-skin-quiz.architecture.md`

**Back-references** (plans this builds on or inherits decisions from):

- `.claude/plans/ticket-4-save-quiz-response.md` — Why: this ticket's own forward-reference already named the shape ("send an email after a successful `POST /api/quiz-response`, likely triggered from inside this same route handler once `lib/resend.ts` exists") and established the "pure logic in its own file, unit-tested; I/O uncaught in the route" split this plan mirrors for the email template vs. send call.
- `.claude/plans/ticket-1-project-scaffold.md` — Why: `lib/db.ts`'s singleton-client pattern is the template `lib/resend.ts` follows (minus Prisma's dev-hot-reload caching, which doesn't apply to a stateless HTTP client).
- `.claude/plans/ticket-2-quiz-content-scoring.md` — Why: `SkinType` union (`"dry" | "sensitive" | "oily"`) this ticket's email content is keyed on.

**Forward-references** (plans that extend or supersede this — append as follow-ups get created):

- TICKET-6 (package definition) will likely extend the email's content once package/pricing is defined — don't build a "content sections" abstraction now in anticipation of that; TICKET-6 can edit `lib/email/quizResultEmail.ts` directly when it lands.
- TICKET-7 (Stripe) will add a second, distinct payment-confirmation email — expected to be a sibling file in `lib/email/`, not a reuse of `quizResultEmail.ts`.

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `lib/db.ts` (all 9 lines) — the client-singleton pattern to mirror for `lib/resend.ts`. Note: Prisma's `globalForPrisma`/dev-hot-reload caching exists specifically to avoid exhausting DB connections across Next.js's dev-mode module reloads — a `Resend` instance is a stateless HTTP wrapper with no connection pool, so `lib/resend.ts` does **not** need that caching trick; a plain top-level `export const resend = new Resend(...)` is correct and sufficient.
- `app/api/quiz-response/route.ts` (all 24 lines) — the exact insertion point: after `const quizResponse = await db.quizResponse.create({ data });` and before `return Response.json(...)`. `quizResponse.email` and `quizResponse.skinType` are the fields to pass through (note `skinType` comes back from Prisma typed as `string`, not `SkinType` — see GOTCHA below).
- `app/api/quiz-response/validate.ts` (all 44 lines) — confirms `skinType` was already validated against `VALID_SKIN_TYPES` before the DB write; by the time `route.ts` calls `sendQuizResultEmail`, `quizResponse.skinType` is guaranteed to be one of the three valid literal values, which is what justifies the `as SkinType` cast (same cast style `QuizFlow.tsx` already uses for `gender`).
- `lib/quiz/types.ts` (all 28 lines) — `SkinType = "dry" | "sensitive" | "oily"`, the type the email content is keyed on.
- `prisma/schema.prisma` (all ~24 lines) — confirms `QuizResponse.skinType` and `.email` are plain `String` columns (no DB-level enum), consistent with the cast note above.
- `CLAUDE.md` ("Ground rules › Secrets", "Working principles › Fail loudly, never swallow") — `RESEND_API_KEY` is the server-only secret this ticket introduces; "email send" is explicitly named in the fail-loudly rule as something that "should throw or log clearly, not be silently caught" — this plan's chosen behavior (log clearly, don't throw) is one of the rule's two explicitly sanctioned options, not a deviation from it.
- `ayurvedic-skin-quiz.architecture.md` (lines 27-32, "Boundaries & contracts › Resend") — "server-only API key; the app sends the package summary email after quiz completion" (package summary deferred to TICKET-6 per this ticket's AC — see Out of Scope) — and the secrets inventory listing `RESEND_API_KEY`.
- `.claude/references/quiz-content.md` (all lines) — the "don't invent placeholder Ayurvedic content" rule that bounds the email's copy to factual skin-type statements only.
- `.env.example` (2 lines) — current contents (`DATABASE_URL`, `DIRECT_URL` only); this ticket adds a `RESEND_API_KEY` placeholder line.
- `app/api/quiz-response/validate.test.ts` and `lib/quiz/scoring.test.ts` — the existing `describe`/`it`/`expect` (`vitest`) style to mirror for the new `lib/email/quizResultEmail.test.ts`.

### New Files to Create

- `lib/resend.ts` — server-only `Resend` client singleton, constructed from `process.env.RESEND_API_KEY`.
- `lib/email/quizResultEmail.ts` — pure function `buildQuizResultEmail(skinType: SkinType): { subject: string; html: string; text: string }`. No Resend import, no I/O — the "email template" the ticket's AC calls for.
- `lib/email/quizResultEmail.test.ts` — unit tests: one case per `SkinType` value, asserting the correct skin type appears in `subject`/`html`/`text`.
- `lib/email/sendQuizResultEmail.ts` — `export async function sendQuizResultEmail({ to, skinType }: { to: string; skinType: SkinType }): Promise<void>`. Imports `resend` from `@/lib/resend` and `buildQuizResultEmail` from `./quizResultEmail`; wraps the `resend.emails.send(...)` call so this function **never throws** — see Patterns below.

### Files to Update

- `app/api/quiz-response/route.ts` — after the DB write succeeds, `await sendQuizResultEmail({ to: quizResponse.email, skinType: quizResponse.skinType as SkinType })`, uncaught (the function's own contract guarantees it won't throw), before returning `201`.
- `.env.example` — add `RESEND_API_KEY="re_..."` (placeholder, matching the existing placeholder style for `DATABASE_URL`/`DIRECT_URL`).
- `package.json` — add `"resend": "^6.28.1"` to `dependencies` (latest as of this plan; pin per the global CLAUDE.md's "pin dependency versions" rule — don't use an unpinned `"latest"` or bare `*`).

### Relevant Documentation — READ BEFORE IMPLEMENTING

- [Resend — Send with Next.js](https://resend.com/docs/send-with-nextjs) — confirms the exact shape: `import { Resend } from "resend"; const resend = new Resend(process.env.RESEND_API_KEY);` then `const { data, error } = await resend.emails.send({ from, to, subject, html })`. The SDK returns `{ data, error }` rather than throwing on a *handled* API failure (e.g. invalid recipient, missing domain verification) — but the docs' own example still wraps the whole call in `try/catch`, implying unhandled failures (network errors, etc.) *can* still throw. `sendQuizResultEmail` must guard both paths (see Patterns).
- **Resend sending-domain restriction (verify directly against your Resend dashboard before Phase 5 manual validation — not fully confirmed from docs during planning):** the architecture doc says Resend's default sending domain (`onboarding@resend.dev`) is "fine to start." In practice, Resend's shared sandbox address is commonly restricted to delivering only to the account's own registered/verified email until a custom domain is verified — if manual testing with an arbitrary quiz-taker email silently doesn't arrive, check the Resend dashboard's Logs/Emails tab for a rejection reason before assuming the code is broken, and test with the Resend account owner's own email address first.
- **Note on the CLAUDE.md "This is NOT the Next.js you know" instruction**: no new Next.js API surface is used here (no new route, no new Next.js concept) — `lib/resend.ts` and `lib/email/*` are plain TypeScript modules with no Next.js-specific imports. The one touchpoint, `route.ts`, was already read for TICKET-4's plan; nothing about Route Handlers changes for this ticket.

### Patterns to Follow

**Fail loudly — but this is the codebase's first "log clearly" (not "throw") implementation of that rule:** TICKET-4 established "never catch the DB write, let it throw." This ticket's confirmed design is the *other* sanctioned half of CLAUDE.md's rule ("...should throw **or** log clearly, not be silently caught"): `sendQuizResultEmail` wraps `resend.emails.send(...)` in `try/catch`, and *also* checks the returned `{ error }` field (since the SDK returns rather than throws for many failure modes) — either path does `console.error("Failed to send quiz result email:", <the error>)` with enough detail to debug from server logs, then returns normally. **Do not let a caught error re-throw, and do not wrap the `sendQuizResultEmail(...)` call in `route.ts` in its own try/catch** — the "never throws" contract belongs entirely inside `sendQuizResultEmail`, so `route.ts` stays a plain `await` with no error-handling noise, exactly as thin as TICKET-4's handler.

**Pure logic vs. I/O split (mirrors TICKET-4's `validate.ts`/`route.ts` split):** `lib/email/quizResultEmail.ts` (the template) has zero imports beyond `@/lib/quiz/types` and is fully unit-testable without touching Resend or the network. `lib/email/sendQuizResultEmail.ts` is the only file that imports `@/lib/resend` and performs I/O — keep the content-building logic out of it beyond calling `buildQuizResultEmail`.

**Client singleton (mirrors `lib/db.ts`):** `lib/resend.ts` exports one client instance built once at module load — `export const resend = new Resend(process.env.RESEND_API_KEY);` — no per-request instantiation. Skip Prisma's `globalForPrisma` dev-reload caching; it solves a connection-pool problem Resend's stateless client doesn't have.

**Casting a validated `string` to a narrower literal union (mirrors `QuizFlow.tsx`'s `responses.gender as Gender`):** `quizResponse.skinType` comes back from Prisma as `string` (the schema column has no DB-level enum). Since `validate.ts` already constrained it to `VALID_SKIN_TYPES` before the write, `quizResponse.skinType as SkinType` in `route.ts` is safe and matches the existing cast style — don't add a second runtime re-validation of a value that was already validated once.

**Secrets (`CLAUDE.md`):** `RESEND_API_KEY` is read only inside `lib/resend.ts`, server-side, via `process.env.RESEND_API_KEY` — never imported into a client component, matching how `DATABASE_URL` is scoped to `lib/db.ts`.

---

## IMPLEMENTATION PLAN

### Phase 1: Dependency + secret plumbing

**Tasks:**
- Add `"resend": "^6.28.1"` to `package.json` dependencies; run `npm install`.
- Add `RESEND_API_KEY="re_..."` to `.env.example`; add the founder's real key to the local (gitignored) `.env`.

### Phase 2: Resend client

**Depends on:** Phase 1 (needs the `resend` package installed and `RESEND_API_KEY` available)

**Tasks:**
- Create `lib/resend.ts`: construct and export the `Resend` client singleton.

### Phase 3: Email content (pure, testable)

**Independent of** Phase 2 — `quizResultEmail.ts` has no dependency on the Resend client or the network.

**Tasks:**
- Build `buildQuizResultEmail(skinType: SkinType): { subject: string; html: string; text: string }` — factual, skin-type-only content (no invented Ayurvedic copy, no package/pricing).

### Phase 4: Send wrapper

**Depends on:** Phase 2 (imports `resend`) and Phase 3 (imports `buildQuizResultEmail`)

**Tasks:**
- Build `sendQuizResultEmail({ to, skinType })`: calls `resend.emails.send(...)` inside `try/catch`, checks the returned `error` field, `console.error`s on either failure path, never throws, never returns a value the caller needs to branch on.

### Phase 5: Wire into the save route

**Depends on:** Phase 4

**Tasks:**
- In `app/api/quiz-response/route.ts`, call `await sendQuizResultEmail({ to: quizResponse.email, skinType: quizResponse.skinType as SkinType })` after the DB write, before the `201` response.

### Phase 6: Manual end-to-end validation

**Depends on:** Phases 1-5

**Tasks:**
- Run `npm run dev`, complete the quiz with a real, reachable test email (preferably the Resend account owner's own address, per the sandbox-domain caveat above), submit, and confirm the email actually arrives with the correct skin type.
- Temporarily use an invalid/malformed `RESEND_API_KEY` (throwaway local edit, revert after) and confirm: the `POST` still returns `201` and the browser still shows "Thanks! We'll be in touch.", while the `next dev` terminal logs a clear, visible error from `sendQuizResultEmail` — proving the "log clearly, don't fail the request" contract actually holds, not just compiles.

---

## STEP-BY-STEP TASKS

### UPDATE `package.json`

- **IMPLEMENT**: Add `"resend": "^6.28.1"` under `dependencies` (alphabetical position, matching existing ordering — after `next`, before `react`... actually alphabetically `resend` sorts between `next` and `react`, confirm against current keys and insert correctly).
- **PATTERN**: Match the existing caret-range style used for `@prisma/client`/`tailwindcss`, not an exact pin like `next`'s — `resend` isn't a framework-level dependency this project builds its whole structure around.
- **VALIDATE**: `npm install` completes with no errors; `node_modules/resend` exists.
- **SATISFIES**: TICKET-5 dependency — the `resend` package must be installed before any of the following files can import it.

### UPDATE `.env.example`

- **IMPLEMENT**: Add a third line: `RESEND_API_KEY="re_..."`.
- **PATTERN**: Mirror the existing two lines' placeholder style (`"postgresql://...pooled-connection-placeholder.../postgres?pgbouncer=true"` etc.) — an obviously-fake value, not a real key.
- **GOTCHA**: Also add the real key to your local `.env` (gitignored, never commit it) — `.env.example` alone won't let `next dev` actually send anything.
- **VALIDATE**: `git status` confirms `.env` itself never appears as a tracked/staged change (only `.env.example`).
- **SATISFIES**: CLAUDE.md Secrets rule — `RESEND_API_KEY` documented as a server-only env var.

### CREATE `lib/resend.ts`

- **IMPLEMENT**: `import { Resend } from "resend"; export const resend = new Resend(process.env.RESEND_API_KEY);`
- **PATTERN**: Mirror `lib/db.ts`'s "one client, constructed once at module load, exported by name" shape — but skip the `globalForPrisma`-style dev-reload caching (see Patterns above for why it doesn't apply here).
- **IMPORTS**: `resend` (npm package, added in Phase 1).
- **GOTCHA**: Don't read `RESEND_API_KEY` anywhere else in the codebase — this file is the single point where the secret is loaded, matching how `DATABASE_URL` is scoped to `lib/db.ts` only.
- **VALIDATE**: `npx tsc --noEmit` passes.
- **SATISFIES**: TICKET-5 scope — "`lib/resend.ts` (a server-only Resend client)."

### CREATE `lib/email/quizResultEmail.ts`

- **IMPLEMENT**: `export function buildQuizResultEmail(skinType: SkinType): { subject: string; html: string; text: string }`. A `Record<SkinType, string>` or simple `switch` mapping each of `"dry" | "sensitive" | "oily"` to a human-readable capitalized label (`"Dry"`, `"Sensitive"`, `"Oily"`) for display; build `subject` (e.g. `"Your Ayurvedic skin type result"`), `html` (a minimal, factual HTML body stating the computed skin type — no dosha philosophy, no package/pricing, no invented copy), and `text` (a plain-text equivalent for email clients that don't render HTML). Keep the content short — this is a factual confirmation, not marketing copy.
- **PATTERN**: Mirror `lib/quiz/scoring.ts`'s style of a small lookup `Record` for a literal union, and its top-of-file comment convention for flagging placeholder/TBD content (e.g. a one-line comment noting the copy is minimal-on-purpose pending founder-provided email copy, mirroring `scoring.ts`'s existing "no domain basis yet" comments).
- **IMPORTS**: `import type { SkinType } from "@/lib/quiz/types"` — nothing else. No `resend` import.
- **GOTCHA**: Don't invent descriptive Ayurvedic/dosha language about what "dry"/"sensitive"/"oily" skin means or recommend products — per `.claude/references/quiz-content.md`, that's placeholder content the founder hasn't provided; state the computed result as a fact only.
- **VALIDATE**: `npx tsc --noEmit` passes.
- **SATISFIES**: TICKET-5 AC — "an email template."

### CREATE `lib/email/quizResultEmail.test.ts`

- **IMPLEMENT**: `describe("buildQuizResultEmail")` with one `it` per `SkinType` value (`"dry"`, `"sensitive"`, `"oily"`) asserting the expected capitalized label appears in `subject`, `html`, and `text`; assert `html`/`text` do **not** contain any of the other two skin types' labels (catches a copy-paste mistake in the lookup table).
- **PATTERN**: `describe`/`it`/`expect` from `vitest`, matching `lib/quiz/scoring.test.ts` and `app/api/quiz-response/validate.test.ts`.
- **IMPORTS**: `import { describe, expect, it } from "vitest"; import { buildQuizResultEmail } from "./quizResultEmail";`
- **VALIDATE**: `npm test` — all new cases pass.
- **SATISFIES**: Global CLAUDE.md testing rule ("pure logic ... should have unit tests"); TICKET-5's "correct skin type" requirement, tested at the content-generation layer.

### CREATE `lib/email/sendQuizResultEmail.ts`

- **IMPLEMENT**: `export async function sendQuizResultEmail({ to, skinType }: { to: string; skinType: SkinType }): Promise<void> { const { subject, html, text } = buildQuizResultEmail(skinType); try { const { error } = await resend.emails.send({ from: "<placeholder sender, e.g. Ayurvedic Skin Quiz <onboarding@resend.dev>>", to: [to], subject, html, text }); if (error) { console.error("Failed to send quiz result email:", error); } } catch (error) { console.error("Failed to send quiz result email:", error); } }`
- **PATTERN**: The "log clearly, never throw" half of CLAUDE.md's fail-loudly rule (see Patterns section above) — this function's contract is that it *cannot* fail its caller.
- **IMPORTS**: `import { resend } from "@/lib/resend"; import { buildQuizResultEmail } from "./quizResultEmail"; import type { SkinType } from "@/lib/quiz/types";`
- **GOTCHA**: The `from` address uses Resend's shared sandbox domain (`onboarding@resend.dev`) as a placeholder, per the architecture doc's "their default sending domain is fine to start." Mark it clearly as a placeholder (comment) so it's easy to find and swap once the founder verifies a custom sending domain — don't invent a `hello@savyasachiayurveda.com`-style address that isn't actually verified in Resend yet, that would silently fail to send.
- **VALIDATE**: `npx tsc --noEmit` passes. (No unit test for this file — it's the I/O boundary; covered by Phase 6 manual validation, consistent with TICKET-4 leaving the route handler itself to manual/integration checking.)
- **SATISFIES**: TICKET-5 AC — "send an email after a successful save"; the ticket's fail-loudly-adjacent requirement that a send failure is visible (logged), not swallowed.

### UPDATE `app/api/quiz-response/route.ts`

- **IMPLEMENT**: After `const quizResponse = await db.quizResponse.create({ data });`, add `await sendQuizResultEmail({ to: quizResponse.email, skinType: quizResponse.skinType as SkinType });` — then the existing `return Response.json({ id: quizResponse.id }, { status: 201 });` unchanged.
- **PATTERN**: Plain `await`, no try/catch around it — `sendQuizResultEmail`'s own contract guarantees it won't throw (see Patterns). Keep the handler as thin as TICKET-4 left it.
- **IMPORTS**: Add `import { sendQuizResultEmail } from "@/lib/email/sendQuizResultEmail";` and `import type { SkinType } from "@/lib/quiz/types";` (for the cast).
- **GOTCHA**: The cast `quizResponse.skinType as SkinType` is safe only because `validate.ts` already constrained `skinType` to `VALID_SKIN_TYPES` before this point — don't skip that reasoning if this code is ever refactored to write `skinType` from somewhere else.
- **VALIDATE**: `npx tsc --noEmit` passes; manually (Phase 6) confirm a completed quiz both persists a row *and* triggers a real email send.
- **SATISFIES**: TICKET-5 AC — "completing the quiz sends a real email with the correct skin type."

---

## TESTING STRATEGY

Per the global CLAUDE.md testing rule, `buildQuizResultEmail` (pure content-generation logic) gets full unit coverage. `lib/resend.ts` (a two-line client construction) and `sendQuizResultEmail` (I/O against a third-party API) are not unit-tested — mirroring how TICKET-4 left `route.ts`'s DB call to manual/integration verification rather than mocking Prisma; mocking the Resend SDK here would test the mock, not real delivery behavior, which is disproportionate at this project's hobby scale.

### Unit Tests
`lib/email/quizResultEmail.test.ts` — see the CREATE task above for the full case list (one per `SkinType`, plus a cross-contamination check).

### Integration Tests
None automated. Phase 6's manual walkthrough (complete the quiz → confirm a real email arrives with the correct skin type; break the API key → confirm the failure is logged and the request still succeeds) is this ticket's real integration check, matching TICKET-5's own AC wording ("Done when completing the quiz sends a real email with the correct skin type").

### Edge Cases (cover manually in Phase 6, plus the unit-test cases in Phase 3)
- A valid save whose email send fails (bad API key, or a recipient the sandbox domain can't deliver to) — confirm the `POST` still returns `201` and the UI still shows success, while the server log clearly shows the email failure (the core "log loudly, don't swallow, don't fail the request" contract).
- Each of the three `SkinType` values produces an email with the matching (and only the matching) skin type mentioned.
- Re-submitting after a fixed API key — confirm a normal second send succeeds without needing any code change (no stale client/connection state to reset, unlike a DB connection pool).

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style
- `npx tsc --noEmit` — no type errors.
- `npm run lint` — no lint errors.

### Level 2: Unit Tests
- `npm test` — `lib/quiz/scoring.test.ts`, `app/api/quiz-response/validate.test.ts` (unchanged), and the new `lib/email/quizResultEmail.test.ts` all pass.

### Level 3: Integration Tests
N/A — no test harness for the Resend API; see manual validation below.

### Level 4: Manual Validation
- `npm run dev` → complete the quiz with a real test email (Resend account owner's own address first, per the sandbox-domain caveat) → submit → confirm the email arrives with the correct, matching skin type in both subject and body.
- Temporarily set an invalid `RESEND_API_KEY` in `.env`, restart `next dev`, repeat a valid submission → confirm the `POST` still returns `201`, the browser still shows "Thanks! We'll be in touch.", and the terminal running `next dev` logs a clear, visible `sendQuizResultEmail` error → revert `.env` and confirm normal sends resume.
- Confirm `.env` was never staged/committed (`git status`) after adding the real `RESEND_API_KEY`.

### Level 5: Additional Validation
N/A.

---

## ACCEPTANCE CRITERIA

- [ ] `lib/resend.ts` exports a server-only `Resend` client built from `RESEND_API_KEY`.
- [ ] Completing the quiz and saving a `QuizResponse` triggers a real email via `sendQuizResultEmail`, containing the correct computed skin type.
- [ ] The email's content is factual/minimal (skin type only) — no invented Ayurvedic copy, no package or pricing content.
- [ ] An email-send failure is visibly logged server-side and does **not** fail the `POST /api/quiz-response` request or its `201` response.
- [ ] `RESEND_API_KEY` is documented in `.env.example`, read only inside `lib/resend.ts`, and never committed as a real value.
- [ ] `buildQuizResultEmail` has unit tests covering all three `SkinType` values.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm test` all pass with zero errors/regressions.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task's validation command passed
- [ ] `tsc --noEmit` and `npm run lint` both clean
- [ ] `npm test` passes (existing suites + new `quizResultEmail.test.ts`)
- [ ] Full manual walkthrough completed per Level 4, including the deliberate bad-API-key check
- [ ] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Resolved during planning — email-failure behavior:** confirmed with the user that a failed send should be logged loudly but must **not** fail the `POST` request (avoids duplicate `QuizResponse` rows from a well-meaning resubmit). See Solution Statement.
- **Assumption — sandbox `from` address.** Using Resend's shared `onboarding@resend.dev` as a placeholder `from` address, per the architecture doc's "their default sending domain is fine to start." Flag for the founder: once a custom domain is verified in Resend, `lib/email/sendQuizResultEmail.ts`'s `from` constant needs to change — this isn't automatic.
- **Not fully verified during planning — sandbox delivery restrictions.** Couldn't confirm from Resend's docs during this planning session whether the shared sandbox domain restricts delivery to only the account owner's own email before a custom domain is verified. If Phase 6's manual test silently doesn't deliver to an arbitrary test email, check the Resend dashboard's Logs before assuming the code is wrong, and retry with the account owner's own address.
- **Assumption — no "check your email" UI change.** `ResultScreen.tsx`'s existing "Thanks! We'll be in touch." copy is left as-is; this ticket doesn't add a "check your inbox" message. If the founder wants that, it's a one-line follow-up to `ResultScreen.tsx`, not blocking this ticket.
- **Assumption — plain HTML/text strings, no templating engine.** Proportionate for one short, factual email; revisit only if TICKET-6/7 add enough email variety (package email, payment confirmation) that hand-written string templates become unwieldy.

## NOTES (open canvas)

**Why the email-failure design differs from TICKET-4's DB-write design, even though both are named in the same CLAUDE.md sentence:** CLAUDE.md's fail-loudly rule lists three failure types ("a failed webhook, DB write, or email send") that "should throw **or** log clearly, not be silently caught" — it's an *or*, not a uniform mandate to throw for all three. The DB write is the record of the lead; losing it to an unhandled exception would be catastrophic and there's no reasonable "partial success" state for it, so TICKET-4 chose "throw." The email is a secondary, retriable-in-principle side effect of an already-successful save; failing the whole request over it would (a) make a real lead look like a failed submission to the visitor, and (b) invite a resubmit that duplicates the `QuizResponse` row, since there's no upsert/idempotency key. "Log clearly" is the more correct reading of the rule for this specific failure, not a weaker one.

**Why `sendQuizResultEmail` checks both the thrown-exception path and the returned `{ error }` field:** the Resend Node SDK's own example code (`resend.com/docs/send-with-nextjs`) wraps `resend.emails.send(...)` in `try/catch` *and* checks `error` on the successful-return path — meaning the SDK doesn't guarantee all failures surface the same way (a validation/API error comes back as `{ error }`; a network-level failure can still throw). Guarding only one path would leave a real gap in "never silently caught."

**Why a separate `lib/email/` directory instead of putting `buildQuizResultEmail` in `lib/resend.ts` directly:** same rationale as TICKET-4's `validate.ts`/`route.ts` split — keeping the pure, testable content-generation function in a file with zero Resend/network imports means its unit tests never construct a `Resend` client or touch `RESEND_API_KEY`, and it visibly marks the pure/I-O boundary the CLAUDE.md testing philosophy cares about.

## AMENDMENTS

(none yet)
