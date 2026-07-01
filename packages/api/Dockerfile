FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN pnpm --filter @recetario/shared build
RUN pnpm --filter @recetario/api build

# Production stage
FROM base AS runner
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY packages/api/drizzle ./packages/api/drizzle
COPY packages/api/drizzle.config.ts ./packages/api/drizzle.config.ts
COPY packages/api/entrypoint.sh ./packages/api/entrypoint.sh
RUN chmod +x /app/packages/api/entrypoint.sh

WORKDIR /app/packages/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/packages/api/entrypoint.sh"]
