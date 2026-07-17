import { z } from 'zod';

const schema = z.object({
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),

  // LIFF dashboard. The channel id is what LINE checks the ID token's `aud`
  // against — without it any LINE user's token would pass verification.
  LINE_LOGIN_CHANNEL_ID: z.string().optional(),

  // Phase 2 — unset until Gmail sync is wired up.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  CRON_SECRET: z.string().optional(),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

function load(): Env {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Invalid environment configuration: ${missing}. See .env.example.`,
    );
  }

  return result.data;
}

/**
 * Validated at first access rather than at import, so `next build` and the
 * pure parser tests don't need a populated environment.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    cached ??= load();
    return cached[prop as keyof Env];
  },
});
