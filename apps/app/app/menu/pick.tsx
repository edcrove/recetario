import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api } from '../../src/api/client'
import { notify } from '../../src/utils/platformAlert'
import { AllergenBadge } from '../../src/components/AllergenBadge'
import type { Recipe } from '@recetario/shared'
import { macroStrip } from '../../src/utils/macroStrip'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function PickRecipeScreen() {
  const colors = useThemeColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { date, slot, weekStart } = useLocalSearchParams<{
    date: string
    slot: string
    weekStart: string
  }>()
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState(2)

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes', query],
    queryFn: () =>
      query.trim() ? api.recipes.search({ q: query }) : api.recipes.list({ limit: 50 }),
  })

  const addMutation = useMutation({
    mutationFn: (recipe: Recipe) =>
      api.menu.add({
        date: date ?? '',
        slot: slot ?? '',
        recipeId: recipe.id ?? '',
        servings,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] })
      router.back()
    },
    onError: () => notify('Error', 'No se pudo agregar la receta al menú.'),
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text testID="pick-header-slot-date" style={styles.subtitle}>
          {slot} · {date}
        </Text>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>Porciones:</Text>
          <TouchableOpacity
            style={styles.servingsBtn}
            onPress={() => setServings((v) => Math.max(1, v - 1))}
          >
            <Text style={styles.servingsBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.servingsValue}>{servings}</Text>
          <TouchableOpacity style={styles.servingsBtn} onPress={() => setServings((v) => v + 1)}>
            <Text style={styles.servingsBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={styles.search}
        placeholder="Buscar receta..."
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item: Recipe) => item.id ?? item.title}
          renderItem={({ item }: { item: Recipe }) => (
            <TouchableOpacity
              testID={`pick-recipe-${item.id}`}
              style={styles.card}
              onPress={() => addMutation.mutate(item)}
              disabled={addMutation.isPending}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <AllergenBadge recipe={item} />
              </View>
              <Text style={styles.cardMeta}>
                {item.category} · {item.servings} porc. base
                {item.totalTimeMin ? ` · ${item.totalTimeMin} min` : ''}
              </Text>
              {macroStrip(item.nutrition) ? (
                <Text style={styles.cardMacros}>{macroStrip(item.nutrition)}</Text>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{query ? 'Sin resultados' : 'No hay recetas aún'}</Text>
          }
        />
      )}

      {addMutation.isError && <Text style={styles.errorText}>Error al agregar al menú</Text>}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.line },
    subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: c.ink },
    servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    servingsLabel: { fontSize: 14, color: c.inkSoft, flex: 1 },
    servingsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.sand,
      justifyContent: 'center',
      alignItems: 'center',
    },
    servingsBtnText: { fontSize: 20, color: c.ink, lineHeight: 22 },
    servingsValue: {
      fontSize: 18,
      fontWeight: '700',
      color: c.ink,
      minWidth: 28,
      textAlign: 'center',
    },
    search: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      margin: 12,
      fontSize: 16,
      color: c.ink,
    },
    card: {
      padding: 16,
      borderRadius: 8,
      backgroundColor: c.surface,
      marginHorizontal: 12,
      marginBottom: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600',
      flex: 1,
      fontFamily: fonts.display,
      color: c.ink,
    },
    cardMeta: { color: c.inkSoft, marginTop: 4, fontSize: 13 },
    cardMacros: { color: c.sage, marginTop: 3, fontSize: 12, fontVariant: ['tabular-nums'] },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40 },
    errorText: { color: c.danger, textAlign: 'center', padding: 12 },
  })
