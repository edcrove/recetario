module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Instrument code for E2E coverage when BABEL_ENV=coverage
      ...(process.env['BABEL_ENV'] === 'coverage'
        ? [
            [
              'babel-plugin-istanbul',
              {
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
