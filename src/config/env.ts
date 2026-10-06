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
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Report field names only; configuration errors must not expose values.
    throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  const env = result.data;
  if (env.NODE_ENV === "production" && [env.ADMIN_API_KEY, env.IP_HASH_SALT].some((value) => value.length < 32 || value.startsWith("replace-with"))) {
    throw new Error("Production ADMIN_API_KEY and IP_HASH_SALT require random values of at least 32 characters");
  }
  if (env.NODE_ENV === "production" && env.ADMIN_API_KEY === env.IP_HASH_SALT) {
    throw new Error("Production ADMIN_API_KEY and IP_HASH_SALT must differ");
  }
  return env;
}
