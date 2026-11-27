import { expect, test } from '@playwright/test';

import { expectNoSeriousViolations } from './support';

test.describe('共享 UI 原语', () => {
  test('should render every shared primitive without serious axe violations', async ({ page }) => {
    await page.goto('/a11y.html');

    await expect(page.getByRole('heading', { level: 1, name: '共享组件无障碍基线' })).toBeVisible();
    // 夹具必须真的渲染出组件，而不是只 import 了没挂载。
    await expect(page.getByRole('button', { name: '主要动作' })).toBeVisible();
    await expect(page.getByRole('button', { name: '提交中' })).toBeVisible();

    await expectNoSeriousViolations(page, '共享组件夹具');
  });

  test('should expose accessible names on inputs and selects', async ({ page }) => {
    await page.goto('/a11y.html');

    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('密码')).toBeVisible();
    await expect(page.getByLabel('工作区')).toBeVisible();
  });
});
