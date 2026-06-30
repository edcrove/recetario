export function cookModeNav(total: number, current: number) {
  return {
    isFirst: current === 0,
    isLast: current === total - 1,
    actionLabel: current === total - 1 ? 'Finalizar' : 'Siguiente',
    next: current < total - 1 ? current + 1 : current,
    prev: current > 0 ? current - 1 : current,
  }
}
