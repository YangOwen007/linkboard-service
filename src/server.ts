import { createApp } from "./app.js";

async function start() {
  // Build the app once, connect to the database, and then begin listening for traffic.
  const app = createApp();
  await app.dependencies.prisma.$connect();

  try {
    await app.listen({
      host: app.dependencies.env.HOST,
      port: app.dependencies.env.PORT
    });
  } catch (error) {
    app.log.error(error, "Server failed to start");
    process.exitCode = 1;
  }
}

void start();
