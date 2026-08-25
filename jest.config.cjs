module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  // Serverless code under api/ must import with an explicit .js extension to run as ESM on
  // Vercel, but those files are TypeScript on disk. Strip the extension so Jest resolves
  // them. Until now no api/_shared module imported a VALUE from a sibling — only types,
  // which are erased before resolution ever happens — so this had not come up.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
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
