import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme/tokens'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return (
        <View style={s.container} testID="error-boundary-fallback">
          <Text style={s.title}>Algo salió mal</Text>
          <Text style={s.message}>
            La app tuvo un error inesperado. Podés intentar de nuevo o reiniciarla.
          </Text>
          <TouchableOpacity testID="error-boundary-retry" style={s.button} onPress={this.reset}>
            <Text style={s.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.paper,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  message: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginBottom: 20 },
  button: {
    backgroundColor: colors.terracotta,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: colors.terracottaInk, fontWeight: '600', fontSize: 15 },
})
