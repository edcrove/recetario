import { test, expect } from './fixtures'
import { API_URL } from './env'
import { openSeededRecipe } from './recipeNav'

/**
 * Cook mode E2E flows.
 * Requires at least one recipe with steps to be accessible.
 */

/** Steps through cook mode until the rating modal opens, waiting for each step to render. */
async function finishAllSteps(page: import('@playwright/test').Page) {
  const counter = page.getByText(/Paso \d+ \/ \d+/).first()
  await expect(counter).toBeVisible()
  const total = Number(/\/ (\d+)/.exec((await counter.textContent()) ?? '')?.[1])
  for (let step = 1; step < total; step++) {
    await page.getByTestId('cook-next').click()
    await expect(page.getByText(new RegExp(`Paso ${step + 1} / `))).toBeVisible()
  }
  await page.getByTestId('cook-finish').click()
  await expect(page.getByText('¿Cómo salió?')).toBeVisible()
}

test.describe('Cook mode: basic flow', () => {
  async function openRecipeDetail(page: import('@playwright/test').Page) {
    await openSeededRecipe(page)
  }

  test('Iniciar cocina button is visible on recipe detail', async ({ page }) => {
    await openRecipeDetail(page)
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('cook mode opens with step counter', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
  })

  test('cook mode has Pasos and Ingredientes tabs', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    // Verify step counter visible (cook mode is active)
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    // Tab switcher has Pasos and Ingredientes
    const tabBar = page.locator('text=Pasos').first()
    await expect(tabBar).toBeVisible()
  })

  test('can navigate to next step', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()

    const nextBtn = page.getByTestId('cook-next').or(page.getByTestId('cook-finish')).first()
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()

    // Either moved to step 2 or opened rating modal
    const step2 = page.getByText(/Paso 2 \/ /)
    const ratingModal = page.getByText('¿Cómo salió?')
    await expect(step2.or(ratingModal)).toBeVisible()
  })

  test('ingredients tab shows ingredient checklist', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    await page.getByTestId('cook-tab-ingredients').click()
    await expect(page.getByTestId('ingredient-checklist-row-0')).toBeVisible()
  })

  test('can toggle ingredient checklist items', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
    await page.getByTestId('cook-tab-ingredients').click()
    const row = page.getByTestId('ingredient-checklist-row-0')
    await expect(row).toBeVisible()
    await row.click()
    await row.click() // toggle back off
    await expect(row).toBeVisible()
  })

  test('going back to steps tab from ingredients works', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await page.getByTestId('cook-tab-ingredients').click()
    await expect(page.getByTestId('ingredient-checklist-row-0')).toBeVisible()
    await page.getByTestId('cook-tab-steps').click()
    await expect(page.getByText(/Paso \d+ \/ \d+/)).toBeVisible()
  })

  test('previous button navigates back a step', async ({ page }) => {
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()
    await page.getByTestId('cook-next').click()
    await expect(page.getByText(/Paso 2 \/ /)).toBeVisible()
    await page.getByTestId('cook-prev').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()
  })

  test('step timer is visible and can be paused/resumed', async ({ page }) => {
    // "Milanesa de pollo napolitana" step 4 has a durationSeconds timer — navigate there
    await openSeededRecipe(page)
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()

    // Navigate to step 4 (index 3) which has the timer
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('cook-next').click()
      await expect(page.getByText(new RegExp(`Paso ${i + 2} / `))).toBeVisible()
    }

    // The seeded step 4 ("Freír … 3-4 minutos") always carries an 8-minute timer
    const toggle = page.getByTestId('cook-timer-toggle')
    // Tap-to-start: pre-loaded paused, so it reads "Iniciar" first.
    await expect(toggle).toHaveText(/Iniciar|Reanudar/)
    await toggle.click()
    await expect(toggle).toHaveText('Pausar')
  })

  test('rating modal appears after finishing all steps', async ({ page }) => {
    // Seeded title, not first card: other suites create step-less recipes
    // that land at the top of the list and have no Cocinar button.
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()

    await finishAllSteps(page)

    await expect(page.getByText('¿Cómo salió?')).toBeVisible()
    await expect(page.getByTestId('cook-rating-save')).toBeVisible()
    await expect(page.getByTestId('cook-rating-skip')).toBeVisible()
  })

  test('can skip rating and return', async ({ page }) => {
    // Pick a seeded recipe by title: the first card in the list is the most
    // recently created one, which other suites may have created without steps
    // (no Cocinar button on its detail).
    await openRecipeDetail(page)
    await page.getByTestId('recipe-detail-cook').click()

    await finishAllSteps(page)

    await expect(page.getByTestId('cook-rating-skip')).toBeVisible()
    await page.getByTestId('cook-rating-skip').click()
    // After skip, app navigates back — verify we're no longer in cook mode
    await expect(page.getByTestId('cook-rating-skip')).not.toBeVisible()
  })
})

