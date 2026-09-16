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
