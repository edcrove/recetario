/**
 * Turns the client's `API <status>: <json>` error into text a person can read:
 * the validation details when the API sent them, else its `error` field.
 * Anything else (network errors, plain messages) passes through.
 */
export function apiErrorMessage(message: string): string {
  const m = /^API (\d+): (.*)$/s.exec(message)
  if (!m) return message
  try {
    const body = JSON.parse(m[2]!) as {
      error?: string
      details?: Array<{ message?: string }>
    }
    const details = (body.details ?? []).map((d) => d.message).filter(Boolean)
    if (details.length > 0) return details.join('\n')
    if (body.error) return body.error
  } catch {
    // not JSON — fall through
  }
  return `Error del servidor (${m[1]})`
}
