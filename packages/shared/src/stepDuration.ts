/**
 * Deterministic step-duration parser — no inference. Extracts a total cooking
 * duration (in seconds) from a step's free text so a cook-mode timer can
 * pre-load with tap-to-start. Handles Spanish and English units and simple
 * compositions ("1 hora y media", "1 h 30 min"). Returns null when the text
 * has no explicit duration ("hasta dorar", "a fuego medio").
 *
 * Rules:
 * - Sums every explicit `<number> <unit>` token it finds (so "1 h 30 min" = 5400).
 * - "media"/"y media" adds half of the relevant unit ("1 hora y media" = 5400,
 *   "media hora" = 1800).
 * - A range "3-4 min" uses the upper bound (set the longer timer, check early).
 * - Ignores temperatures ("200°C", "180 grados") and vague cues.
 */

const UNIT_SECONDS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hora: 3600,
  horas: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minuto: 60,
  minutos: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  seg: 1,
  segs: 1,
  segundo: 1,
  segundos: 1,
  second: 1,
  seconds: 1,
}

// A number (with optional range "3-4" / "3 a 4") followed by a time unit.
// Temperature units (°, grados, c, °c) are deliberately not in UNIT_SECONDS.
// Digit runs are bounded (\d{1,4}) so the alternation stays linear — an
// unbounded \d+ here is a polynomial-ReDoS risk on adversarial input.
const NUM = String.raw`\d{1,4}(?:[.,]\d{1,2})?`
const TOKEN_RE = new RegExp(
  `(${NUM})\\s*(?:[-–]|a|to)\\s*(${NUM})\\s*([a-záéíóú]+)|(${NUM})\\s*([a-záéíóú]+)`,
  'gi',
)

function toNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'))
}

/**
 * @returns whole seconds (rounded), or null when no explicit duration is present.
 */
export function parseStepDurationSeconds(text: string): number | null {
  const lower = text.toLowerCase()
  let total = 0
  let matched = false

  for (const m of lower.matchAll(TOKEN_RE)) {
    // Range form (groups 1-3) or single form (groups 4-5). A match always has
    // a unit in group 3 (range) or 5 (single), so the coalesce is exhaustive.
    const value = m[1] !== undefined ? toNumber(m[2]!) : toNumber(m[4]!)
    const unit = (m[3] ?? m[5])!
    const perUnit = UNIT_SECONDS[unit]
    if (perUnit === undefined) continue
    total += value * perUnit
    matched = true
  }

  // "media hora" / "hora y media" — half a unit expressed in words.
  const halfUnit = /(?:y\s+)?media\s+(hora|horas)|(hora|horas)\s+y\s+media/.exec(lower)
  if (halfUnit) {
    total += 1800
    matched = true
  }

  if (!matched || total <= 0) return null
  return Math.round(total)
}
