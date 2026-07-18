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
