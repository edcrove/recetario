import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { deltaStatus, deltaLabel } from '../utils/nutritionGoals'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

/**
 * Compact per-day macro rollup for the planner: total calories and, when a
 * daily target is set, how far over/under it lands — the "cuánto me paso o
 * falta" signal. Each day renders its own instance (one cached query per day).
 */
export function DayNutritionSummary({ date }: { date: string }) {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const STATUS_COLOR = {
    ok: colors.sage,
    under: colors.inkSoft,
    over: colors.terracotta,
    none: colors.inkSoft,
  } as const
  const { data } = useQuery({
    queryKey: ['day-nutrition', date],
    queryFn: () => api.menu.dayNutrition(date),
  })

  if (!data || data.totals.calories === 0) return null

  const calDelta = data.delta?.calories ?? null
  const calTarget = data.target?.calories ?? 0
  const status = deltaStatus(calDelta, calTarget)
  const label = deltaLabel(calDelta, calTarget)

  return (
    <View testID={`day-nutrition-${date}`} style={s.row}>
      <Text style={s.totals}>
        {data.totals.calories} kcal · {data.totals.protein_g}P · {data.totals.carbs_g}C ·{' '}
        {data.totals.fat_g}G
      </Text>
      {label ? <Text style={[s.delta, { color: STATUS_COLOR[status] }]}>{label}</Text> : null}
      {data.partial ? <Text style={s.partial}>datos incompletos</Text> : null}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { marginTop: 2, marginBottom: 6 },
    totals: { fontSize: 12, color: c.inkSoft, fontVariant: ['tabular-nums'] },
    delta: { fontSize: 12, fontWeight: '600', marginTop: 1, color: c.ink },
    partial: { fontSize: 11, color: c.terracotta, marginTop: 1 },
  })
