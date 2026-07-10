export type DeltaStatus = 'ok' | 'over' | 'under' | 'none'

/** Within ±10% of target reads as on-track. */
export function deltaStatus(delta: number | null, target: number): DeltaStatus {
  if (delta === null || target <= 0) return 'none'
  const tolerance = target * 0.1
  if (Math.abs(delta) <= tolerance) return 'ok'
  return delta > 0 ? 'over' : 'under'
}

/** Human phrase for a single macro delta: 'faltan 300' / '+120 sobre el objetivo' / 'en objetivo'. */
export function deltaLabel(delta: number | null, target: number): string {
  const status = deltaStatus(delta, target)
  if (status === 'none' || delta === null) return ''
  if (status === 'ok') return 'en objetivo'
  return delta > 0 ? `+${Math.round(delta)} sobre objetivo` : `faltan ${Math.round(-delta)}`
}
