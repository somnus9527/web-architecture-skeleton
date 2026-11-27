import { expect, test } from '@playwright/test';

import { expectNoSeriousViolations } from './support';

test.describe('登录页', () => {
  test('should keep the login page free of serious axe violations', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('账号')).toBeVisible();
    await expect(page.getByRole('button', { name: /登\s*录/u })).toBeVisible();

    await expectNoSeriousViolations(page, '登录页');
  });
});
