/**
 * RN 骨架的 Jest 基线：使用 jest-expo 预设，测试文件统一放 src/test。
 *
 * moduleNameMapper 与 tsconfig.json 的七组 path alias 一一对应，避免测试里再用 `@/` 兜底风格。
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/test/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@storage/(.*)$': '<rootDir>/src/storage/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
