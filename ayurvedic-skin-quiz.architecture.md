# Architecture — Personalized Ayurvedic Skin Quiz

*Companion to `ayurvedic-skin-quiz.prd.md`.*

## Problem & goals

Prove that a personalized Ayurvedic skin quiz — gender + skin questions → dosha-based skin type → a priced, custom package → email capture → Stripe checkout — gets ad/social visitors to complete it and attempt to buy, validating that people want individualized Ayurvedic skincare over generic products. Every decision below is judged against: can we build and test this locally, at hobby scale, without unnecessary infrastructure, while still being a real, chargeable, production-usable flow.

## Approaches considered

1. **Standalone Next.js app, own deploy, linked via URL** *(recommended)* — a self-contained app (this repo) with its own domain/subdomain. The live Ayurvedic site just links to it. No dependency on code we can't access.
2. **Embed/integrate into the existing site's codebase** — rejected. The existing site's code isn't accessible from this environment (separate host, not on this machine), so there's nothing to integrate into directly.
3. **iframe embed of a hosted quiz into the existing site** — considered and rejected for v1: adds cross-origin complexity (styling, sizing, postMessage for redirects to Stripe) for no real benefit when a plain link works fine for an ad/social landing page.

## Recommended approach

A standalone Next.js (App Router) + TypeScript app. A dedicated landing page is the entry point (linked from ads/social). The quiz is a client-driven, multi-step flow; each answer is held in client state until the quiz is complete. On completion, the app computes a dosha-based skin type, shows a matching package with a price, captures the user's email, sends the package by email, and offers a "Buy Now" that creates a Stripe Checkout session. A webhook confirms payment and updates the stored record. Hosting is deliberately left open (any standard Node/Next.js host works — Vercel is the natural default later) so nothing in the app code assumes a specific platform.

## Key decisions

- **Stack & libraries:** Next.js (App Router) + TypeScript + Tailwind CSS. *Alternative considered:* plain CSS/CSS Modules — rejected only because Tailwind is faster to build and iterate a quiz UI with; either would work.
- **Database:** Postgres, hosted on **Supabase** (free tier) + **Prisma** as the ORM/migration tool. *(Updated 2026-09-20: originally recommended Neon for its dev/prod branching; switched to Supabase because the founder already has an account and familiarity with it — that outweighs the marginal branching convenience, and Supabase's extra features like auth/storage just go unused, not in the way.)* The app runs locally; the database is a free cloud instance, so there's no local Postgres install or Docker required, and dev and prod use the same engine (no drift). *Alternative considered:* SQLite for local simplicity — rejected because it would force an engine switch at deploy time; Docker-local Postgres — rejected as unnecessary extra infra for a hobby-scale project.
- **Data model** (shape-level):
  - `QuizResponse` — `id`, `email`, `gender`, `answers` (the full set of question→answer pairs), computed `skinType`, `createdAt`. Written **once, on quiz completion** — the app does not persist partial/in-progress sessions (see *Open questions* re: drop-off measurement).
  - `Order` — `id`, `quizResponseId` (FK → `QuizResponse`), `stripeSessionId`, `status` (pending / paid / failed), `amount`, `createdAt`. Created when a Checkout session starts, updated by the Stripe webhook on payment success/failure.
  - Quiz questions, dosha-scoring rules, and skin-type→package mappings are **not** database tables — they live as plain config/code (e.g. `questions.ts`, `packages.ts`) since content isn't finalized yet and there's no admin UI in v1 (per the PRD's non-goals). When the real Ayurvedic framework is provided, it drops into these files directly.
- **Boundaries & contracts:**
  - **Stripe:** Stripe Checkout (hosted payment page) rather than a custom card form (Stripe Elements) — least code, no PCI scope, well-documented, testable locally via the Stripe CLI forwarding webhooks to `localhost`. Secret key and webhook signing secret are server-only env vars; the app never handles raw card data.
  - **Resend (email):** server-only API key; the app sends the package summary email after quiz completion, and can send a payment confirmation after a successful Stripe webhook event.
  - **Database:** connection string in `.env`, gitignored before first commit (per your global security rule); Prisma schema/migrations are checked into the repo.
  - **Auth:** none. The flow is fully anonymous, identified only by the email captured at quiz completion — no login/accounts, matching the PRD's non-goals.
  - **Secrets inventory:** `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` — all server-side only, never exposed to the client bundle.
- **Content-as-config pattern:** quiz questions, dosha-scoring weights, and skin-type→package mappings are plain TypeScript config, not database-driven — deliberately simple since there's no admin UI and content is still being finalized.

## Missing pieces

- The actual quiz questions and dosha-scoring logic (you're bringing a fuller Ayurvedic framework later — the domain research in the PRD is a starting point only).
- The actual package contents and pricing per skin type.
- A Supabase Postgres project + Prisma schema/migrations set up.
- A Resend account (their default sending domain is fine to start; a verified custom domain matters more once this goes live for real).
- A Stripe account — test-mode keys are enough to build and test the full flow locally now; real business/bank verification for live charges can happen later, in parallel, without blocking development (per your call).
- A hosting decision, whenever you're ready to deploy (kept out of scope for now).

## Spikes & experiments

- **Question:** Does the Stripe Checkout → webhook flow work cleanly end-to-end in test mode, locally, via the Stripe CLI?
  **Spike:** Once quiz UX is solid and you move to checkout work (per your own sequencing preference), spend a small, timeboxed session wiring just the Checkout session creation + webhook handler against a dummy package/price, before integrating it into the real quiz result screen.
  **Decision rule:** if the local test-mode flow (session → redirect → webhook → `Order` updated) works within that session, proceed to wire it into the real UI. If the webhook handling is unreliable or confusing locally, pause and get the Stripe CLI/webhook setup right in isolation before touching the quiz UI.

No other calls here are risky/one-way enough to warrant a spike — everything else (stack, DB, email service) is a reversible, well-trodden choice.

## Open questions

- [ ] Quiz questions + dosha-scoring rules — TBD, you're providing a fuller framework later.
- [ ] Package contents + pricing per skin type — TBD.
- [ ] Hosting target — deferred; architecture stays host-agnostic in the meantime.
- [ ] Drop-off measurement: v1 only persists a `QuizResponse` on completion, per your call to keep it simple — which means the PRD's "WRONG" signal (mid-quiz drop-off) **can't be measured from the database alone** in this version. Worth revisiting (e.g. a lightweight client-side analytics event, or a later switch to session-based tracking) if that signal turns out to matter once ads are running.
- [ ] Stripe business account verification timeline — deprioritized for now per your call; revisit before you need to accept real (non-test-mode) payments.
- [x] ~~Neon vs. Supabase~~ — resolved 2026-09-20: Supabase, since the founder already has an account and familiarity with it.
