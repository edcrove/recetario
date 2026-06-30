/**
 * Vitest mock for react-native — maps RN primitives to HTML equivalents.
 * Used in screen component tests running in jsdom.
 */
import React from 'react'

const passThrough =
  (Tag: string) =>
  ({
    children,
    testID,
    style: _style,
    ...rest
  }: React.HTMLAttributes<HTMLElement> & { testID?: string; style?: unknown }) =>
    React.createElement(Tag, { 'data-testid': testID, ...rest }, children)

export const View = passThrough('div')
export const Text = passThrough('span')
export const ScrollView = passThrough('div')
export const SafeAreaView = passThrough('div')
export const FlatList = ({
  data,
  renderItem,
  keyExtractor,
  ListEmptyComponent,
}: {
  data: unknown[]
  renderItem: (arg: { item: unknown; index: number }) => React.ReactNode
  keyExtractor?: (item: unknown, index: number) => string
  ListEmptyComponent?: React.ReactNode
}) => (
  <div>
    {data.length === 0 && ListEmptyComponent}
    {data.map((item, index) => (
      <div key={keyExtractor ? keyExtractor(item, index) : index}>
        {renderItem({ item, index })}
      </div>
    ))}
  </div>
)

export const TextInput = ({
  value,
  onChangeText,
  placeholder,
  testID,
  style: _style,
  keyboardType: _kt,
  multiline: _ml,
  clearButtonMode: _cb,
  ...rest
}: {
  value?: string
  onChangeText?: (v: string) => void
  placeholder?: string
  testID?: string
  style?: unknown
  keyboardType?: string
  multiline?: boolean
  clearButtonMode?: string
}) => (
  <input
    data-testid={testID}
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(e) => onChangeText?.(e.target.value)}
    {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
  />
)

export const TouchableOpacity = ({
  children,
  onPress,
  disabled,
  testID,
  style: _style,
  activeOpacity: _ao,
  ...rest
}: {
  children?: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  testID?: string
  style?: unknown
  activeOpacity?: number
}) => (
  <button
    data-testid={testID}
    onClick={disabled ? undefined : onPress}
    disabled={disabled}
    type="button"
    {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
  >
    {children}
  </button>
)

export const ActivityIndicator = ({
  testID,
}: {
  testID?: string
  size?: string | number
  style?: unknown
}) => <div data-testid={testID ?? 'activity-indicator'} role="progressbar" />

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
}

import { vi } from 'vitest'
export const Alert = { alert: vi.fn() }
export const Vibration = { vibrate: vi.fn() }
export const Platform = {
  OS: 'ios',
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
}
