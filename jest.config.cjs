module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  // Server functions import siblings as './x.js' (Vercel's ES modules need it); the tests run the .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { 
      tsconfig: {
        target: 'es2022',
        module: 'commonjs',
        verbatimModuleSyntax: false,
        noEmit: false,
        esModuleInterop: true,
        allowImportingTsExtensions: true
      }
    }],
  },
};