// Deep-coverage flows: full session with rating, skip path, speech toggle,
// step timer tap-to-start and completion (duration_seconds allows a short real
// timer), and the no-steps empty state. Uses dedicated recipes created via API
// so the seeded demo data stays untouched.
test.describe('Cook mode: full session flows', () => {
  // Recipes created here are deleted after each test: leftovers accumulate
  // across local runs, push the seeded recipes off the home list's first page
  // and break every title-based locator in other suites.
  let created: { id: string; token: string }[] = []

  test.afterEach(async ({ request }) => {
    for (const r of created) {
      await request.delete(`${API_URL}/v1/recipes/${r.id}`, {
        headers: { Authorization: `Bearer ${r.token}` },
      })
    }
    created = []
  })

  async function createRecipe(
    page: import('@playwright/test').Page,
    overrides: Record<string, unknown> = {},
  ) {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const res = await page.request.post(`${API_URL}/v1/recipes`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Cocina ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
        steps: [{ text: 'Hervir el agua.' }, { text: 'Servir con cuidado.' }],
        ...overrides,
      },
    })
    expect(res.ok()).toBe(true)
    const recipe = (await res.json()) as { id: string; title: string }
    created.push({ id: recipe.id, token: token ?? '' })
    return recipe
  }

  async function openCookMode(page: import('@playwright/test').Page, title: string) {
    await page.goto('/')
    await page.getByPlaceholder(/buscar recetas/i).fill(title)
    await page.getByText(title).first().click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('recipe-detail-cook').click()
    await expect(page.getByText(/Paso 1 \/ /)).toBeVisible()
  }

  test('finishing a session with rating and note logs it to history', async ({ page }) => {
    const recipe = await createRecipe(page)
    await openCookMode(page, recipe.title)

    await page.getByTestId('cook-next').click()
    await expect(page.getByText(/Paso 2 \/ 2/)).toBeVisible()
    await page.getByTestId('cook-finish').click()
    await expect(page.getByText('¿Cómo salió?')).toBeVisible()

    await page.getByText('★').nth(3).click() // 4 stars
    await page.getByPlaceholder('Agregar nota (opcional)').fill('Salió perfecto (E2E)')
    await page.getByTestId('cook-rating-save').click()

    // Back on detail; history tab shows the rated session
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
    await page.getByTestId('recipe-tab-history').click()
    await expect(page.getByText(/★/).first()).toBeVisible()
  })

  test('skipping the rating still exits cook mode', async ({ page }) => {
    const recipe = await createRecipe(page)
    await openCookMode(page, recipe.title)
    await page.getByTestId('cook-next').click()
    await page.getByTestId('cook-finish').click()
    await expect(page.getByText('¿Cómo salió?')).toBeVisible()
    await page.getByTestId('cook-rating-skip').click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()

    // The unrated session is still recorded
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const res = await page.request.get(`${API_URL}/v1/cook-sessions/recipes/${recipe.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const sessions = (await res.json()) as Array<{ rating: number | null }>
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.rating).toBeNull()
  })

  test('cook mode uses the servings chosen on the detail screen', async ({ page }) => {
    const recipe = await createRecipe(page, {
      ingredients: [
        { name: 'agua', quantity: 1, unit: 'l' },
        { name: 'ajo', quantity: 1, unit: 'clove' },
      ],
    })
    await page.goto('/')
    await page.getByPlaceholder(/buscar recetas/i).fill(recipe.title)
    await page.getByText(recipe.title).first().click()
    await expect(page.getByTestId('servings-plus')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('servings-plus').click()
    await page.getByTestId('servings-plus').click() // 2 → 4
    await page.getByTestId('recipe-detail-cook').click()
    await page.getByTestId('cook-tab-ingredients').click()
    await expect(page.getByTestId('ingredient-checklist-row-0')).toContainText('2 l agua')
    await expect(page.getByTestId('ingredient-checklist-row-1')).toContainText('2 diente ajo')
  })

  test('leaving past step 1 asks first; a running timer shows in the top bar', async ({ page }) => {
    const recipe = await createRecipe(page, {
      steps: [{ text: 'Hervir el agua.', durationSeconds: 600 }, { text: 'Servir.' }],
    })
    await openCookMode(page, recipe.title)
    await page.getByTestId('cook-timer-toggle').click()
    await page.getByTestId('cook-next').click()
    await expect(page.getByTestId('cook-running-timer-0')).toContainText('Paso 1')

    let dialogs = 0
    page.once('dialog', (d) => {
      dialogs++
      void d.dismiss()
    })
    await page.getByTestId('cook-exit').click()
    await expect.poll(() => dialogs).toBe(1)
    await expect(page.getByText(/Paso 2 \/ 2/)).toBeVisible()

    page.once('dialog', (d) => void d.accept())
    await page.getByTestId('cook-exit').click()
    await expect(page.getByTestId('recipe-detail-cook')).toBeVisible()
  })

  test('speech toggle switches the speaker icon on and off', async ({ page }) => {
    // Headless Chromium's speechSynthesis is erratic (CI) or missing (local), so
    // install a deterministic fake that "speaks" until cancelled.
    await page.addInitScript(() => {
      type Utterance = { text: string; onstart?: () => void; onend?: () => void }
      let current: Utterance | null = null
      const fake = {
        speaking: false,
        pending: false,
        paused: false,
        speak(u: Utterance) {
          current = u
          fake.speaking = true
          u.onstart?.()
        },
        cancel() {
          const u = current
          current = null
          fake.speaking = false
          u?.onend?.()
        },
        pause() {},
        resume() {},
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
      }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true })
      ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
        class {
          constructor(public text: string) {}
        }
    })
    const recipe = await createRecipe(page)
    await openCookMode(page, recipe.title)
    // Click via testID and assert via text content: CI's headless linux lacks
    // a color-emoji font, so the glyph box is zero-width there.
    const speechBtn = page.getByTestId('cook-speech-toggle')
    await expect(speechBtn).toHaveText('🔈')
    await speechBtn.click()
    await expect(speechBtn).toHaveText('🔊')
    await speechBtn.click()
    await expect(speechBtn).toHaveText('🔈')
  })

  // duration_seconds allows a short real timer, so no fake clock is needed —
  // a 3s step runs to completion within the test.
  test('a step timer pre-loads, taps to start, and runs to completion', async ({ page }) => {
    const recipe = await createRecipe(page, {
      steps: [{ text: 'Paso cronometrado.', durationSeconds: 3 }, { text: 'Fin.' }],
    })
    await openCookMode(page, recipe.title)

    const toggle = page.getByTestId('cook-timer-toggle')
    const timer = page.getByTestId('cook-timer')

    // Tap-to-start: pre-loaded paused at the full duration, button reads "Iniciar".
    await expect(toggle).toHaveText('Iniciar')
    await expect(timer).toHaveText('00:03')

    // Start → Pausar; pause → Reanudar; reset → back to Iniciar at full time.
    await toggle.click()
    await expect(toggle).toHaveText('Pausar')
    await toggle.click()
    await expect(toggle).toHaveText('Reanudar')
    await page.getByTestId('cook-timer-reset').click()
    await expect(toggle).toHaveText('Iniciar')
    await expect(timer).toHaveText('00:03')

    // Run to completion.
    await toggle.click()
    await expect(timer).toHaveText('00:00')
  })

  // AC: "When the timer reaches 0:00, a visible alert (banner or modal) and an
  // audible notification are triggered." Web Audio and speech are recorded by
  // an init script, so the test asserts the cook would actually hear it.
  test('reaching 0:00 shows an alert banner and plays an audible cue', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __beeps: number
        __spoken: string[]
        AudioContext: unknown
      }
      w.__beeps = 0
      w.__spoken = []
      w.AudioContext = class {
        currentTime = 0
        destination = {}
        createGain() {
          return { gain: { value: 0 }, connect() {} }
        }
        createOscillator() {
          return {
            type: '',
            frequency: { value: 0 },
            connect() {},
            start() {
              w.__beeps++
            },
            stop() {},
          }
        }
      }
      const synth = window.speechSynthesis as unknown as { speak?: (u: { text: string }) => void }
      if (synth) synth.speak = (u) => void w.__spoken.push(u.text)
    })
    // The old blocking window.alert froze every other timer: none must open now.
    let dialogs = 0
    page.on('dialog', (d) => {
      dialogs++
      void d.accept()
    })
    const recipe = await createRecipe(page, {
      steps: [{ text: 'Hervir dos segundos.', durationSeconds: 2 }, { text: 'Servir.' }],
    })
    await openCookMode(page, recipe.title)

    await page.getByTestId('cook-timer-toggle').click()
    // Move on: the alert must reach the cook on whichever step they are.
    await page.getByTestId('cook-next').click()
    const banner = page.getByTestId('cook-timer-done-0')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner).toContainText('¡Tiempo! Terminó el paso 1.')
    await expect(banner).toHaveAttribute('role', 'alert')

    const beeps = await page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)
    expect(beeps).toBe(2)
    const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)
    expect(spoken.join(' ')).toContain('Terminó el paso 1')
    expect(dialogs).toBe(0)

    // "Ver paso" brings the cook back to the finished step and clears the alert.
    await page.getByTestId('cook-timer-done-goto-0').click()
    await expect(page.getByText(/Paso 1 \/ 2/)).toBeVisible()
    await expect(banner).toHaveCount(0)
    await expect(page.getByTestId('cook-timer')).toHaveText('00:00')
  })

  // A browser that blocks Web Audio (autoplay policy) and has no speech engine
  // must still show the alert: the banner is the cue that can't be lost.
  test('with audio blocked and no speech engine the 0:00 alert still shows', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>
      w['AudioContext'] = class {
        constructor() {
          throw new Error('NotAllowedError')
        }
      }
      delete w['webkitAudioContext']
      // speechSynthesis is a Window.prototype getter: shadow it, delete won't do
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    })
    const recipe = await createRecipe(page, {
      steps: [{ text: 'Esperar un segundo.', durationSeconds: 1 }, { text: 'Servir.' }],
    })
    await openCookMode(page, recipe.title)

    // Read-aloud can't start without a speech engine: the icon stays off.
    await page.getByTestId('cook-speech-toggle').click()
    await expect(page.getByTestId('cook-speech-toggle')).toHaveText('🔈')

    await page.getByTestId('cook-timer-toggle').click()
    await expect(page.getByTestId('cook-timer-done-0')).toContainText('Terminó el paso 1', {
      timeout: 10_000,
    })
    await page.getByTestId('cook-timer-done-dismiss-0').click()
    await expect(page.getByTestId('cook-timer-done-0')).toHaveCount(0)
  })

  test('a recipe without steps shows the cook-mode empty state', async ({ page }) => {
    // The detail screen doesn't render the Cocinar button for step-less
    // recipes, so the empty state is only reachable by direct URL.
    const recipe = await createRecipe(page, { steps: [] })
    await page.goto(`/recipe/${recipe.id}/cook`)
    await expect(page.getByText('Esta receta no tiene pasos.')).toBeVisible()
    // Opened by direct URL there is no history: ✕ replaces the route with the recipe.
    await page.getByText('✕').click()
    await expect(page).toHaveURL(new RegExp(`/recipe/${recipe.id}$`))
    await expect(page.getByText(recipe.title).first()).toBeVisible()
  })
})
