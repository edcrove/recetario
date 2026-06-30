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
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
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
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.route + item.label}
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
          <TouchableOpacity style={[s.item, s.signOutItem]} onPress={handleSignOut}>
            <Text style={s.itemIcon}>🚪</Text>
            <Text style={s.signOutLabel}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
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
    borderColor: '#f3f4f6',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  userEmail: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  scroll: { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  itemIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemDesc: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  chevron: { fontSize: 20, color: '#d1d5db' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20, marginVertical: 4 },
  signOutItem: { paddingVertical: 16 },
  signOutLabel: { fontSize: 15, fontWeight: '600', color: '#ef4444', flex: 1 },
})
