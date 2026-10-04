/** The new password rule shared with the API (z.string().min(8)). */
export const MIN_PASSWORD_LENGTH = 8

export function canChangePassword(current: string, next: string): boolean {
  return current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next !== current
}

/**
 * What to tell the person about a change-password attempt: the API's 403/400
 * in Spanish, or a hint while the new password is still too short.
 */
export function passwordChangeError(error: Error | null, next: string): string | undefined {
  if (error) {
    const status = /^API (\d+):/.exec(error.message)?.[1]
    if (status === '403') return 'La contraseña actual no es correcta.'
    if (status === '400')
      return 'La nueva contraseña tiene que ser distinta y de 8 caracteres o más.'
    if (status === '429') return 'Demasiados intentos. Esperá un minuto y probá de nuevo.'
    return 'No se pudo cambiar la contraseña. Probá de nuevo.'
  }
  if (next.length > 0 && next.length < MIN_PASSWORD_LENGTH)
    return `La nueva contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  return undefined
}
