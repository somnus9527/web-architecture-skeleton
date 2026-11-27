import { expect, test } from '@playwright/test';

import { expectNoSeriousViolations } from './support';

test.describe('公开页', () => {
  test('should keep the login page free of serious axe violations', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('main')).toBeVisible();

    await expectNoSeriousViolations(page, '登录页');
  });

  test('should keep the localized home page free of serious axe violations', async ({ page }) => {
    await page.goto('/zh-CN');

    await expect(page.locator('main')).toBeVisible();

    await expectNoSeriousViolations(page, '首页（zh-CN）');
  });
});
