module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
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
