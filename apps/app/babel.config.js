module.exports = function (api) {
  // Cache keyed on BABEL_ENV, not cached unconditionally (api.cache(true)) —
  // CI builds both a standard and an instrumented bundle in the same job/
  // filesystem; an unconditional cache lets Metro reuse the first build's
  // (non-instrumented) transforms for the second, so window.__coverage__
  // never gets populated and E2E coverage collection silently no-ops.
  api.cache.using(() => process.env['BABEL_ENV'] ?? '')
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Instrument code for E2E coverage when BABEL_ENV=coverage
      ...(process.env['BABEL_ENV'] === 'coverage'
        ? [
            [
              'babel-plugin-istanbul',
              {
                cwd: __dirname,
                include: ['app/**/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'],
                exclude: [
                  'e2e/**',
                  '**/*.test.ts',
                  '**/*.test.tsx',
                  'src/__mocks__/**',
                  'src/__tests__/**',
                  'src/__screen-tests__/**',
                ],
                extension: ['.ts', '.tsx', '.js'],
              },
            ],
          ]
        : []),
    ],
  }
}
