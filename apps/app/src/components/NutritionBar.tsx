import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors, type ThemeColors } from '../theme/tokens'
import { extraNutrientsLine } from '../utils/nutritionDisplay'

interface MacroBarProps {
  label: string
  value: number
  unit: string
  color: string
  target?: number
}

function MacroBar({ label, value, unit, color, target }: MacroBarProps) {
  const s = makeStyles(useThemeColors())
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null
  return (
    <View style={s.macroItem}>
      <Text style={s.macroLabel}>{label}</Text>
      <Text style={[s.macroValue, { color }]}>
        {value}
        {unit}
      </Text>
      {pct !== null && (
        <View style={s.barBg}>
          <View style={[s.barFill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  )
}

interface Props {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugars_g?: number
  saturated_fat_g?: number
  sodium_mg?: number
  targets?: {
    daily_calories: number
    daily_protein_g: number
    daily_carbs_g: number
    daily_fat_g: number
  } | null
  label?: string
}

export function NutritionBar({
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  sugars_g,
  saturated_fat_g,
  sodium_mg,
  targets,
  label,
}: Props) {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  return (
    <View style={s.container}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={s.caloriesRow}>
        <Text style={s.caloriesValue}>{calories}</Text>
        <Text style={s.caloriesUnit}> kcal</Text>
        {targets && <Text style={s.caloriesTarget}> / {targets.daily_calories} objetivo</Text>}
      </View>
      <View style={s.macros}>
        <MacroBar
          label="Proteína"
          value={protein_g}
          unit="g"
          color={colors.terracotta}
          target={targets?.daily_protein_g}
        />
        <MacroBar
          label="Carbos"
          value={carbs_g}
          unit="g"
          color={colors.sage}
          target={targets?.daily_carbs_g}
        />
        <MacroBar
          label="Grasa"
          value={fat_g}
          unit="g"
          color={colors.warning}
          target={targets?.daily_fat_g}
        />
        {fiber_g != null && (
          <MacroBar label="Fibra" value={fiber_g} unit="g" color={colors.inkSoft} />
        )}
      </View>
      {extraNutrientsLine({ sugars_g, saturated_fat_g, sodium_mg }) ? (
        <Text testID="nutrition-extras" style={s.extras}>
          {extraNutrientsLine({ sugars_g, saturated_fat_g, sodium_mg })}
        </Text>
      ) : null}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { backgroundColor: c.surface, borderRadius: 10, padding: 12, marginVertical: 8 },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: c.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    caloriesRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
    caloriesValue: { fontSize: 28, fontWeight: '800', color: c.ink },
    caloriesUnit: { fontSize: 14, color: c.inkSoft },
    caloriesTarget: { fontSize: 12, color: c.inkSoft },
    macros: { flexDirection: 'row', gap: 8 },
    macroItem: { flex: 1, alignItems: 'center', gap: 2 },
    macroLabel: { fontSize: 10, color: c.inkSoft, fontWeight: '600' },
    macroValue: { fontSize: 14, fontWeight: '700', color: c.ink },
    barBg: { width: '100%', height: 4, backgroundColor: c.line, borderRadius: 2, marginTop: 2 },
    barFill: { height: 4, borderRadius: 2 },
    extras: { fontSize: 12, color: c.inkSoft, marginTop: 8, fontVariant: ['tabular-nums'] },
  })
