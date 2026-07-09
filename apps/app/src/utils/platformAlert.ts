import { Alert, Platform } from 'react-native'

/**
 * react-native-web's Alert.alert() is a documented no-op (`static alert() {}`).
 * These helpers fall back to window.confirm/alert on web so confirm dialogs
 * and error notifications actually work in the browser build.
 *
 * The native (non-web) branches are excluded from E2E coverage: chromium-based
 * Playwright E2E always runs with Platform.OS === 'web', so those paths are
 * structurally unreachable there. They are fully covered by unit tests
 * (platformAlert.test.ts), which mock Platform.OS.
 */

export function confirmAsync(title: string, message: string): Promise<boolean> {
  /* istanbul ignore else -- native path unreachable in chromium E2E; unit-tested */
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }
  /* istanbul ignore next -- native path unreachable in chromium E2E; unit-tested */
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export function notify(title: string, message: string): void {
  /* istanbul ignore else -- native path unreachable in chromium E2E; unit-tested */
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
    return
  }
  /* istanbul ignore next -- native path unreachable in chromium E2E; unit-tested */
  Alert.alert(title, message)
}
