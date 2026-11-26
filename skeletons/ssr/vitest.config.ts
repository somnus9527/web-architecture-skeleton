import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest 配置。默认 jsdom 环境服务组件测试；
 * `src/test/architecture/**` 里的静态架构测试在各自文件顶部用
 * `// @vitest-environment node` docblock 切到 node 环境（纯扫描无需 DOM）。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/setup/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup/vitest-setup.ts'],
    // 覆盖率只卡共享层：BFF 路由与页面是编排层，不是这轮要约束的对象。
    // 阈值按 2026-11-26 实测值下浮 2 个点。
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.{ts,tsx}'],
      exclude: ['src/shared/**/*.test.{ts,tsx}', 'src/shared/**/*.d.ts'],
      reporter: ['text-summary'],
      thresholds: {
        statements: 65,
        branches: 52,
        functions: 58,
        lines: 65,
      },
    },
  },
});
