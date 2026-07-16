import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_KEY: z.string().min(16, "ADMIN_API_KEY should be at least 16 characters long"),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT should be at least 16 characters long"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  // Parse and validate configuration up front so the service fails fast on bad deploys.
  return envSchema.parse(source);
}
