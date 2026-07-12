import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../src/api/client'
import { useStepTimer, formatTime } from '../../../src/hooks/useStepTimer'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { IngredientChecklist } from '../../../src/components/IngredientChecklist'
import { onStepTimerComplete, startSpeech, stopSpeech } from '../../../src/utils/cookEffects'
import { cookModeNav } from '../../../src/utils/cookModeNav'
import { notify } from '../../../src/utils/platformAlert'
import { useThemeColors, fonts, type ThemeColors } from '../../../src/theme/tokens'

export default function CookModeScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [stepIndex, setStepIndex] = useState(0)
  const [tab, setTab] = useState<'steps' | 'ingredients'>('steps')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [ratingNote, setRatingNote] = useState('')

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  const logSessionMutation = useMutation({
    mutationFn: () =>
      api.cookSessions.log({
        recipeId: id,
        rating: rating ?? undefined,
        notes: ratingNote.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cook-sessions', id] })
      void queryClient.invalidateQueries({ queryKey: ['cook-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['cook-stats-suggestions'] })
      setShowRating(false)
      router.back()
    },
    onError: () => notify('Error', 'No se pudo guardar la sesión de cocina.'),
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
      stopSpeech()
      setIsSpeaking(false)
    } else if (current?.text) {
      const started = startSpeech(
        current.text,
        () => setIsSpeaking(false),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false),
      )
      if (started) setIsSpeaking(true)
    }
  }, [isSpeaking, current?.text])

  useEffect(() => {
    stopSpeech()
    setIsSpeaking(false)
  }, [stepIndex])

  const handleTimerComplete = useCallback(() => {
    onStepTimerComplete()
  }, [])

  const { secondsLeft, isRunning, started, toggle, reset } = useStepTimer(
    current?.durationSeconds ?? null,
    handleTimerComplete,
  )

  if (isLoading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" style={s.loader} />
      </SafeAreaView>
    )

  const total = steps.length
  const { isFirst, isLast, actionLabel } = cookModeNav(total, stepIndex)

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
          <TouchableOpacity testID="cook-speech-toggle" style={s.closeBtn} onPress={toggleSpeech}>
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
            testID={`cook-tab-${t}`}
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

          {current?.durationSeconds != null && (
            <View style={s.timerRow}>
              <Text testID="cook-timer" style={[s.timerChip, secondsLeft === 0 && s.timerChipDone]}>
                {formatTime(secondsLeft)}
              </Text>
              <TouchableOpacity testID="cook-timer-toggle" style={s.timerBtn} onPress={toggle}>
                <Text style={s.timerBtnText}>
                  {isRunning ? 'Pausar' : started ? 'Reanudar' : 'Iniciar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity testID="cook-timer-reset" style={s.timerBtn} onPress={reset}>
                <Text style={s.timerBtnText}>↺</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={s.nav}>
        <TouchableOpacity
          testID="cook-prev"
          style={[s.navBtn, isFirst && s.navBtnDisabled]}
          onPress={() => goTo(stepIndex - 1)}
          disabled={isFirst}
        >
          <Text style={[s.navBtnText, isFirst && s.navBtnTextDisabled]}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={isLast ? 'cook-finish' : 'cook-next'}
          style={[s.navBtn, s.navBtnPrimary]}
          onPress={() => (isLast ? setShowRating(true) : goTo(stepIndex + 1))}
        >
          <Text style={[s.navBtnText, s.navBtnTextPrimary]}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Rating modal shown after finishing */}
      <Modal visible={showRating} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>¿Cómo salió?</Text>
            <Text style={s.modalSub}>Calificá esta sesión de cocina</Text>

            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text style={[s.star, rating !== null && star <= rating && s.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholderTextColor={colors.inkSoft}
              style={s.noteInput}
              placeholder="Agregar nota (opcional)"
              value={ratingNote}
              onChangeText={setRatingNote}
              multiline
            />

            <TouchableOpacity
              testID="cook-rating-save"
              style={[s.modalBtn, logSessionMutation.isPending && s.modalBtnDisabled]}
              disabled={logSessionMutation.isPending}
              onPress={() => logSessionMutation.mutate()}
            >
              <Text style={s.modalBtnText}>
                {logSessionMutation.isPending ? 'Guardando…' : 'Guardar y terminar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="cook-rating-skip"
              style={s.skipBtn}
              onPress={() => {
                setShowRating(false)
                router.back()
              }}
            >
              <Text style={s.skipText}>Omitir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    loader: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyText: { fontSize: 16, color: c.inkSoft, textAlign: 'center' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.sand,
    },
    closeBtn: { padding: 8 },
    closeBtnText: { fontSize: 20, color: c.inkSoft },
    speakingIcon: { color: c.terracotta },
    closePlaceholder: { width: 36 },
    counter: { fontSize: 15, fontWeight: '600', color: c.ink },
    body: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 24,
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: c.sand,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: c.terracotta },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: c.inkSoft },
    tabBtnTextActive: { color: c.terracotta },
    stepText: { fontSize: 22, lineHeight: 34, color: c.ink },
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
      color: c.terracotta,
      minWidth: 80,
    },
    timerChipDone: { color: c.danger },
    timerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.sand,
      borderRadius: 8,
    },
    timerBtnText: { fontSize: 14, fontWeight: '600', color: c.ink },
    nav: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: c.sand,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: c.sand,
    },
    navBtnDisabled: { opacity: 0.35 },
    navBtnPrimary: { backgroundColor: c.terracotta },
    navBtnText: { fontSize: 16, fontWeight: '600', color: c.ink },
    navBtnTextDisabled: { color: c.inkSoft },
    navBtnTextPrimary: { color: c.surface },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 28,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: c.ink,
      textAlign: 'center',
      marginBottom: 4,
      fontFamily: fonts.display,
    },
    modalSub: { fontSize: 14, color: c.inkSoft, textAlign: 'center', marginBottom: 20 },
    stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
    star: { fontSize: 40, color: c.line },
    starActive: { color: '#f59e0b' },
    noteInput: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      minHeight: 72,
      textAlignVertical: 'top',
      marginBottom: 16,
      backgroundColor: c.surface,
      color: c.ink,
    },
    modalBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    modalBtnDisabled: { opacity: 0.6 },
    modalBtnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
    skipBtn: { alignItems: 'center', paddingVertical: 8 },
    skipText: { color: c.inkSoft, fontSize: 14 },
  })
