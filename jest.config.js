/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/functions/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@angular|rxjs|@angular/fire|firebase|luxon)/)',
  ],
};
