import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Story #76 (2026-07): every colour comes from the theme tokens so dark mode and
// the palette stay consistent. Nothing enforced it, and two auth spinners still
// hard-coded '#fff' (white on the light button, wrong in dark mode). This guard
// fails on any hex literal outside src/theme.
const ROOTS = ['app', 'src/components', 'src/hooks', 'src/providers']
const HEX = /['"`]#[0-9a-fA-F]{3,8}['"`]/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('colours come from the theme', () => {
  it('no hex colour literals outside src/theme', () => {
    const offenders = ROOTS.flatMap(files).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => (HEX.test(line) ? `${file}:${i + 1}: ${line.trim()}` : null))
        .filter((x): x is string => x !== null),
    )
    expect(offenders).toEqual([])
  })
})
