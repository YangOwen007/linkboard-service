import type { PrismaClient } from "@prisma/client";

import type { AppEnv } from "./config/env.js";

export type AppDependencies = {
  env: AppEnv;
  prisma: PrismaClientLike;
};

// This narrowed Prisma shape makes it easier to stub route behavior in tests.
export type PrismaClientLike = Pick<
  PrismaClient,
  "profile" | "link" | "clickEvent" | "$connect" | "$disconnect"
>;
