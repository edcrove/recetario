import { useState, useCallback, useEffect } from 'react'
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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { IngredientChecklist } from '../../../src/components/IngredientChecklist'
import * as Speech from 'expo-speech'

export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [tab, setTab] = useState<'steps' | 'ingredients'>('steps')
  const [isSpeaking, setIsSpeaking] = useState(false)

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  useEffect(() => {
    void activateKeepAwakeAsync()
    return () => {
      void deactivateKeepAwake()
    }
  }, [])

  const steps = recipe?.steps ?? []
  const current = steps[stepIndex]

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      void Speech.stop()
      setIsSpeaking(false)
    } else if (current?.text) {
      Speech.speak(current.text, {
        language: 'es',
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      })
      setIsSpeaking(true)
    }
  }, [isSpeaking, current?.text])

  useEffect(() => {
    void Speech.stop()
    setIsSpeaking(false)
  }, [stepIndex])

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
          {tab === 'steps' ? `Paso ${stepIndex + 1} / ${total}` : 'Ingredientes'}
        </Text>
        {tab === 'steps' ? (
          <TouchableOpacity style={s.closeBtn} onPress={toggleSpeech}>
            <Text style={[s.closeBtnText, isSpeaking && s.speakingIcon]}>
              {isSpeaking ? '🔊' : '🔈'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={s.closePlaceholder} />
        )}
      </View>

      <View style={s.tabBar}>
        {(['steps', 'ingredients'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === 'steps' ? 'Pasos' : 'Ingredientes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'ingredients' ? (
        <IngredientChecklist
          ingredients={recipe?.ingredients ?? []}
          baseServings={recipe?.servings ?? 1}
          targetServings={recipe?.servings ?? 1}
        />
      ) : (
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
      )}

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
  speakingIcon: { color: '#2563eb' },
  closePlaceholder: { width: 36 },
  counter: { fontSize: 15, fontWeight: '600', color: '#374151' },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#2563eb' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabBtnTextActive: { color: '#2563eb' },
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
