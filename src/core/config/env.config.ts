import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is strictly required.'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is strictly required.'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map(
        (issue) =>
          `❌ Invalid variable: ${issue.path.join('.')} - ${issue.message}`,
      )
      .join('\n');
    console.error(
      `\n CRITICAL ERROR IN .ENV CONFIGURATION \n${errorMessages}\n`,
    );
    throw new Error(
      'Invalid environment configuration. Aborting application startup...',
    );
  }

  return parsed.data;
}
