/**
 * RN 骨架的 Jest 基线：使用 jest-expo 预设，测试文件统一放 src/test。
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/test/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
