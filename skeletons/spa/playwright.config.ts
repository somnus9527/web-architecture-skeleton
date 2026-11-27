import { defineConfig, devices } from '@playwright/test';

/**
 * 无障碍测试配置：真实 Chromium + axe。
 *
 * 不复用 `pnpm dev`（会同时拉起 Prism mock）；axe 只渲染登录页与组件夹具，不需要 API。
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.a11y.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite --mode mock --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
