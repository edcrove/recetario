export function cookModeNav(total: number, current: number) {
  return {
    isFirst: current === 0,
    isLast: current === total - 1,
    actionLabel: current === total - 1 ? 'Finalizar' : 'Siguiente',
    next: current < total - 1 ? current + 1 : current,
    prev: current > 0 ? current - 1 : current,
  }
}

/** Steps whose timer hit 0:00 and still show their banner, oldest first. */
export function addFinishedStep(finished: number[], step: number): number[] {
  return finished.includes(step) ? finished : [...finished, step]
}

export function dismissFinishedStep(finished: number[], step: number): number[] {
  return finished.filter((s) => s !== step)
}
