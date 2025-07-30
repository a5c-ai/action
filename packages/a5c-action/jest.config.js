/**
 * Jest configuration for a5c-action
 */

module.exports = {
  displayName: 'a5c-action',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/index.js'
  ]
};