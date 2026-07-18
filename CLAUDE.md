@AGENTS.md

# Project context

## Deployment
- Hosted on **Vercel**; source on GitHub: `github.com/commission888/jarmeng-expense` (branch `main`).
- Env values are never committed. `.env.example` is the template; `.env*` and `.mcp.json` are gitignored.

## Supabase
- Project ref: `jcghvkmgoztcaegzhvsd` — URL `https://jcghvkmgoztcaegzhvsd.supabase.co`.
- **`supabase/schema.sql` is the source of truth.** The live DB was provisioned by applying it as migrations (`init_jarmeng_expense_schema`, `harden_touch_keyword_search_path`). Change the schema there, then re-apply — don't edit the DB by hand.
- Tables: `users`, `transactions`, `keywords`, `gmail_accounts`, `processed_emails`. RLS is **enabled with no policies on purpose** — all access goes through the server with the service-role key, which bypasses RLS. The "RLS enabled, no policy" advisor notices are expected, not bugs.
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
- **Phase 2 — Gmail sync (not implemented):** OAuth flow, tables, and repo helpers exist. Remaining: implement `src/app/api/cron/gmail-sync/route.ts` (5-step recipe in its comment), add a "connect Gmail" button to the dashboard, and add the cron schedule to `vercel.json`. Needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` + `CRON_SECRET`. Encrypt `refresh_token` at rest before production (PDPA).
- **Phase 3 — monthly report (not implemented):** `bangkokMonthRange` / `listTransactions` / `summarize` already exist. Remaining: implement `src/app/api/cron/monthly-report/route.ts` (4-step recipe in its comment), add a `listAllUsers` paginating helper, and add the cron schedule to `vercel.json`. Needs `CRON_SECRET`. Uses metered LINE **push** messages — budget before enabling.
- The scaffold route comments carry the authoritative step-by-step for each phase. Read `docs/PRD_Expense_Tracker_Updated.md` and `docs/SETUP.md` before implementing.
