import { Alert, Platform } from 'react-native'

/**
 * react-native-web's Alert.alert() is a documented no-op (`static alert() {}`).
 * These helpers fall back to window.confirm/alert on web so confirm dialogs
 * and error notifications actually work in the browser build.
 */

export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}

export function notify(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}
