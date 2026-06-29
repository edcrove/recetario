import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../src/api/client'
import { useStepTimer, formatTime } from '../../../src/hooks/useStepTimer'

export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  const steps = recipe?.steps ?? []
  const current = steps[stepIndex]

  const handleTimerComplete = useCallback(() => {
    Vibration.vibrate([0, 400, 200, 400])
    Alert.alert('¡Tiempo!', 'El tiempo de este paso ha terminado.')
  }, [])

  const { secondsLeft, isRunning, toggle, reset } = useStepTimer(
    current?.durationMin ?? null,
    handleTimerComplete,
  )

  if (isLoading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" style={s.loader} />
      </SafeAreaView>
    )

  const total = steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  const goTo = (index: number) => setStepIndex(index)

  if (total === 0)
    return (
      <SafeAreaView style={s.container}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.center}>
          <Text style={s.emptyText}>Esta receta no tiene pasos.</Text>
        </View>
      </SafeAreaView>
    )

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.counter}>
          Paso {stepIndex + 1} / {total}
        </Text>
        <View style={s.closePlaceholder} />
      </View>

      <View style={s.body}>
        <Text style={s.stepText}>{current?.text}</Text>

        {current?.durationMin != null && (
          <View style={s.timerRow}>
            <Text style={[s.timerChip, secondsLeft === 0 && s.timerChipDone]}>
              {formatTime(secondsLeft)}
            </Text>
            <TouchableOpacity style={s.timerBtn} onPress={toggle}>
              <Text style={s.timerBtnText}>{isRunning ? 'Pausar' : 'Reanudar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.timerBtn} onPress={reset}>
              <Text style={s.timerBtnText}>↺</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.nav}>
        <TouchableOpacity
          style={[s.navBtn, isFirst && s.navBtnDisabled]}
          onPress={() => goTo(stepIndex - 1)}
          disabled={isFirst}
        >
          <Text style={[s.navBtnText, isFirst && s.navBtnTextDisabled]}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.navBtn, s.navBtnPrimary]}
          onPress={() => (isLast ? router.back() : goTo(stepIndex + 1))}
        >
          <Text style={[s.navBtnText, s.navBtnTextPrimary]}>
            {isLast ? 'Finalizar' : 'Siguiente'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#6b7280', textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 20, color: '#6b7280' },
  closePlaceholder: { width: 36 },
  counter: { fontSize: 15, fontWeight: '600', color: '#374151' },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  stepText: { fontSize: 22, lineHeight: 34, color: '#111827' },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    gap: 10,
  },
  timerChip: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#2563eb',
    minWidth: 80,
  },
  timerChipDone: { color: '#ef4444' },
  timerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  timerBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  nav: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnPrimary: { backgroundColor: '#2563eb' },
  navBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  navBtnTextDisabled: { color: '#9ca3af' },
  navBtnTextPrimary: { color: '#fff' },
})
