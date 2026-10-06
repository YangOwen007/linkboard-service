import fp from "fastify-plugin";
import { ZodError } from "zod";

export const errorHandlerPlugin = fp(async (app) => {
  // Convert common validation and runtime failures into predictable API responses.
  app.setErrorHandler((error, request, reply) => {
    // Keep internal messages and Prisma query/connection details out of responses/logs.
    const failure = error as { code?: string; statusCode?: number; name?: string };

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: error.issues.map(({ path, message }) => ({ path, message }))
      });
    }

    const databaseErrors: Record<string, [number, string, string]> = {
      P2002: [409, "Conflict", "A record with that unique value already exists"],
      P2003: [400, "InvalidReference", "The referenced record does not exist"],
      P2025: [404, "NotFound", "Record not found"]
    };
    const mapped = failure.code ? databaseErrors[failure.code] : undefined;
    if (mapped) return reply.status(mapped[0]).send({ error: mapped[1], message: mapped[2] });
    const status = failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500 ? failure.statusCode : 500;
    const messages: Record<number, string> = {
      400: "Invalid request", 401: "Missing or invalid admin API key",
      413: "Request body is too large", 415: "Unsupported media type",
      429: "Too many requests; retry later"
    };
    if (status === 500) request.log.error({ requestId: request.id, code: failure.code }, "Request failed");
    return reply.status(status).send({
      error: status === 500 ? "InternalServerError" : "RequestError",
      message: messages[status] ?? "Unexpected server error"
    });
  });
});
