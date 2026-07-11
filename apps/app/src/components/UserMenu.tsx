import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../providers/AuthProvider'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

interface Props {
  visible: boolean
  onClose: () => void
}

const MENU_ITEMS = [
  { icon: '👤', label: 'Mi perfil', description: 'Nombre y avatar', route: '/profile' },
  {
    icon: '🥗',
    label: 'Preferencias dietéticas',
    description: 'Restricciones y alérgenos',
    route: '/profile',
  },
  { icon: '🏠', label: 'Mi hogar', description: 'Miembros y roles', route: '/household' },
  { icon: '📋', label: 'Colecciones', description: 'Listas de recetas', route: '/collections' },
  { icon: '🧊', label: 'Despensa', description: 'Lo que tenés en casa', route: '/pantry' },
  {
    icon: '🌐',
    label: 'Biblioteca',
    description: 'Recetas públicas de la comunidad',
    route: '/library',
  },
  {
    icon: '📊',
    label: 'Estadísticas de cocina',
    description: 'Historial y tendencias',
    route: '/stats',
  },
  {
    icon: '⚙️',
    label: 'Configuración de taxonomía',
    description: 'Categorías, tipos y etiquetas',
    route: '/config',
  },
] as const

export function UserMenu({ visible, onClose }: Props) {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const { signOut } = useAuth()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    enabled: visible,
  })

  function navigate(route: string) {
    onClose()
    router.push(route as never)
  }

  async function handleSignOut() {
    onClose()
    await signOut()
    router.replace('/auth/login')
  }

  const initials = user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        testID="usermenu-backdrop"
        style={s.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* User header */}
        <View style={s.header}>
          {isLoading ? (
            <ActivityIndicator style={s.avatar} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={s.headerInfo}>
            <Text style={s.userName} numberOfLines={1}>
              {user?.displayName ?? 'Mi cuenta'}
            </Text>
            <Text style={s.userEmail} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.route + item.label}
              testID={`usermenu-item-${i}`}
              style={s.item}
              onPress={() => navigate(item.route)}
            >
              <Text style={s.itemIcon}>{item.icon}</Text>
              <View style={s.itemContent}>
                <Text style={s.itemLabel}>{item.label}</Text>
                <Text style={s.itemDesc}>{item.description}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={s.divider} />

          {/* Sign out */}
          <TouchableOpacity
            testID="usermenu-signout"
            style={[s.item, s.signOutItem]}
            onPress={handleSignOut}
          >
            <Text style={s.itemIcon}>🚪</Text>
            <Text style={s.signOutLabel}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: c.line,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderColor: c.sand,
      gap: 14,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.terracotta,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { color: c.surface, fontSize: 22, fontWeight: '700' },
    headerInfo: { flex: 1 },
    userName: { fontSize: 17, fontWeight: '700', color: c.ink },
    userEmail: { fontSize: 13, color: c.inkSoft, marginTop: 1 },
    scroll: { flexGrow: 0 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },
    itemIcon: { fontSize: 22, width: 28, textAlign: 'center', color: c.ink },
    itemContent: { flex: 1 },
    itemLabel: { fontSize: 15, fontWeight: '600', color: c.ink },
    itemDesc: { fontSize: 12, color: c.inkSoft, marginTop: 1 },
    chevron: { fontSize: 20, color: c.line },
    divider: { height: 1, backgroundColor: c.sand, marginHorizontal: 20, marginVertical: 4 },
    signOutItem: { paddingVertical: 16 },
    signOutLabel: { fontSize: 15, fontWeight: '600', color: c.danger, flex: 1 },
  })
