#!/usr/bin/env node
/**
 * Builds a coverage-instrumented Expo web export for E2E testing.
 *
 * Metro's own per-file babel transform proved unreliable for first-party
 * route/src files in this Expo/Metro version: babel.config.js's
 * babel-plugin-istanbul never actually ran on any file under app/** or
 * src/**, even with every Metro cache cleared and a bundle-content diff
 * confirming the build was genuinely fresh (not stale). Node_modules files
 * were instrumented fine through the same config, just never first-party
 * source.
 *
 * Instead of depending on Metro's per-file babel invocation, this
 * pre-instruments first-party source directly with a plain @babel/core call
 * (confirmed to work reliably), writing plain instrumented CJS (Metro can
 * bundle already-compiled JS same as any node_modules dependency) into a
 * shadow copy of the project, then lets Metro/Expo bundle that shadow copy
 * normally via `expo export --no-minify`.
 *
 * --no-minify matters: Metro's production minifier (terser) treats
 * istanbul's coverage-tracking IIFE as dead code and strips it entirely —
 * confirmed by diffing a minified vs unminified instrumented build (0 vs
 * 2000+ `cov_` occurrences). The larger, unminified bundle is fine here
 * since this build is only ever used for measuring E2E coverage, never
 * shipped.
 *
 * The shadow copy is a sibling of apps/app (not nested elsewhere) because
 * metro.config.js computes `workspaceRoot = path.resolve(projectRoot,
 * '../..')` — keeping the same nesting depth means that still resolves to
 * the real monorepo root without any metro.config.js changes.
 *
 * Usage: node e2e/build-instrumented.js [output-dir]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('node:child_process')
const babel = require('@babel/core')

const APP_ROOT = path.resolve(__dirname, '..')
const SHADOW_ROOT = path.resolve(APP_ROOT, '../.e2e-instrumented')

// Mirrors the include/exclude that babel-plugin-istanbul previously used.
const INCLUDE = [/^app\/.*\.tsx$/, /^src\/.*\.tsx?$/]
const EXCLUDE = [
  /^e2e\//,
  /\.test\.tsx?$/,
  /^src\/__mocks__\//,
  /^src\/__tests__\//,
  /^src\/__screen-tests__\//,
]

const COPY_EXCLUDE = new Set([
  'node_modules',
  '.expo',
  'dist',
  'dist-coverage',
  '.e2e-coverage',
  'coverage',
  'coverage-e2e',
  '.nyc_output',
  'playwright-report',
  'test-results',
])

function shouldInstrument(relPath) {
  const p = relPath.split(path.sep).join('/')
  if (!INCLUDE.some((r) => r.test(p))) return false
  if (EXCLUDE.some((r) => r.test(p))) return false
  return true
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (COPY_EXCLUDE.has(entry.name)) continue
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyTree(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

// babel-preset-expo normally rewrites `process.env.EXPO_PUBLIC_*` into a
// `require("expo/virtual/env")` lookup that Metro populates by scanning the
// raw source for that pattern during its own per-file transform. Since these
// files are already plain JS by the time Metro sees them, Metro never finds
// the raw pattern to register the variable, and the virtual module throws
// "not supported in production bundles" at runtime. Inline these ourselves
// as literals instead, and tell the preset (via caller.preserveEnvVars) to
// leave env vars alone so it doesn't also try its own rewrite.
function inlineEnvVarsPlugin({ types: t }) {
  return {
    visitor: {
      MemberExpression(path) {
        if (
          path.node.object.type === 'MemberExpression' &&
          path.node.object.object.type === 'Identifier' &&
          path.node.object.object.name === 'process' &&
          path.node.object.property.name === 'env' &&
          path.node.property.type === 'Identifier' &&
          path.node.property.name.startsWith('EXPO_PUBLIC_')
        ) {
          const value = process.env[path.node.property.name]
          path.replaceWith(value === undefined ? t.valueToNode(undefined) : t.stringLiteral(value))
        }
      },
    },
  }
}

function instrumentTree(dir, relBase) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    const rel = path.join(relBase, entry.name)
    if (entry.isDirectory()) {
      instrumentTree(abs, rel)
      continue
    }
    if (!shouldInstrument(rel)) continue

    // Coverage must be reported against the real project path, not the
    // shadow copy's path, so nyc/remap-coverage.js need no changes.
    const originalAbsPath = path.join(APP_ROOT, rel)
    const source = fs.readFileSync(abs, 'utf8')
    const result = babel.transform(source, {
      filename: originalAbsPath,
      cwd: APP_ROOT,
      presets: ['babel-preset-expo'],
      caller: { name: 'metro', platform: 'web', isDev: false, preserveEnvVars: true },
      plugins: [
        inlineEnvVarsPlugin,
        [
          'babel-plugin-istanbul',
          {
            cwd: APP_ROOT,
            include: ['app/**/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
            exclude: [
              'e2e/**',
              '**/*.test.ts',
              '**/*.test.tsx',
              'src/__mocks__/**',
              'src/__tests__/**',
              'src/__screen-tests__/**',
            ],
            extension: ['.ts', '.tsx', '.js'],
          },
        ],
      ],
    })

    const jsPath = abs.replace(/\.tsx?$/, '.js')
    fs.writeFileSync(jsPath, result.code)
    if (jsPath !== abs) fs.rmSync(abs)
  }
}

function main() {
  const outputDir = path.resolve(process.argv[2] ?? path.join(APP_ROOT, 'dist-coverage'))

  console.log(`Building instrumented shadow copy at ${SHADOW_ROOT}...`)
  fs.rmSync(SHADOW_ROOT, { recursive: true, force: true })
  copyTree(APP_ROOT, SHADOW_ROOT)
  fs.symlinkSync(path.join(APP_ROOT, 'node_modules'), path.join(SHADOW_ROOT, 'node_modules'))

  console.log('Instrumenting first-party source with babel-plugin-istanbul...')
  instrumentTree(path.join(SHADOW_ROOT, 'app'), 'app')
  instrumentTree(path.join(SHADOW_ROOT, 'src'), 'src')

  console.log(`Exporting instrumented web build to ${outputDir}...`)
  execFileSync(
    'npx',
    ['expo', 'export', '--platform', 'web', '--output-dir', outputDir, '--clear', '--no-minify'],
    { cwd: SHADOW_ROOT, stdio: 'inherit', env: process.env },
  )

  fs.rmSync(SHADOW_ROOT, { recursive: true, force: true })
  console.log('Done.')
}

main()
