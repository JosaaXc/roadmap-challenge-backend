import { z } from 'zod';

export const PINO_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type PinoLogLevel = (typeof PINO_LOG_LEVELS)[number];

const logLevelsSchema = z
  .string()
  .transform((val) =>
    val
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.enum(PINO_LOG_LEVELS))
      .min(1, 'At least one valid log level must be specified.'),
  )
  .optional()
  .transform((val): PinoLogLevel[] => val ?? ['debug', 'info', 'warn', 'error']);

export const envSchema = z.object({
  APP_NAME: z.string().default('CodeQuest API'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  // Logging
  // Allowed values: trace, debug, info, warn, error, fatal (comma-separated).
  // The lowest level in the list becomes the minimum threshold for Pino output.
  // Dev default : debug,info,warn,error
  // Production  : enforces minimum info (debug/trace are silenced even if listed)
  LOG_LEVELS: logLevelsSchema,
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is strictly required.'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is strictly required.'),

  // Rate Limiting (configurable per environment)
  // THROTTLE_TTL  : time window in milliseconds (default: 60000 = 1 minute)
  // THROTTLE_LIMIT: max requests per IP per window (default: 60)
  THROTTLE_TTL: z.coerce.number().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().default(60),

  // JWT (RS256 asymmetric signing)
  // Base64-encoded PEM content (NOT a file path) - generate with `npm run generate:jwt-keys`.
  // Works unchanged across OSes/containers since it's plain env content, no shared filesystem.
  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is strictly required.'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is strictly required.'),
  // Key id advertised in the JWT header and in JWKS - lets consumers pick the right key on rotation.
  JWT_KID: z.string().default('codequest-default'),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  JWT_REFRESH_TOKEN_TTL: z.string().default('7d'),
  // Seconds. INDEPENDENT of JWT_ACCESS_TOKEN_TTL - controls how often JwtAuthGuard
  // re-validates isActive/roleId against Postgres, not how long the token itself lives.
  // The guard always caps this to whatever time is actually left on the token
  // (min(this value, remaining token life)), so it can never outlive the JWT - but
  // setting it LOWER than the token TTL is intentional: it forces more frequent
  // re-checks (e.g. faster reaction to a user being deactivated mid-session) at the
  // cost of more Postgres reads. Setting it equal to or above the token TTL means
  // "trust the cached session for the token's entire lifetime, never re-check".
  JWT_SESSION_CACHE_TTL_SECONDS: z.coerce.number().default(900),
  // Seconds. TTL for the role -> permissions cache (Cache-Aside against Postgres).
  ROLE_PERMISSIONS_CACHE_TTL_SECONDS: z.coerce.number().default(3600),

  // Idempotency (Stripe-style Idempotency-Key deduplication, see @Idempotent())
  // Seconds. Default TTL for a COMPLETED result, used when a route doesn't override it explicitly.
  IDEMPOTENCY_DEFAULT_TTL_SECONDS: z.coerce.number().default(86_400),
  // Seconds. TTL of the IN_PROGRESS lock while the original request is still executing.
  IDEMPOTENCY_LOCK_TTL_SECONDS: z.coerce.number().default(60),

  // Discord OAuth2 (Federated Identity via passport-discord)
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is strictly required.'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'DISCORD_CLIENT_SECRET is strictly required.'),
  DISCORD_CALLBACK_URL: z.string().min(1, 'DISCORD_CALLBACK_URL is strictly required.'),
  // Where OAuth callbacks redirect the browser back to with the issued tokens.
  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is strictly required.'),

  // Sessions: caps how many refresh tokens (devices/browsers) a single user can
  // hold concurrently. Logging in beyond the cap evicts the oldest session(s)
  // first (sliding window) - prevents unbounded session growth from repeated
  // login attempts/retries.
  MAX_ACTIVE_SESSIONS_PER_USER: z.coerce.number().int().min(1).default(5),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map(
        (issue) =>
          `[ENV] Invalid variable: ${issue.path.join('.')} - ${issue.message}`,
      )
      .join('\n');
    console.error(
      `\n[ENV] CRITICAL ERROR IN .ENV CONFIGURATION\n${errorMessages}\n`,
    );
    throw new Error(
      '[ENV] Invalid environment configuration. Aborting application startup...',
    );
  }

  return parsed.data;
}
