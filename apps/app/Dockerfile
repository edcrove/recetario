FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/app/package.json ./apps/app/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/app ./apps/app

# Build shared
RUN pnpm --filter @recetario/shared build

# Export Expo web (static)
WORKDIR /app/apps/app
ARG EXPO_PUBLIC_API_URL=http://localhost:3000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN pnpm exec expo export --platform web --output-dir /app/dist

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
