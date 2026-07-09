# Recetario

[![CI](https://github.com/edcrove/recetario/actions/workflows/ci.yml/badge.svg)](https://github.com/edcrove/recetario/actions/workflows/ci.yml)

![Node 22](https://img.shields.io/badge/node-22-brightgreen)
![pnpm 9.15](https://img.shields.io/badge/pnpm-9.15-orange)
![TypeScript 5.7](https://img.shields.io/badge/typescript-5.7-blue)
![Expo SDK 56](https://img.shields.io/badge/expo-56-blueviolet)
![Hono 4.12](https://img.shields.io/badge/hono-4.12-yellow)

An **agent-first** recipe management application. The primary write path flows through MCP tools so that AI agents can create, update, and curate recipes without any inference logic leaking into the mobile/web app. The Expo app is a read-only consumer of the REST API.

## Quick start

```bash
# 1. Clone
git clone https://github.com/edcrove/recetario.git
cd recetario

# 2. Install dependencies
pnpm install

# 3. Start Postgres
docker compose up -d

# 4. Run all packages in dev mode
pnpm dev
```

See [CLAUDE.md](./CLAUDE.md) for the full developer guide, key commands, and architecture conventions.

## Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Monorepo        | pnpm workspaces + Turborepo 2    |
| API             | Hono 4.7 on Node 22              |
| ORM             | Drizzle ORM 0.41 + PostgreSQL 17 |
| Mobile/Web      | Expo SDK 53 + Expo Router v4     |
| Agent interface | Model Context Protocol (MCP)     |
| Language        | TypeScript 5.7 (strict)          |
| Tests           | Vitest 3                         |
| CI              | GitHub Actions                   |
