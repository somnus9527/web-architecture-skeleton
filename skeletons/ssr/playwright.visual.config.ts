import { defineConfig, devices } from '@playwright/test';

/**
 * 视觉回归配置（SSR）：真实 Chromium + 固定视口，只跑公开关键页截图。
 *
 * 基线只在固定 Linux 环境生成与校验；本地更新用 `pnpm test:visual:docker`。
 */
export default defineConfig({
  testDir: './e2e/visual',
  testMatch: '**/*.visual.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:9401',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    // 9401 避开本机 9001 的容器占用；CI 与本地都走同一个 mock 服务。
    command: 'PORT=9401 pnpm dev:mock',
    url: 'http://127.0.0.1:9401/login',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
