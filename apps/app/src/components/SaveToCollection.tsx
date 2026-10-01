import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { notify } from '../utils/platformAlert'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

/** "Guardar en colección": pick one of the user's collections or create one inline. */
export function SaveToCollection({ recipeId }: { recipeId: string }) {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [savedIn, setSavedIn] = useState<string | null>(null)

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.taxonomy.collections(),
    enabled: open,
  })

  const saveMutation = useMutation({
    mutationFn: async (target: { id?: string; name: string }) => {
      const collectionId =
        target.id ?? (await api.taxonomy.createCollection({ name: target.name })).id
      await api.taxonomy.addToCollection(collectionId, recipeId)
      return { collectionId, name: target.name }
    },
    onSuccess: ({ collectionId, name }) => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
      void queryClient.invalidateQueries({ queryKey: ['collection-recipes', collectionId] })
      setSavedIn(name)
      setNewName('')
      setOpen(false)
    },
    onError: () => notify('Error', 'No se pudo guardar la receta en la colección.'),
  })

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        testID="recipe-save-to-collection"
        style={s.toggle}
        onPress={() => {
          setOpen(!open)
          setSavedIn(null)
        }}
      >
        <Text style={s.toggleText}>📋 Guardar en colección</Text>
      </TouchableOpacity>

      {savedIn && (
        <Text testID="collection-saved-msg" style={s.saved}>
          ✓ Guardada en {savedIn}
        </Text>
      )}

      {open && (
        <View testID="collection-picker" style={s.panel}>
          {collections.map((col) => (
            <TouchableOpacity
              key={col.id}
              testID={`collection-pick-${col.id}`}
              style={s.option}
              disabled={saveMutation.isPending}
              onPress={() => saveMutation.mutate({ id: col.id, name: col.name })}
            >
              <Text style={s.optionText}>
                {col.emoji ?? '📋'} {col.name}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={s.newRow}>
            <TextInput
              testID="collection-new-name"
              placeholderTextColor={colors.inkSoft}
              style={s.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nueva colección"
            />
            <TouchableOpacity
              testID="collection-new-save"
              style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
              disabled={!newName.trim() || saveMutation.isPending}
              onPress={() => saveMutation.mutate({ name: newName.trim() })}
            >
              <Text style={s.createBtnText}>Crear y guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { marginTop: 8, marginBottom: 4 },
    toggle: { alignSelf: 'flex-start', paddingVertical: 6 },
    toggleText: { color: c.terracotta, fontWeight: '600' },
    saved: { color: c.inkSoft, fontSize: 13, marginTop: 2 },
    panel: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      padding: 8,
      backgroundColor: c.surface,
      gap: 4,
    },
    option: { paddingVertical: 8, paddingHorizontal: 6 },
    optionText: { color: c.ink, fontSize: 15 },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 8,
      color: c.ink,
      backgroundColor: c.surface,
    },
    createBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: c.terracottaInk, fontWeight: '700', fontSize: 13 },
  })
