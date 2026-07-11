import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { notify } from '../../src/utils/platformAlert'
import { useThemeColors, type ThemeColors } from '../../src/theme/tokens'

export default function CollectionsScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.taxonomy.collections(),
  })

  const create = useMutation({
    mutationFn: () =>
      api.taxonomy.createCollection({ name: newName.trim(), emoji: newEmoji.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
      setNewName('')
      setNewEmoji('')
    },
    onError: () => notify('Error', 'No se pudo crear la colección.'),
  })

  if (isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  return (
    <View style={s.container}>
      {/* Create new */}
      <View style={s.createRow}>
        <TextInput
          placeholderTextColor={colors.inkSoft}
          style={[s.input, { width: 44 }]}
          placeholder="🍳"
          value={newEmoji}
          onChangeText={setNewEmoji}
          maxLength={2}
        />
        <TextInput
          placeholderTextColor={colors.inkSoft}
          style={[s.input, { flex: 1 }]}
          placeholder="Nueva colección…"
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity
          style={[s.addBtn, !newName.trim() && s.addBtnDisabled]}
          disabled={!newName.trim() || create.isPending}
          onPress={() => create.mutate()}
        >
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>Sin colecciones. ¡Creá una arriba!</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              router.push({
                pathname: '/collections/[id]',
                params: { id: item.id, name: item.name },
              } as never)
            }
          >
            <Text style={s.cardEmoji}>{item.emoji ?? '📋'}</Text>
            <View style={s.cardInfo}>
              <Text style={s.cardName}>{item.name}</Text>
              <Text style={s.cardCount}>
                {item.recipeCount} receta{item.recipeCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    createRow: {
      flexDirection: 'row',
      gap: 8,
      padding: 16,
      borderBottomWidth: 1,
      borderColor: c.sand,
    },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    addBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    addBtnDisabled: { opacity: 0.4 },
    addBtnText: { color: c.surface, fontSize: 22, fontWeight: '700' },
    list: { padding: 16, gap: 8 },
    empty: { color: c.inkSoft, textAlign: 'center', marginTop: 32, fontSize: 14 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      gap: 12,
    },
    cardEmoji: { fontSize: 28, color: c.ink },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontWeight: '600', color: c.ink },
    cardCount: { fontSize: 13, color: c.inkSoft, marginTop: 2 },
    chevron: { fontSize: 20, color: c.inkSoft },
  })
