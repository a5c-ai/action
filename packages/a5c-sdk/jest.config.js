/**
 * Jest configuration for a5c-sdk
 */

module.exports = {
  displayName: 'a5c-sdk',
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