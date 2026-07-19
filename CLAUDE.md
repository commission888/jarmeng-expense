@AGENTS.md

# Project context

## Deployment
- Hosted on **Vercel**; source on GitHub: `github.com/commission888/jarmeng-expense` (branch `main`).
- Env values are never committed. `.env.example` is the template; `.env*` and `.mcp.json` are gitignored.

## Supabase
- Project ref: `jcghvkmgoztcaegzhvsd` — URL `https://jcghvkmgoztcaegzhvsd.supabase.co`.
- **`supabase/schema.sql` is the source of truth.** The live DB was provisioned by applying it as migrations (`init_jarmeng_expense_schema`, `harden_touch_keyword_search_path`, `add_sent_reports_ledger`). Change the schema there, then re-apply — don't edit the DB by hand.
- Tables: `users`, `transactions`, `keywords`, `gmail_accounts`, `processed_emails`, `sent_reports`. RLS is **enabled with no policies on purpose** — all access goes through the server with the service-role key, which bypasses RLS. The "RLS enabled, no policy" advisor notices are expected, not bugs.
- `public.rls_auto_enable()` is a pre-existing platform event trigger (auto-enables RLS on new tables). Its SECURITY DEFINER advisor warnings are benign — leave it.

## Environment variables
- Validated lazily via zod in `src/lib/env.ts` — `next build` passes even with env unset (validation runs on first access at runtime, not at build). A green build does NOT mean env is complete.
- Required at runtime: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, plus `NEXT_PUBLIC_LIFF_ID`.
- `NEXT_PUBLIC_LIFF_ID` is inlined into the client bundle at **build time** — it must be set in Vercel before deploy; changing it later needs a redeploy.
- `LINE_LOGIN_CHANNEL_ID` is zod-optional but security-critical: without it, ID-token `aud` is not checked and any LINE user's token passes verification.
- Optional / later phases: `GEMINI_MODEL` (defaults to `gemini-2.5-flash`), `CRON_SECRET` (Phase 3 cron), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (Phase 2 Gmail sync).
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the browser.

## Status & roadmap (as of 2026-07-19)
- **Live and working:** LINE webhook, chat recording/summary/undo, and the LIFF dashboard are confirmed working end-to-end. Home page and the dashboard loading skeleton are done.
- **Phase 2 — Gmail sync (implemented, needs config):** `src/app/api/cron/gmail-sync/route.ts` is a **GET** handler that, per connected mailbox, refreshes the token, pulls bank/payment mail (`src/lib/gmail/api.ts`; `buildSyncQuery` uses `after:YYYY/MM/DD` + a `claimEmail` dedupe overlap), extracts fields with `GeminiEmailExtractor` (`src/lib/ai/gemini-email.ts`), then reuses `categorize()` and records `source='gmail'`. A "connect Gmail" button is in the LIFF dashboard. PDPA: `refresh_token` is encrypted at rest via `src/lib/crypto.ts` (AES-256-GCM at the `gmail-accounts` repo boundary) — needs `TOKEN_ENCRYPTION_KEY`; email bodies are never persisted. Claim semantics: not-a-transaction keeps its claim, a thrown error calls `releaseEmail` to retry. A dead refresh token (Google 400 `invalid_grant`, thrown as `GmailAuthError`) pushes the user a "reconnect Gmail" LINE message and deletes the account so it stops retrying — Testing-mode Google apps expire refresh tokens after 7 days, so this fires routinely until the OAuth app is verified. Schedule in `vercel.json` (`0 2 * * *`, daily — Hobby-safe). To enable: Google Cloud OAuth client + `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` + `TOKEN_ENCRYPTION_KEY` + `CRON_SECRET`, then redeploy and connect a mailbox. Pure helpers unit-tested (`gmail/api.test.ts`, `ai/gemini-email.test.ts`, `crypto.test.ts`).
- **Phase 3 — monthly report (implemented, needs config):** `src/app/api/cron/monthly-report/route.ts` is a **GET** handler (Vercel Cron calls with GET) that pages all users via `listAllUsers` (`src/lib/repo/users.ts`), summarizes the *previous* Bangkok month, and pushes a Flex report + savings advice (`src/lib/report.ts`, unit-tested in `report.test.ts`). Schedule is wired in `vercel.json` (`0 1 1 * *` = 08:00 ICT on the 1st). To enable: set `CRON_SECRET` in Vercel (route fails closed without it) and confirm the Vercel plan honors a day-of-month cron. Uses metered LINE **push** messages — budget before enabling. Retries are idempotent: each user is claimed in `sent_reports` (`src/lib/repo/report-log.ts`) before the push, so a retried run skips anyone already sent this month; a failed push releases the claim so the next run retries that user. Per-user errors are swallowed.
- The scaffold route comments carry the authoritative step-by-step for each phase. Read `docs/PRD_Expense_Tracker_Updated.md` and `docs/SETUP.md` before implementing.
