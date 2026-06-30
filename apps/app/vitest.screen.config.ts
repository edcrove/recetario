import { defineConfig } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__screen-tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__mocks__/screen-setup.ts'],
    alias: {
      'react-native': path.resolve(__dirname, 'src/__mocks__/react-native.tsx'),
      'expo-router': path.resolve(__dirname, 'src/__mocks__/expo-router.ts'),
      'expo-keep-awake': path.resolve(__dirname, 'src/__mocks__/expo-keep-awake.ts'),
      'expo-speech': path.resolve(__dirname, 'src/__mocks__/expo-speech.ts'),
    },
  },
})
