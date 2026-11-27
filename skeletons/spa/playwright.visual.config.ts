import { defineConfig, devices } from '@playwright/test';

/**
 * 视觉回归配置：真实 Chromium + 固定视口与字体，只跑关键页截图。
 *
 * 基线在不同操作系统上会因字体渲染产生差异，因此截图只在固定 Linux 环境生成与校验：
 * 本地用 `pnpm test:visual:docker`，CI 用 ubuntu runner + 官方 Chromium。
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
    baseURL: 'http://127.0.0.1:5199',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'pnpm exec vite --mode mock --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
