import { defineConfig, devices } from '@playwright/test';

/**
 * 无障碍测试配置：真实 Chromium + axe。
 *
 * 用 `dev:mock` 启动，因为公开首页要走 BFF → Prism mock；不依赖真实后端。
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.a11y.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:9401',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 9401 不占用 .env.mock 的 9001：CI 之外的本机 9001 常被 MinIO 等容器占用。
    command: 'PORT=9401 pnpm dev:mock',
    url: 'http://127.0.0.1:9401/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
