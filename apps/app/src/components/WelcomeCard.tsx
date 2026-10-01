import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors, fonts, type ThemeColors } from '../theme/tokens'

/**
 * First-run guidance on an empty home: what Recetario is for and the three
 * ways to get started (write a recipe, copy one from the library, set the
 * profile that drives allergen warnings and nutrition goals).
 */
export function WelcomeCard() {
  const c = useThemeColors()
  const s = makeStyles(c)
  const router = useRouter()
  const steps = [
    { id: 'new-recipe', label: '+ Cargar tu primera receta', route: '/recipe/new' },
    { id: 'library', label: '📚 Copiar recetas de la Biblioteca', route: '/library' },
    { id: 'profile', label: '👤 Contar tus alergias y objetivos', route: '/profile' },
  ] as const
  return (
    <View testID="welcome-card" style={s.card}>
      <Text style={s.title}>¡Bienvenido a Recetario!</Text>
      <Text style={s.body}>
        Guardá tus recetas, planificá el menú de la semana y armá la lista de compras sola. Para
        empezar:
      </Text>
      {steps.map((step) => (
        <TouchableOpacity
          key={step.id}
          testID={`welcome-${step.id}`}
          accessibilityRole="button"
          style={s.step}
          onPress={() => router.push(step.route as never)}
        >
          <Text style={s.stepText}>{step.label}</Text>
        </TouchableOpacity>
      ))}
      <Text style={s.hint}>
        También podés pedirle a tu asistente de IA que cargue recetas por vos desde una página web.
      </Text>
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: 16,
      padding: 18,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      gap: 10,
    },
    title: { fontSize: 20, fontWeight: '700', color: c.ink, fontFamily: fonts.display },
    body: { fontSize: 14, lineHeight: 20, color: c.inkSoft },
    step: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: c.sand,
    },
    stepText: { fontSize: 15, fontWeight: '600', color: c.ink },
    hint: { fontSize: 12, color: c.inkSoft, marginTop: 2 },
  })
