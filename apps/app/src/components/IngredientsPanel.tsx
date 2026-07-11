import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { notify } from '../utils/platformAlert'
import { groupCanonicals } from '../utils/ingredientGroups'
import { useThemeColors, fonts, type ThemeColors } from '../theme/tokens'

/**
 * Config tab to review how ingredients unify: canonicals grouped by family with
 * their synonyms as chips, a search box, and two curation actions — create a
 * canonical, and move a synonym to a different canonical (to fix a wrong merge).
 */
export function IngredientsPanel() {
  const c = useThemeColors()
  const s = makeStyles(c)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  // The synonym currently being moved (tap a chip to pick it, then a target).
  const [moving, setMoving] = useState<{ synonym: string; fromId: string } | null>(null)

  const { data: canonicals = [], isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.ingredients.list(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ingredients'] })

  const create = useMutation({
    mutationFn: (name: string) => api.ingredients.createCanonical(name),
    onSuccess: () => {
      setNewName('')
      void invalidate()
    },
    onError: () => notify('Error', 'No se pudo crear el ingrediente.'),
  })

  const move = useMutation({
    mutationFn: ({ synonym, canonicalId }: { synonym: string; canonicalId: string }) =>
      api.ingredients.moveSynonym(synonym, canonicalId),
    onSuccess: () => {
      setMoving(null)
      void invalidate()
    },
    onError: () => notify('Error', 'No se pudo mover el sinónimo.'),
  })

  if (isLoading)
    return (
      <View style={s.center}>
        <Text style={s.muted}>Cargando…</Text>
      </View>
    )

  const groups = groupCanonicals(canonicals, search)

  return (
    <View style={s.container}>
      <TextInput
        testID="ingredients-search"
        style={s.search}
        placeholder="Buscar ingrediente o sinónimo…"
        placeholderTextColor={c.inkSoft}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      <View style={s.newRow}>
        <TextInput
          testID="ingredients-new-name"
          style={s.newInput}
          placeholder="Nuevo canónico…"
          placeholderTextColor={c.inkSoft}
          value={newName}
          onChangeText={setNewName}
          autoCorrect={false}
        />
        <TouchableOpacity
          testID="ingredients-new-create"
          style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
          disabled={!newName.trim()}
          onPress={() => create.mutate(newName.trim())}
        >
          <Text style={s.createBtnText}>Crear</Text>
        </TouchableOpacity>
      </View>

      {moving && (
        <View testID="ingredients-moving-banner" style={s.movingBanner}>
          <Text style={s.movingText}>Moviendo “{moving.synonym}” — elegí el canónico destino</Text>
          <TouchableOpacity testID="ingredients-move-cancel" onPress={() => setMoving(null)}>
            <Text style={s.movingCancel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list}>
        {groups.length === 0 && <Text style={s.muted}>Sin resultados.</Text>}
        {groups.map((group) => (
          <View key={group.family} style={s.group}>
            <Text style={s.groupTitle}>{group.family}</Text>
            {group.canonicals.map((canon) => (
              <View key={canon.id} testID={`ingredients-canonical-${canon.id}`} style={s.canonRow}>
                <View style={s.canonHeader}>
                  <Text style={s.canonName}>{canon.name}</Text>
                  {moving && moving.fromId !== canon.id && (
                    <TouchableOpacity
                      testID={`ingredients-move-here-${canon.id}`}
                      style={s.moveHereBtn}
                      onPress={() =>
                        move.mutate({ synonym: moving.synonym, canonicalId: canon.id })
                      }
                    >
                      <Text style={s.moveHereText}>Mover aquí</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {canon.synonyms.length > 0 && (
                  <View style={s.chips}>
                    {canon.synonyms.map((syn) => (
                      <TouchableOpacity
                        key={syn.id}
                        testID={`ingredients-synonym-${syn.id}`}
                        style={[s.chip, moving?.synonym === syn.synonym && s.chipActive]}
                        onPress={() => setMoving({ synonym: syn.synonym, fromId: canon.id })}
                      >
                        <Text style={s.chipText}>{syn.synonym}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { padding: 24, alignItems: 'center' },
    muted: { color: c.inkSoft },
    search: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      margin: 12,
      marginBottom: 6,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    newRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    newInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    createBtn: {
      paddingHorizontal: 16,
      justifyContent: 'center',
      backgroundColor: c.terracotta,
      borderRadius: 8,
    },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: c.terracottaInk, fontWeight: '700' },
    movingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 6,
      padding: 10,
      backgroundColor: c.sageSoft,
      borderRadius: 8,
    },
    movingText: { color: c.ink, flex: 1, fontSize: 13 },
    movingCancel: { color: c.terracotta, fontWeight: '700' },
    list: { padding: 12, paddingTop: 4, paddingBottom: 32 },
    group: { marginBottom: 16 },
    groupTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.terracotta,
      fontFamily: fonts.display,
      marginBottom: 6,
    },
    canonRow: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      marginBottom: 8,
    },
    canonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    canonName: { fontSize: 15, fontWeight: '600', color: c.ink, fontFamily: fonts.display },
    moveHereBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.sage,
      borderRadius: 8,
    },
    moveHereText: { color: c.surface, fontWeight: '700', fontSize: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: c.sand,
      borderWidth: 1,
      borderColor: c.line,
    },
    chipActive: { backgroundColor: c.terracottaSoft, borderColor: c.terracotta },
    chipText: { fontSize: 13, color: c.inkSoft },
  })
