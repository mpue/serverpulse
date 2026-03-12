import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_EXPIRY_SECONDS: z.coerce.number().default(900),      // 15 minutes
  REFRESH_EXPIRY_SECONDS: z.coerce.number().default(604800), // 7 days
  PROC_ROOT: z.string().default('/proc'),
  COLLECT_INTERVAL_MS: z.coerce.number().default(2000),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('serverpulse@localhost'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost'),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.string().default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
