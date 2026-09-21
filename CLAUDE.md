# CLAUDE.md — Ayurvedic Skin Quiz

## What this is
A standalone Next.js app that runs a dosha-based (Vata/Pitta/Kapha) Ayurvedic skin quiz: a visitor answers gender + skin questions, gets a computed skin type, sees a matching priced package, gives their email, and can buy via Stripe Checkout. It's linked from ads/social as its own experience. The live site ([savyasachiayurveda.com](https://savyasachiayurveda.com/)) is built on Bolt.new, and integration will happen through that platform — the exact integration approach (linked vs. embedded) is still an open question (see the PRD), so treat "standalone app" as current-best-guess, not final. Stack: Next.js (App Router) + TypeScript + Tailwind CSS, Prisma + Postgres (Supabase), Stripe Checkout, Resend for email. See `ayurvedic-skin-quiz.prd.md` (intent) and `ayurvedic-skin-quiz.architecture.md` (decisions) for the full reasoning.

**Status:** pre-code — nothing is scaffolded yet. The map below describes the intended layout per the architecture decisions, not what exists on disk today.

## Architecture map
```
app/
  page.tsx                     # landing page — the ad/social entry point into the quiz
  quiz/                        # multi-step quiz flow; answers held in client state until completion
  api/checkout/route.ts        # creates a Stripe Checkout session for the recommended package
  api/webhooks/stripe/route.ts # verifies + handles Stripe webhook events, updates Order status
lib/
  quiz/questions.ts            # quiz question set (content TBD — founder is providing the real framework)
  quiz/scoring.ts              # answers -> dominant dosha/skin type (pure logic; unit-test this)
  quiz/packages.ts             # skinType -> package (products, price) mapping (content TBD)
  stripe.ts                    # server-only Stripe client
  resend.ts                    # server-only Resend client, sends the package + confirmation emails
  db.ts                        # Prisma client singleton
prisma/
  schema.prisma                # QuizResponse + Order models
```

## Where new code goes
- **New quiz step:** inside `app/quiz/` — not a new top-level route; the quiz is one multi-step flow.
- **New third-party integration (payments, email, or similar):** a server-only client module in `lib/`, following `stripe.ts`/`resend.ts` — the client/key setup lives there, never inline in a route or component.

## Ground rules (conventions)
- **Types:** `QuizResponse`/`Order` types come from Prisma's generated client (`prisma/schema.prisma` is the source of truth) — never hand-write parallel interfaces for these models.
- **Secrets:** `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` are server-only env vars in `.env` — never referenced from client components.
- **No auth:** the flow is fully anonymous, identified only by the email captured at quiz completion — don't add login/session/account logic.

## Working principles (agent steering)
- **Fail loudly, never swallow:** this app touches money (Stripe) and PII (email, quiz answers) — a failed webhook, DB write, or email send should throw or log clearly, not be silently caught. A "successful" checkout that silently didn't record is worse than a visible error.
- **Quiz/product content:** don't invent placeholder Ayurvedic content — see `.claude/references/quiz-content.md`.
- **Build order:** quiz UX first, Stripe checkout second — see `.claude/references/stripe-integration.md`.
- **Scope discipline:** no admin UI, no user accounts, no order fulfillment/shipping logic, no subscriptions in v1 — per the PRD's non-goals.

## Commands
- db: `npx prisma migrate dev` (apply schema changes) · `npx prisma studio` (inspect data)

## On-demand context
- Quiz content, scoring, and persistence conventions → `.claude/references/quiz-content.md`
- Stripe Checkout/webhook conventions → `.claude/references/stripe-integration.md`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
