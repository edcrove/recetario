#!/usr/bin/env node
/**
 * Remap Istanbul coverage paths from Docker container paths to local/CI paths.
 * Docker builds at /app/apps/app, local/CI checks at process.cwd().
 *
 * Usage: node e2e/remap-coverage.js [input] [output]
 *   input:  .nyc_output/out.json (default)
 *   output: .nyc_output/out.json (overwrites by default)
 */

const fs = require('fs')
const path = require('path')

const inputFile = process.argv[2] ?? path.join(process.cwd(), '.nyc_output/out.json')
const outputFile = process.argv[3] ?? inputFile
const localRoot = process.cwd()
const dockerRoot = '/app/apps/app'

const raw = fs.readFileSync(inputFile, 'utf8')
const data = JSON.parse(raw)

let count = 0
const remapped = {}
for (const [key, value] of Object.entries(data)) {
  const newKey = key.replace(dockerRoot, localRoot)
  if (typeof value === 'object' && value !== null && 'path' in value) {
    value.path = value.path.replace(dockerRoot, localRoot)
  }
  remapped[newKey] = value
  count++
}

fs.writeFileSync(outputFile, JSON.stringify(remapped))
console.log(`Remapped ${count} files: ${dockerRoot} → ${localRoot}`)
