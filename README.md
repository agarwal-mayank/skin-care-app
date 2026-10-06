# Ayurvedic Skin Quiz

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Supabase](https://img.shields.io/badge/Postgres-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Tests](https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white)

A dosha-based (Vata / Pitta / Kapha) skin quiz for [Savyasachi Ayurveda](https://savyasachiayurveda.com/).
A visitor answers a few questions, gets their skin type, sees a matching skincare package, and receives
their result by email. Paid checkout via Razorpay is next.

The quiz is a standalone app that ads and social posts link to directly. How it connects to the main
Bolt.new site is still an open question (see the [PRD](ayurvedic-skin-quiz.prd.md)).

---

## Features

| Feature | Status |
|---|---|
| Multi-step quiz (gender + skin questions) | ✅ Built |
| Dosha scoring → skin type (dry / sensitive / oily) | ✅ Built, unit-tested |
| Matching package shown on the result screen | ✅ Built |
| Quiz response saved to Postgres | ✅ Built |
| Result email via Resend | ✅ Built ([#10](https://github.com/agarwal-mayank/skin-care-app/issues/10) before launch) |
| Razorpay checkout + webhook | 🚧 In progress (TICKET-7) |
| Bolt.new site integration | ⏸️ Blocked on an integration decision |
| Real quiz questions, scoring weights and package content | 📝 Placeholder until the founder supplies them |

**Out of scope for v1:** user accounts, admin UI, order fulfillment/shipping, subscriptions.

## Tech stack

- **[Next.js](https://nextjs.org) (App Router)** + **TypeScript** + **Tailwind CSS**
- **[Prisma](https://www.prisma.io)** on **Postgres** hosted by **[Supabase](https://supabase.com)**
- **[Resend](https://resend.com)** for transactional email
- **[Razorpay](https://razorpay.com) Checkout** for payments (in progress)
- **[Vitest](https://vitest.dev)** for unit tests

## Getting started

### Prerequisites

- Node.js 20.9+ (developed on 22)
- A Supabase (or any Postgres) database
- A Resend API key

### Setup

```bash
git clone https://github.com/agarwal-mayank/skin-care-app.git
cd skin-care-app
npm install

cp .env.example .env        # then fill in the values below
npx prisma migrate dev      # create the tables
npm run dev                 # http://localhost:3000
```

### Environment variables

All of these are **server-only** and live in `.env`, which is git-ignored. Never commit real values.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection (used at runtime) |
| `DIRECT_URL` | Direct Postgres connection (used by Prisma migrations) |
| `RESEND_API_KEY` | Sends the quiz-result email |

Checkout will add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the unit tests (Vitest) |
| `npm run lint` | Run ESLint |
| `npx prisma migrate dev` | Apply schema changes |
| `npx prisma studio` | Browse the database |

## Project structure

```
app/
  page.tsx                    # landing page: the entry point from ads and social posts
  quiz/                       # the multi-step quiz (client state until completion)
  api/quiz-response/          # saves the response and sends the result email
lib/
  quiz/questions.ts           # question set (placeholder content)
  quiz/scoring.ts             # answers → dominant dosha → skin type (pure, unit-tested)
  quiz/packages.ts            # skin type → package (products, price)
  email/                      # email builders + senders
  resend.ts                   # server-only Resend client
  db.ts                       # Prisma client singleton
prisma/schema.prisma          # data model: the source of truth for types
```

## Documentation

- [Product requirements (PRD)](ayurvedic-skin-quiz.prd.md): what we're building and why
- [Architecture decisions](ayurvedic-skin-quiz.architecture.md): how, and the trade-offs
- [Tickets](docs/tickets/ayurvedic-skin-quiz.md): the epic sliced into buildable tickets
- [CLAUDE.md](CLAUDE.md): conventions and ground rules for AI-assisted development

## How we work

This project is built with an AI-assisted workflow ([Claude Code](https://claude.com/claude-code)):

1. **Tickets → PRs.** Each ticket is planned, built on its own branch, and opened as a pull request.
2. **Every PR gets reviewed.** An automated review runs the tests, type checks and lint, then posts its
   findings on the PR.
3. **Deferred findings become issues.** Review findings that don't block a merge are filed as
   [GitHub issues](https://github.com/agarwal-mayank/skin-care-app/issues) so they aren't lost.
4. **Issues → fixes.** An issue goes through investigation (root-cause analysis), then a fix with a
   regression test, then a PR and a review. A human always makes the merge decision.

Ground rules: secrets never leave `.env`, failures (payments, emails, DB writes) are surfaced loudly
rather than swallowed, and the flow stays anonymous: no accounts, only the email address captured at the end
of the quiz.
