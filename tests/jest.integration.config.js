#!/usr/bin/env node
// Purpose: integration-owned Jest configuration for the cross-component edge handoff tests. It reuses the tutor-system Babel/TypeScript transform so the handoff tests can import the real component modules, while keeping the integration test paths outside the component's own test roots.

const path = require('node:path');

const tutorSystemRoot = path.resolve(__dirname, '../../tutor-system');

module.exports = {
  rootDir: tutorSystemRoot,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/../tests/integration/**/*.test.ts', '<rootDir>/../tests/e2e/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      require.resolve('babel-jest', { paths: [tutorSystemRoot] }),
      {
        presets: [require.resolve('babel-preset-react-app', { paths: [tutorSystemRoot] })],
        babelrc: false,
        configFile: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePaths: [path.join(tutorSystemRoot, 'node_modules')],
  testEnvironmentOptions: { customExportConditions: [''] },
  resetMocks: true,
};
