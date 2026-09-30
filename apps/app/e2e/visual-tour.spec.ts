import * as path from 'node:path'
import { test, testUnauth, expect } from './fixtures'
import type { Page, TestInfo } from '@playwright/test'

/**
 * Visual tour: visits every screen at phone and desktop widths, in light and dark
 * mode, and saves a full-page screenshot of each. It asserts nothing about layout —
 * the screenshots are the output, reviewed by the Auditar QA persona for aesthetic,
 * design and workflow issues.
 *
 * Only runs with E2E_SCREENSHOTS=true (CI sets it; locally:
 * `E2E_SCREENSHOTS=true pnpm e2e:local visual-tour.spec.ts`). Files land in
 * test-results/visual-tour/<viewport>-<scheme>-<screen>.png.
 */

const ENABLED = process.env['E2E_SCREENSHOTS'] === 'true'
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const
const SCHEMES = ['light', 'dark'] as const

const STATIC_SCREENS: Array<[string, string]> = [
  ['home', '/'],
  ['library', '/library'],
  ['collections', '/collections'],
  ['menu', '/menu'],
  ['menu-pick', '/menu/pick'],
  ['shopping-list', '/menu/shopping-list'],
  ['pantry', '/pantry'],
  ['heladera', '/heladera'],
  ['stats', '/stats'],
  ['profile', '/profile'],
  ['household', '/household'],
  ['config', '/config'],
  ['recipe-new', '/recipe/new'],
]

const AUTH_SCREENS: Array<[string, string]> = [
  ['login', '/auth/login'],
  ['register', '/auth/register'],
  ['forgot', '/auth/forgot'],
]

async function capture(page: Page, testInfo: TestInfo, file: string) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
  // Let fonts, images and entry animations settle before the shot.
  await page.waitForTimeout(500)
  // React Native Web scrolls inside a container, so fullPage alone stops at the fold.
  // Grow the viewport to the tallest scrollable content, shoot, then restore.
  const viewport = page.viewportSize()
  const contentHeight = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      ...Array.from(document.querySelectorAll('*')).map((el) =>
        el.scrollHeight > el.clientHeight ? el.scrollHeight + el.getBoundingClientRect().top : 0,
      ),
    ),
  )
  if (viewport && contentHeight > viewport.height) {
    await page.setViewportSize({
      width: viewport.width,
      height: Math.ceil(Math.min(contentHeight, 6000)),
    })
    await page.waitForTimeout(200)
  }
  await page.screenshot({
    path: path.join(testInfo.project.outputDir, 'visual-tour', `${file}.png`),
    fullPage: true,
  })
  if (viewport) await page.setViewportSize(viewport)
}

async function firstId(page: Page, endpoint: string): Promise<string | undefined> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const res = await page.request.get(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok()) return undefined
  const body = (await res.json()) as unknown
  const list = Array.isArray(body)
    ? body
    : ((body as { items?: unknown[]; data?: unknown[] }).items ??
      (body as { data?: unknown[] }).data ??
      [])
  const first = list[0] as { id?: string } | undefined
  return first?.id
}

test.describe('Visual tour (screenshots for review)', () => {
  test.skip(!ENABLED, 'Set E2E_SCREENSHOTS=true to capture the visual tour')
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180000)

  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      test(`app screens · ${vp.name} · ${scheme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.emulateMedia({ colorScheme: scheme })

        const screens = [...STATIC_SCREENS]
        const recipeId = await firstId(page, '/v1/recipes')
        if (recipeId) {
          screens.push(
            ['recipe-detail', `/recipe/${recipeId}`],
            ['recipe-edit', `/recipe/${recipeId}/edit`],
            ['recipe-cook', `/recipe/${recipeId}/cook`],
          )
        }
        const collectionId = await firstId(page, '/v1/collections')
        if (collectionId) screens.push(['collection-detail', `/collections/${collectionId}`])

        // One broken screen must not hide the rest of the tour: record and continue.
        const failures: string[] = []
        for (const [name, route] of screens) {
          try {
            await page.goto(route)
            await capture(page, testInfo, `${vp.name}-${scheme}-${name}`)
          } catch (err) {
            failures.push(`${name} (${route}): ${(err as Error).message.split('\n')[0]}`)
          }
        }
        expect(failures, 'screens that could not be captured').toEqual([])
      })
    }
  }
})

testUnauth.describe('Visual tour — auth screens (screenshots for review)', () => {
  testUnauth.skip(!ENABLED, 'Set E2E_SCREENSHOTS=true to capture the visual tour')

  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      testUnauth(`auth screens · ${vp.name} · ${scheme}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.emulateMedia({ colorScheme: scheme })
        const failures: string[] = []
        for (const [name, route] of AUTH_SCREENS) {
          try {
            await page.goto(route)
            await capture(page, testInfo, `${vp.name}-${scheme}-${name}`)
          } catch (err) {
            failures.push(`${name} (${route}): ${(err as Error).message.split('\n')[0]}`)
          }
        }
        expect(failures, 'screens that could not be captured').toEqual([])
      })
    }
  }
})
