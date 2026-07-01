import { View, Text, StyleSheet } from 'react-native'

interface MacroBarProps {
  label: string
  value: number
  unit: string
  color: string
  target?: number
}

function MacroBar({ label, value, unit, color, target }: MacroBarProps) {
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
  targets,
  label,
}: Props) {
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
          color="#2563eb"
          target={targets?.daily_protein_g}
        />
        <MacroBar
          label="Carbos"
          value={carbs_g}
          unit="g"
          color="#16a34a"
          target={targets?.daily_carbs_g}
        />
        <MacroBar
          label="Grasa"
          value={fat_g}
          unit="g"
          color="#ea580c"
          target={targets?.daily_fat_g}
        />
        {fiber_g != null && <MacroBar label="Fibra" value={fiber_g} unit="g" color="#7c3aed" />}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginVertical: 8 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  caloriesRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  caloriesValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  caloriesUnit: { fontSize: 14, color: '#6b7280' },
  caloriesTarget: { fontSize: 12, color: '#9ca3af' },
  macros: { flexDirection: 'row', gap: 8 },
  macroItem: { flex: 1, alignItems: 'center', gap: 2 },
  macroLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  macroValue: { fontSize: 14, fontWeight: '700' },
  barBg: { width: '100%', height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginTop: 2 },
  barFill: { height: 4, borderRadius: 2 },
})
