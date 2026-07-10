import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LibraryRecipe } from '@recetario/shared'
import { api } from '../../src/api/client'
import { confirmAsync, notify } from '../../src/utils/platformAlert'
import { colors } from '../../src/theme/tokens'

export default function LibraryScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['library', search],
    queryFn: () => api.library.list(search ? { search } : undefined),
  })

  const copyMutation = useMutation({
    mutationFn: (id: string) => api.recipes.copy(id),
    onSuccess: (fork) => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      notify('Receta copiada', 'Ya está en tu recetario. Podés editarla libremente.')
      if (fork.id) router.push(`/recipe/${fork.id}`)
    },
    onError: () => notify('Error', 'No se pudo copiar la receta.'),
  })

  async function handleCopy(recipe: LibraryRecipe) {
    const confirmed = await confirmAsync(
      'Copiar a mi recetario',
      `Se crea tu propia copia de "${recipe.title}". Tus cambios nunca tocan la receta original.`,
    )
    if (confirmed && recipe.id) copyMutation.mutate(recipe.id)
  }

  return (
    <View style={s.container}>
      <TextInput
        testID="library-search"
        style={s.search}
        placeholder="Buscar en la biblioteca…"
        placeholderTextColor={colors.inkSoft}
        value={search}
        onChangeText={setSearch}
      />

      {!isLoading && recipes.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>
            {search ? 'Sin resultados en la biblioteca' : 'La biblioteca está vacía'}
          </Text>
          <Text style={s.emptyBody}>
            Acá aparecen las recetas que la comunidad publica. Publicá una tuya desde el formulario
            de edición marcándola como pública.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item: LibraryRecipe) => item.id ?? item.title}
          contentContainerStyle={s.list}
          renderItem={({ item }: { item: LibraryRecipe }) => (
            <View testID={`library-recipe-${item.id}`} style={s.card}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardMeta}>
                {item.category} · {item.servings} porciones · por {item.author}
              </Text>
              {item.tags.length > 0 && <Text style={s.cardTags}>{item.tags.join(' · ')}</Text>}
              <TouchableOpacity
                testID={`library-copy-${item.id}`}
                style={s.copyBtn}
                disabled={copyMutation.isPending}
                onPress={() => void handleCopy(item)}
              >
                <Text style={s.copyBtnText}>Copiar a mi recetario</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 16 },
  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 11,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.ink,
    marginBottom: 12,
  },
  list: { paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  cardTags: { fontSize: 12, color: colors.sage, marginTop: 4 },
  copyBtn: {
    marginTop: 12,
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyBtnText: { color: colors.terracottaInk, fontWeight: '700', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 20 },
})
