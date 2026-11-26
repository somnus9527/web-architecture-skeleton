import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest 测试配置，使用 jsdom 支撑 React 组件测试。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 覆盖率只卡共享层：页面与路由壳多为编排代码，强行卡比例只会逼出假测试。
    // 阈值按 2026-11-26 实测值下浮 2 个点，新增共享代码未补测试时会先掉红。
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.{ts,tsx}'],
      exclude: ['src/shared/**/*.test.{ts,tsx}', 'src/shared/**/*.d.ts'],
      reporter: ['text-summary'],
      thresholds: {
        statements: 72,
        branches: 57,
        functions: 66,
        lines: 72,
      },
    },
  },
});
