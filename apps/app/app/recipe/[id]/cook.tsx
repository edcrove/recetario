import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../src/api/client'

export default function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  if (isLoading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" style={s.loader} />
      </SafeAreaView>
    )

  const steps = recipe?.steps ?? []
  const total = steps.length
  const current = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

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
        {current?.durationMin != null && <Text style={s.duration}>{current.durationMin} min</Text>}
      </View>

      <View style={s.nav}>
        <TouchableOpacity
          style={[s.navBtn, isFirst && s.navBtnDisabled]}
          onPress={() => setStepIndex((i) => i - 1)}
          disabled={isFirst}
        >
          <Text style={[s.navBtnText, isFirst && s.navBtnTextDisabled]}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.navBtn, s.navBtnPrimary]}
          onPress={() => (isLast ? router.back() : setStepIndex((i) => i + 1))}
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
  duration: {
    marginTop: 24,
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '500',
  },
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
