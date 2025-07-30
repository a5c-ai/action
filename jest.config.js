/**
 * Root Jest configuration
 */

module.exports = {
  projects: [
    '<rootDir>/packages/a5c-sdk/jest.config.js',
    '<rootDir>/packages/a5c-action/jest.config.js',
    '<rootDir>/packages/a5c-cli/jest.config.js'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.js',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true
};