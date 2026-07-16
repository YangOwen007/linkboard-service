import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Expose a minimal readiness endpoint for local checks and platform health probes.
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: app.dependencies.env.NODE_ENV
  }));
};
