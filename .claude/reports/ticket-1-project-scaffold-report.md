# Implementation Report — TICKET-1 Project Scaffold (Phases 1-3)

**Plan**: `.claude/plans/ticket-1-project-scaffold.md`   **Branch**: `feature/ticket-1-project-scaffold`   **Status**: PARTIAL (Phases 1-3 of 5 complete, by request)

## Summary
Phase 1 scaffolded the Next.js App Router + TypeScript + Tailwind app. Phase 2 connected Prisma to the founder's real Supabase Postgres project: installed Prisma (pinned to the stable 6.x line), defined the `QuizResponse` model, and successfully ran `prisma migrate dev` against Supabase, creating the table. Phase 3 added the `lib/db.ts` Prisma client singleton, verified end-to-end against the real database. Phases 4-5 (`.env`/git hygiene commit, final validation) are not started.

## Tasks completed
- Scaffold the app → `app/`, `public/`, `package.json`, etc. (CREATE) — Phase 1
- Install `prisma`/`@prisma/client` → `package.json`, `package-lock.json` (UPDATE) — Phase 2
- `prisma init` + configure datasource → `prisma/schema.prisma`, `prisma.config.ts` (CREATE) — Phase 2
- Add `QuizResponse` model → `prisma/schema.prisma` (UPDATE) — Phase 2
- Run `prisma migrate dev --name init` against the real Supabase project → `prisma/migrations/20260920142211_init/migration.sql` (CREATE), table created and verified — Phase 2
- Create Prisma client singleton → `lib/db.ts` (CREATE) — Phase 3

## Tests added
None — no logic to test yet (matches the plan's testing strategy; TICKET-2's scoring logic is the first candidate for real tests).

## Validation results
- `npx prisma validate` → pass.
- `npx tsc --noEmit` → pass, no errors (after Phase 2 and again after Phase 3).
- `npm run lint` → pass, no errors (after Phase 2 and again after Phase 3).
- `prisma migrate dev --name init` → completed successfully against Supabase; table columns independently verified via raw SQL against `information_schema.columns`.
- **Runtime query engine sanity check** (done before starting Phase 3, to de-risk it): a throwaway script calling `prisma.quizResponse.count()` via the generated `@prisma/client` against the pooled `DATABASE_URL` succeeded (`count = 0`, ~5.7s cold start) — confirms the pooled-connection hang found in Phase 2 is specific to Prisma's CLI schema-engine, not the runtime query engine `lib/db.ts` depends on.
- **Phase 3's own validation**: a throwaway script importing `db` from `lib/db.ts` and calling `db.quizResponse.count()` returned `0` without throwing, run via `npx tsx` (temporary, not added as a dependency — removed after use, along with the script itself).
- `npm run dev` reconfirmed booting (200 OK) after Phase 2's Prisma install, before Phase 3.

## Deviations from the plan

**Phase 1** (see prior report content, unchanged): non-empty-directory scaffold fallback via temp dir, skipped generated `CLAUDE.md`/`AGENTS.md`, Tailwind v4 installed by default, renamed leaked `package.json` name.

**Phase 2:**
- **`npm install -D prisma` (no version pin) resolved to `8.0.0-rc.15`**, a pre-release release-candidate on npm's `latest` tag, which crashed npm's own dependency resolver. Pinned to Prisma's last stable major instead.
- **Evaluated and rejected Prisma 7** (the actual latest *stable* release): requires a driver adapter, a new `prisma.config.ts`, an ESM/CJS decision, and a generated-client import path — bigger than the plan assumed or this project needs. Confirmed with the project owner. Pinned to **Prisma `6.19.3`**.
- **`npm audit` flags 3 high-severity issues** in `deepmerge-ts`, a transitive dependency of Prisma's own CLI config-loader, present in every current Prisma release from `6.13.0` through `8.x`. Not worth downgrading further (to `6.12.0`) over a dev-only CLI issue unreachable by anything except the developer's own local config.
- **`prisma.config.ts`'s `datasource.url` points at `DIRECT_URL`, not `DATABASE_URL`** — the one substantive, load-bearing deviation. Prisma's CLI schema-engine (`db pull`, `migrate dev`) hangs indefinitely against Supabase's pooled connection (port 6543); the direct connection (port 5432) works instantly. Root-caused via a raw `pg` connection test (ruling out network/credentials) and a controlled swap of the CLI's connection target. `lib/db.ts` (built in Phase 3) still uses the pooled `DATABASE_URL` via `schema.prisma`, per the plan's original intent — only the CLI's separate config file changed.
- **A Supabase database password appeared in this session's transcript**, via an automatic file-change notice after the user edited `.env`. Flagged to the project owner, who chose to proceed without rotating it.

**Phase 3:**
- None — `lib/db.ts` matches the plan's spec exactly.

## Issues encountered
- The `prisma migrate dev` hang (Phase 2, see above) — resolved by isolating it to `prisma.config.ts`'s datasource target.
- **Agent error, since corrected**: while cleaning up Prisma 7's artifacts in Phase 2, the agent ran `rm -rf .claude/skills .agents/skills .windsurf ...` believing those directories had been freshly created by Prisma 7's own "installing skills" step. This was based on a flawed read of directory mtimes (a directory's mtime updates when *anything* is added inside it, not just on creation) and ignored the contradicting evidence that `piv-implement` had already been invoked successfully earlier in this same session. This deleted the project's real, pre-existing `.claude/skills/` and `.agents/skills/` toolkit (`piv-implement`, `piv-commit`, `plan-architecture`, `prime-codebase`, and ~25 others) — not just Prisma's cruft. The repo had zero git commits at the time, so there was no git-based recovery. The user had the original source (`C:\AI\agentic-coding-course`, the starter-pack template this project's `.claude/`/`.agents/`/`.archon/` were originally copied from) and restored `.claude/`, `.agents/`, `.archon/` from it in full; the restore was verified via `diff -rq` against the source showing zero unexpected differences. No project work was lost (the deletion never touched `.claude/plans/` or `.claude/reports/`, and no commits had been made), but this was a real, avoidable mistake — flagged here for visibility, not to relitigate, since it's now fully resolved.

## Next steps
Phase 4 (`.env.example` already exists; first commit still pending) and Phase 5 (final end-to-end validation) remain. No commit has been made yet — nothing in this branch has been pushed or committed.
