# ADR-009 — Expo for web + mobile

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Expo SDK 53 with Expo Router v4 for iOS, Android, and web from a single codebase (`apps/app`). React Native Web handles the web target.

## Context

Maintaining separate React and React Native codebases doubles UI work. Expo Router provides file-based routing that works across targets. The app is primarily a read consumer, so cross-platform edge cases are minimal.

## Consequences

- One `apps/app` package targets all three platforms.
- CI builds the web target (no simulator required).
- Native-specific code isolated in platform files (`*.native.ts`).
- No server-side rendering in Phase 1 (static web export or dev server).
