import fp from "fastify-plugin";
import { createHash, timingSafeEqual } from "node:crypto";
import { FastifyError, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    verifyAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

class UnauthorizedError extends Error implements FastifyError {
  statusCode = 401;
  code = "UNAUTHORIZED";
}

export const adminAuthPlugin = fp(async (app) => {
  // Decorate the app so admin routes can share one simple access-control check.
  app.decorate("verifyAdmin", async (request: FastifyRequest) => {
    const apiKey = request.headers["x-api-key"];

    // Fixed-length digests prevent key length/content controlling comparison time.
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (typeof apiKey !== "string" || !timingSafeEqual(digest(apiKey), digest(app.dependencies.env.ADMIN_API_KEY))) {
      throw new UnauthorizedError("Missing or invalid admin API key");
    }
  });
});
