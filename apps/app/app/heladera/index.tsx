import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import { macroStrip } from '../../src/utils/macroStrip'
import { splitSuggestions, type Suggestion } from '../../src/utils/fridgeSections'
import { getWeekStart } from '../../src/utils/weekMath'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

type Tab = 'cocinar' | 'semana'

export default function HeladeraScreen() {
  const c = useThemeColors()
  const s = makeStyles(c)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('cocinar')
  const [have, setHave] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const addHave = (name: string) => {
    const n = name.trim()
    if (n && !have.some((h) => h.toLowerCase() === n.toLowerCase())) setHave([...have, n])
    setDraft('')
  }

  // Pantry in-stock names offered as quick-add chips.
  const { data: pantry = [] } = useQuery({ queryKey: ['pantry'], queryFn: () => api.pantry.list() })
  const pantryChips = pantry
    .filter((p) => p.inStock && !have.some((h) => h.toLowerCase() === p.name.toLowerCase()))
    .slice(0, 8)

  // Today's remaining goal drives the goalFit badge on each card.
  const today = new Date().toISOString().slice(0, 10)
  const suggestions = useQuery({
    queryKey: ['suggestions', have],
    queryFn: () => api.suggestions.fromIngredients({ ingredients: have, date: today }),
    enabled: tab === 'cocinar' && have.length > 0,
  })

  const weekStart = getWeekStart(new Date())
  const gap = useQuery({
    queryKey: ['menu-gap', weekStart],
    queryFn: () => api.menu.missingIngredients(weekStart),
    enabled: tab === 'semana',
  })

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>¿Qué cocino?</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>‹ Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        {(
          [
            ['cocinar', 'Cocinar ahora'],
            ['semana', 'Tu semana'],
          ] as const
        ).map(([t, label]) => (
          <TouchableOpacity
            key={t}
            testID={`heladera-tab-${t}`}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'cocinar' ? (
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.addRow}>
            <TextInput
              testID="heladera-input"
              style={s.input}
              placeholder="Tengo… (ej: pollo, arroz)"
              placeholderTextColor={c.inkSoft}
              value={draft}
              onChangeText={setDraft}
              autoCorrect={false}
            />
            <TouchableOpacity
              testID="heladera-add"
              style={[s.addBtn, !draft.trim() && s.addBtnDisabled]}
              disabled={!draft.trim()}
              onPress={() => addHave(draft)}
            >
              <Text style={s.addBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {pantryChips.length > 0 && (
            <View style={s.chipsWrap}>
              <Text style={s.chipsLabel}>De tu despensa:</Text>
              <View style={s.chips}>
                {pantryChips.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    testID={`heladera-pantry-chip-${p.id}`}
                    style={s.pantryChip}
                    onPress={() => addHave(p.name)}
                  >
                    <Text style={s.pantryChipText}>+ {p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {have.length > 0 && (
            <View style={s.chips}>
              {have.map((h) => (
                <TouchableOpacity
                  key={h}
                  testID={`heladera-have-${h.toLowerCase()}`}
                  style={s.haveChip}
                  onPress={() => setHave(have.filter((x) => x !== h))}
                >
                  <Text style={s.haveChipText}>{h} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {have.length === 0 ? (
            <Text style={s.empty}>
              Escribí lo que tenés en casa y te digo qué podés cocinar ahora mismo.
            </Text>
          ) : suggestions.isLoading ? (
            <ActivityIndicator style={s.loader} />
          ) : (
            <Results
              styles={s}
              onOpen={(id) => router.push(`/recipe/${id}`)}
              suggestions={suggestions.data ?? []}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {gap.isLoading ? (
            <ActivityIndicator style={s.loader} />
          ) : (
            <>
              {(gap.data?.meals.length ?? 0) === 0 ? (
                <Text style={s.empty}>
                  Planificá tu semana en el menú y acá te digo qué comidas ya podés cocinar y qué
                  falta comprar.
                </Text>
              ) : (
                gap.data!.meals.map((m, i) => (
                  <View
                    key={`${m.date}-${m.slot}-${i}`}
                    testID={`heladera-meal-${i}`}
                    style={s.card}
                  >
                    <View style={s.mealHeader}>
                      <Text style={s.cardTitle}>{m.recipeName ?? 'Receta'}</Text>
                      <Text style={[s.pill, m.cookable ? s.pillOk : s.pillWarn]}>
                        {m.cookable ? 'Cocinable' : 'Incompleta'}
                      </Text>
                    </View>
                    {m.missingIngredients.length > 0 && (
                      <Text style={s.missing}>falta: {m.missingIngredients.join(', ')}</Text>
                    )}
                  </View>
                ))
              )}
              {(gap.data?.missing.length ?? 0) > 0 && (
                <TouchableOpacity
                  testID="heladera-add-to-list"
                  style={s.listBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/menu/shopping-list',
                      params: { weekStart },
                    } as never)
                  }
                >
                  <Text style={s.listBtnText}>🛒 Agregar faltantes a la lista de compras</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function Results({
  suggestions,
  onOpen,
  styles: s,
}: {
  suggestions: Suggestion[]
  onOpen: (id: string) => void
  styles: ReturnType<typeof makeStyles>
}) {
  const { cookable, almost } = splitSuggestions(suggestions)
  if (cookable.length === 0 && almost.length === 0)
    return <Text style={s.empty}>Con eso no encontré recetas. Probá agregar algo más.</Text>
  return (
    <View>
      {cookable.length > 0 && (
        <View testID="heladera-cookable">
          <Text style={s.sectionTitle}>Podés cocinar ya</Text>
          {cookable.map((r) => (
            <Card key={r.id} r={r} onOpen={onOpen} styles={s} />
          ))}
        </View>
      )}
      {almost.length > 0 && (
        <View testID="heladera-almost">
          <Text style={s.sectionTitle}>Te falta poco</Text>
          {almost.map((r) => (
            <Card key={r.id} r={r} onOpen={onOpen} styles={s} />
          ))}
        </View>
      )}
    </View>
  )
}

function Card({
  r,
  onOpen,
  styles: s,
}: {
  r: Suggestion
  onOpen: (id: string) => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <TouchableOpacity
      testID={`heladera-recipe-${r.id}`}
      style={s.card}
      onPress={() => onOpen(r.id)}
    >
      <Text style={s.cardTitle}>{r.title}</Text>
      {macroStrip(r.nutrition) ? <Text style={s.macros}>{macroStrip(r.nutrition)}</Text> : null}
      {r.missingIngredients.length > 0 && (
        <Text style={s.missing}>falta: {r.missingIngredients.join(', ')}</Text>
      )}
      {r.goalFit === 'dentro' && (
        <Text testID={`heladera-goalfit-${r.id}`} style={s.goalBadge}>
          En tu objetivo
        </Text>
      )}
    </TouchableOpacity>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    title: { fontSize: 22, fontWeight: '700', fontFamily: fonts.display, color: c.ink },
    backLink: { color: c.terracotta, fontWeight: '600' },
    tabBar: { flexDirection: 'row', gap: 8, padding: 12 },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.sand,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: c.terracotta },
    tabText: { color: c.inkSoft, fontWeight: '700' },
    tabTextActive: { color: c.terracottaInk },
    body: { paddingHorizontal: 12, paddingBottom: 32 },
    addRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    addBtn: {
      paddingHorizontal: 16,
      justifyContent: 'center',
      backgroundColor: c.terracotta,
      borderRadius: 8,
    },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { color: c.terracottaInk, fontWeight: '700' },
    chipsWrap: { marginBottom: 8 },
    chipsLabel: { fontSize: 12, color: c.inkSoft, marginBottom: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    pantryChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: c.sageSoft,
      borderWidth: 1,
      borderColor: c.sage,
    },
    pantryChipText: { fontSize: 13, color: c.sage, fontWeight: '600' },
    haveChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: c.terracottaSoft,
      borderWidth: 1,
      borderColor: c.terracotta,
    },
    haveChipText: { fontSize: 13, color: c.terracotta, fontWeight: '700' },
    loader: { marginTop: 24 },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 32, paddingHorizontal: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.terracotta,
      fontFamily: fonts.display,
      marginTop: 16,
      marginBottom: 6,
    },
    card: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      marginBottom: 8,
    },
    mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: c.ink, fontFamily: fonts.display },
    macros: { color: c.sage, marginTop: 3, fontSize: 12, fontVariant: ['tabular-nums'] },
    missing: { color: c.inkSoft, marginTop: 4, fontSize: 13 },
    goalBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      fontSize: 11,
      fontWeight: '700',
      color: c.sage,
      backgroundColor: c.sageSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    pill: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    pillOk: { backgroundColor: c.sageSoft, color: c.sage },
    pillWarn: { backgroundColor: c.terracottaSoft, color: c.terracotta },
    listBtn: {
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.terracotta,
      alignItems: 'center',
    },
    listBtnText: { color: c.terracottaInk, fontWeight: '700' },
  })
