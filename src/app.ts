import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

import { loadEnv, type AppEnv } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";
import { adminAuthPlugin } from "./plugins/auth.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { adminRoutes } from "./routes/admin.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profiles.js";
import type { AppDependencies, PrismaClientLike } from "./types.js";

declare module "fastify" {
  interface FastifyInstance {
    dependencies: AppDependencies;
  }
}

type CreateAppOptions = {
  env?: AppEnv;
  prisma?: PrismaClientLike;
};

export function createApp(options: CreateAppOptions = {}) {
  const env = options.env ?? loadEnv();
  const prisma = options.prisma ?? createPrismaClient();
  const loggerOptions = env.NODE_ENV === "test"
    ? false
    : env.NODE_ENV === "development"
      ? {
          level: env.LOG_LEVEL,
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard"
            }
          }
        }
      : {
          level: env.LOG_LEVEL
        };

  // Create the server with structured logging so deployment platforms can ingest logs cleanly.
  const app = Fastify({
    logger: loggerOptions,
    bodyLimit: 16 * 1024,
    requestTimeout: 10000
  });

  // Store shared dependencies on the app instance to keep route modules small and testable.
  app.decorate("dependencies", {
    env,
    prisma
  });

  // PowerShell and some simple clients send form-encoded POSTs by default, so
  // accept that content type even when a route does not need a request body.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const rawBody = typeof body === "string" ? body : body.toString();
      const parsed = Object.fromEntries(new URLSearchParams(rawBody));
      done(null, parsed);
    }
  );

  app.register(errorHandlerPlugin);
  // In-memory limits suit one instance; forwarded headers are deliberately untrusted.
  app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "no-store");
  });
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
  app.register(adminAuthPlugin);
  app.register(healthRoutes);
  app.register(profileRoutes);
  app.register(adminRoutes);

  return app;
}
