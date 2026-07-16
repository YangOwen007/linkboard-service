import { PrismaClient } from "@prisma/client";

// Reuse the Prisma client in development to avoid exhausting connections on hot reloads.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export function createPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}
