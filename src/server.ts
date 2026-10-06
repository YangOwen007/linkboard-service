import { createApp } from "./app.js";

async function shutdown(app: ReturnType<typeof createApp>, signal: string) {
  // Close the HTTP server and database connection so deploy platforms can stop
  // the service cleanly during restarts or shutdowns.
  app.log.info({ signal }, "Shutting down service");

  try {
    await app.close();
    app.log.info("Shutdown completed");
  } catch (error) {
    app.log.error({ err: error, signal }, "Shutdown failed");
    process.exitCode = 1;
  }
}

async function start() {
  // Build the app once, connect to the database, and then begin listening for traffic.
  const app = createApp();

  try {
    await app.dependencies.prisma.$connect();

    // Register signal handlers after startup wiring so the same app instance is
    // used for both serving traffic and shutting down gracefully.
    let stopping = false;
    const stop = (signal: string) => {
      if (stopping) return;
      stopping = true;
      // Bound draining time so a stuck connection cannot block a deployment forever.
      const timeout = setTimeout(() => process.exit(1), 25000);
      timeout.unref();
      void shutdown(app, signal).finally(() => clearTimeout(timeout));
    };
    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));

    await app.listen({
      host: app.dependencies.env.HOST,
      port: app.dependencies.env.PORT
    });
  } catch (error) {
    app.log.error("Server failed to start; check database connectivity and bind settings");
    await app.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

void start().catch(() => {
  // Configuration errors occur before the logger exists; never echo env values.
  console.error("Startup failed: check required environment variables and Prisma client generation");
  process.exitCode = 1;
});
