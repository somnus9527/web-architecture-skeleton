import { expect, test, type Page } from '@playwright/test';

const THEMES = ['light', 'dark'] as const;

/** 关闭动画与光标闪烁，避免同一页面两次截图出现像素差。 */
const FREEZE_STYLE =
  '*{transition:none!important;animation:none!important;caret-color:transparent!important}' +
  // Next dev 的开发指示器不属于页面内容，固定隐藏，避免它随框架版本变化污染基线。
  'nextjs-portal{display:none!important}';

/**
 * 冻结页面动画、等待字体加载完成。
 *
 * @param page - Playwright 页面。
 */
async function prepareScreenshot(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_STYLE });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

for (const theme of THEMES) {
  test.describe(`主题 ${theme}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'app-theme-mode', value: theme, url: baseURL ?? 'http://127.0.0.1:9401' }]);
    });

    test('登录页', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('h1')).toBeVisible();
      await prepareScreenshot(page);
      await expect(page).toHaveScreenshot(`login-${theme}.png`, { fullPage: true });
    });

    test('公开首页', async ({ page }) => {
      await page.goto('/zh-CN');
      await expect(page.locator('h1')).toBeVisible();
      await prepareScreenshot(page);
      await expect(page).toHaveScreenshot(`home-${theme}.png`, { fullPage: true });
    });
  });
}
