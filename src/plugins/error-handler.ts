import fp from "fastify-plugin";
import { ZodError } from "zod";

export const errorHandlerPlugin = fp(async (app) => {
  // Convert common validation and runtime failures into predictable API responses.
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: error.issues
      });
    }

    const statusCode = "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

    return reply.status(statusCode).send({
      error: error.name || "InternalServerError",
      message: error.message || "Unexpected server error"
    });
  });
});
