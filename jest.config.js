/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/example/'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
};
