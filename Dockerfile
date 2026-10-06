# Build dependencies and TypeScript output in a separate stage.
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build

# Keep the runtime image small and production-focused.
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Retain the migration CLI and generated client from the verified build stage.
# Development tools remain in this image; no second install changes resolution.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
USER node

EXPOSE 3000

# exec forwards shutdown signals to Node after migrations complete.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/src/server.js"]
