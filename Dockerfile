# Build dependencies and TypeScript output in a separate stage.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile=false

COPY tsconfig.json vitest.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build

# Keep the runtime image small and production-focused.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --prod --frozen-lockfile=false

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
