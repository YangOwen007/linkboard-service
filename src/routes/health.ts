import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness checks HTTP; readiness also checks the backing database.
  app.get("/health", { config: { rateLimit: false } }, async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: app.dependencies.env.NODE_ENV
  }));
  app.get("/ready", { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await app.dependencies.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });
};
